import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { JSDOM } from "jsdom";
import readability from "@mozilla/readability";
import multer from "multer";
import mammoth from "mammoth";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import officeparser from "officeparser";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
const { Readability } = readability;
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import fs from "fs";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { GenerateVideosOperation } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors({
  origin: "*", // Adjust for production
  credentials: true,
}));

const generationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, 
  max: 100, 
  message: { error: "Daily generation quota exceeded." },
});

app.use(express.json({ limit: "50mb" }));
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

// Initialize GoogleGenAI SDK lazily to prevent startup crashes when API keys are not injected yet
let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please add your Gemini API Key in the Settings menu of AI Studio to proceed.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}


// Helper to retry Gemini API calls with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 5,
  delay = 2000,
  factor = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const isHardQuotaExceeded =
      errorMsg.includes("exceeded your current quota") ||
      errorMsg.includes("daily limit") ||
      errorMsg.includes("FreeTier") ||
      errorMsg.includes("Quota exceeded");

    const isRetryable =
      !isHardQuotaExceeded &&
      (errorMsg.includes("503") ||
        errorMsg.includes("UNAVAILABLE") ||
        errorMsg.includes("high demand") ||
        errorMsg.includes("temporary") ||
        errorMsg.includes("429") ||
        errorMsg.includes("RESOURCE_EXHAUSTED") ||
        errorMsg.includes("rate limit") ||
        errorMsg.includes("Overloaded") ||
        errorMsg.includes("Service Unavailable") ||
        (error?.status && (error.status === 503 || error.status === 429)));

    if (isRetryable && retries > 0) {
      let customDelay = delay;
      if (errorMsg.includes("Please retry in")) {
        const match = errorMsg.match(/Please retry in (\d+(\.\d+)?)\s*s/i);
        if (match && match[1]) {
          const seconds = parseFloat(match[1]);
          if (!isNaN(seconds)) {
            customDelay = Math.ceil(seconds * 1000) + 1500; // Add 1.5 seconds padding
            console.log(`Parsed retry delay from Gemini error: ${customDelay}ms`);
          }
        }
      } else if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota")) {
        customDelay = Math.max(delay, 5000); // Start with at least 5 seconds for quota errors
      }

      console.warn(`Gemini API call failed with retryable error: ${errorMsg}. Retrying in ${customDelay}ms... (${retries} attempts left)`);
      await new Promise((resolve) => setTimeout(resolve, customDelay));
      return retryWithBackoff(fn, retries - 1, customDelay * factor, factor);
    }
    throw error;
  }
}

// Robust wrapper for Gemini generateContent calls with model-level fallback
async function generateAIContent(
  params: {
    model: string;
    contents: any;
    config?: any;
  },
  retries = 5,
  delay = 2000,
  factor = 2
): Promise<any> {
  let currentModel = params.model;
  let attempt = 0;
  const attemptedModels = new Set<string>();

  while (true) {
    try {
      attemptedModels.add(currentModel);
      return await getAI().models.generateContent({
        ...params,
        model: currentModel,
      });
    } catch (error: any) {
      attempt++;
      const errorMsg = error?.message || JSON.stringify(error) || String(error);
      const isQuotaExceeded =
        errorMsg.includes("exceeded your current quota") ||
        errorMsg.includes("daily limit") ||
        errorMsg.includes("FreeTier") ||
        errorMsg.includes("Quota exceeded") ||
        errorMsg.includes("RESOURCE_EXHAUSTED") ||
        (error?.status && error.status === 429) ||
        errorMsg.includes("429");

      const isUnavailable =
        errorMsg.includes("503") ||
        errorMsg.includes("UNAVAILABLE") ||
        errorMsg.includes("high demand") ||
        errorMsg.includes("temporary") ||
        errorMsg.includes("Overloaded") ||
        errorMsg.includes("Service Unavailable") ||
        (error?.status && error.status === 503);

      const FALLBACK_CHAIN: Record<string, string> = {
        "gemini-2.5-flash": "gemini-3.1-flash-lite",
        "gemini-3.1-flash-lite": "gemini-2.5-flash",
        "gemini-3.1-pro-preview": "gemini-2.5-flash",
      };

      if (isQuotaExceeded || isUnavailable) {
        // Pivot to a different model immediately
        let nextModel = FALLBACK_CHAIN[currentModel] || "";

        if (nextModel && !attemptedModels.has(nextModel)) {
          console.warn(`${isQuotaExceeded ? "Quota exceeded" : "Service unavailable"} for ${currentModel}. Pivoting to ${nextModel}...`);
          currentModel = nextModel;
          attempt = 0; // Reset attempts for the new model
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
      }

      const isRetryable =
        isUnavailable ||
        (!isQuotaExceeded && (errorMsg.includes("rate limit") || (error?.status && error.status === 429)));

      if (isRetryable && attempt <= retries) {
        let customDelay = delay;
        if (errorMsg.includes("Please retry in")) {
          const match = errorMsg.match(/Please retry in (\d+(\.\d+)?)\s*s/i);
          if (match && match[1]) {
            const seconds = parseFloat(match[1]);
            if (!isNaN(seconds)) {
              customDelay = Math.ceil(seconds * 1000) + 1500;
              console.log(`Parsed retry delay from Gemini error: ${customDelay}ms`);
            }
          }
        }

        console.warn(`Gemini API call failed (attempt ${attempt}/${retries}). Error: ${errorMsg}. Retrying in ${customDelay}ms with model ${currentModel}...`);
        await new Promise((resolve) => setTimeout(resolve, customDelay));
        delay = customDelay * factor;
        continue;
      }
      throw error;
    }
  }
}

async function resolveUrlContent(url: string): Promise<string> {
  if (!url) return "";
  try {
    console.log(`Scraping web page contents for URL: ${url}`);
    const response = await fetch(url, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    
    if (!article || !article.textContent) {
      throw new Error("Could not extract readable article text from this page. The layout might be non-standard or heavily script-based.");
    }
    
    // Cap at 15k characters for prompt context
    const extractedText = article.textContent.trim().slice(0, 15000);
    return extractedText;
  } catch (error: any) {
    console.error(`Failed to resolve URL content for ${url}:`, error);
    throw new Error(`This URL could not be parsed: ${error.message || error}. This page may require login, captcha, or blocks automated access. Try pasting the content manually in the input box instead!`);
  }
}

app.use(express.json({ limit: "10mb" }));

// WAV Header Helper for Gemini raw PCM (24kHz, 16-bit, Mono)
function addWavHeader(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const header = Buffer.alloc(44);
  const dataLength = pcmBuffer.length;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // Mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (24000 * 2)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// Robust Fallback Script and Content Generators
function generateFallbackScript(topic: string, language: string, style: string, length: string) {
  const cleanTopic = topic || "Interesting Topic";
  return {
    title: `Understanding ${cleanTopic}`,
    language: language || "English",
    style: style || "simple",
    scenes: [
      {
        id: "scene_01",
        type: "title_card",
        headline: cleanTopic,
        narration: `Welcome! Today, we are exploring the fascinating topic of: ${cleanTopic}. Let's break it down step-by-step together.`,
        visual_instruction: "Glow effect with circular animation centering the topic text",
        duration_seconds: 7,
        bg_color: "#0a0a0c",
        accent_color: "#6366f1"
      },
      {
        id: "scene_02",
        type: "bullet_reveal",
        headline: "Core Concepts",
        narration: `There are three main pillars to understand here: first, the foundational context; second, the active mechanisms; and third, the ultimate impact on the world.`,
        visual_instruction: "Staggered bullet cards fading in vertically",
        duration_seconds: 8,
        bullets: [
          "Foundational Context & Purpose",
          "Active Mechanisms & Components",
          "Ultimate Impact & Relevance"
        ],
        bg_color: "#0f172a",
        accent_color: "#3b82f6"
      },
      {
        id: "scene_03",
        type: "concept_split",
        headline: "The Core Contrast",
        left_label: "Traditional View",
        right_label: "Modern Approach",
        narration: `Let's compare: on one hand, we have the older, static understanding; on the other, the modern, dynamic approach that transforms how we see it.`,
        visual_instruction: "Two column layout split with dotted line down the middle",
        duration_seconds: 8,
        bg_color: "#18181b",
        accent_color: "#ec4899"
      },
      {
        id: "scene_04",
        type: "analogy_card",
        headline: "A Clear Analogy",
        analogy_text: "Think of it like a puzzle: each piece connects to show a perfect map.",
        narration: `To grasp this easily, think of it like a puzzle. Separately, the individual pieces seem confusing, but when they connect, a clear picture emerges.`,
        visual_instruction: "Centered rotating gear/spokes animation",
        duration_seconds: 8,
        bg_color: "#052e16",
        accent_color: "#22c55e"
      },
      {
        id: "scene_05",
        type: "data_stat",
        headline: "Impact Metrics",
        stat_value: "10x",
        stat_label: "Efficiency & Clarity Gains",
        narration: `Applying these core frameworks yields up to a ten times improvement in general efficiency and logical clarity.`,
        visual_instruction: "Huge circular loader counting up to 10x in center",
        duration_seconds: 7,
        bg_color: "#1e1b4b",
        accent_color: "#8b5cf6"
      },
      {
        id: "scene_06",
        type: "summary_card",
        headline: "Key Takeaways",
        narration: `In summary: break complex concepts down, leverage intuitive analogies, and focus on the core impact. Thank you for exploring this with us!`,
        visual_instruction: "Warm horizontal glowing divider centering headline",
        duration_seconds: 7,
        bg_color: "#09090b",
        accent_color: "#f59e0b"
      }
    ],
    total_duration_seconds: 45
  };
}

function generateFallbackPodcast(topic: string, language: string, style: string, length: string) {
  const cleanTopic = topic || "Interesting Topic";
  return {
    title: `Exploring ${cleanTopic} Podcast`,
    format: "podcast",
    turns: [
      {
        speaker: "host",
        text: `Hey everyone, welcome to Vyakhya Talks! Today we've got an awesome episode for you. We're breaking down: ${cleanTopic}. Joining me is our guest expert, Jane!`
      },
      {
        speaker: "guest",
        text: "Thanks Joe! It's great to be here. This is such a fascinating topic, and I can't wait to share some really simple ways to think about it."
      },
      {
        speaker: "host",
        text: `Awesome. So Jane, for someone hearing about ${cleanTopic} for the first time, where's the best place to start?`
      },
      {
        speaker: "guest",
        text: "Well, the key is to look at the primary purpose. Don't get bogged down in technical jargon. Think of it like a well-oiled machine where every component serves a specific goal."
      },
      {
        speaker: "host",
        text: "Ah, that makes total sense. Can you give us an analogy to make it really stick?"
      },
      {
        speaker: "guest",
        text: "Absolutely! Think of it like a map. Individually, a single line doesn't tell you much. But once you look at the roads together, the entire path becomes clear."
      },
      {
        speaker: "host",
        text: "Wow, that's beautiful. So what's the biggest takeaway for our listeners today?"
      },
      {
        speaker: "guest",
        text: "The main takeaway is to focus on structured, visual thinking. Break big ideas down, and you can master any topic."
      },
      {
        speaker: "host",
        text: "Brilliant! Thanks so much for joining us Jane, and thank you everyone for listening to Vyakhya Talks. See you next time!"
      }
    ]
  };
}

function generateFallbackQuiz(topic: string) {
  const cleanTopic = topic || "Interesting Topic";
  return [
    {
      question: `What is the primary objective of studying ${cleanTopic}?`,
      options: [
        "To understand its core components and foundational purpose",
        "To memorize irrelevant facts and historical trivia",
        "To completely ignore its modern practical applications",
        "To replace it with unorganized, static theories"
      ],
      correctIndex: 0,
      explanation: `Correct! Learning ${cleanTopic} begins by understanding its primary objectives, components, and real-world usefulness to establish a solid logical framework.`
    },
    {
      question: `Which of the following best describes the key mechanism behind ${cleanTopic}?`,
      options: [
        "A highly complex, non-replicable random occurrence",
        "A structured, interconnected set of active processes working together",
        "An outdated, static approach with no relevance to contemporary systems",
        "A purely theoretical model with zero empirical evidence"
      ],
      correctIndex: 1,
      explanation: "Exactly. The mechanism relies on structured, interconnected elements collaborating seamlessly to achieve the desired outcome."
    },
    {
      question: `How does utilizing analogies help in mastering ${cleanTopic}?`,
      options: [
        "It complicates simple concepts unnecessarily",
        "It provides a clear mental bridge by mapping unfamiliar ideas to familiar experiences",
        "It eliminates the need for any further study or learning",
        "It restricts visual representation and creative flow"
      ],
      correctIndex: 1,
      explanation: "Analogy mapping acts as a bridge, making complex, abstract theories instantly relatable by drawing on familiar concepts."
    },
    {
      question: `What is a common pitfall when exploring ${cleanTopic} for the first time?`,
      options: [
        "Focusing too heavily on complex jargon rather than the underlying principles",
        "Breaking down concepts into modular, easy-to-understand segments",
        "Using visual aids and structured diagrams",
        "Asking clarifying doubts and testing with quizzes"
      ],
      correctIndex: 0,
      explanation: "Getting bogged down in surface jargon instead of grasping the fundamental underlying principles is the most common beginner obstacle."
    },
    {
      question: `Which of the following is the most effective way to consolidate your knowledge of ${cleanTopic}?`,
      options: [
        "Reading the same definition repeatedly without thinking about it",
        "Applying active recall through dynamic flashcards, quizzes, and Q&A sessions",
        "Skipping foundational steps and jumping straight to deep scenarios",
        "Disabling audio/visual explanations during review"
      ],
      correctIndex: 1,
      explanation: "Active recall via flashcards, interactive quizzes, and Q&A reinforces brain neural connections and builds lasting memory."
    }
  ];
}

function generateFallbackFlashcards(topic: string) {
  const cleanTopic = topic || "Interesting Topic";
  return [
    {
      front: `What is the core essence of ${cleanTopic}?`,
      back: `At its heart, ${cleanTopic} represents a structured domain of knowledge centered around solving core problems using repeatable and organized principles.`
    },
    {
      front: `Why is visual storytelling so powerful for ${cleanTopic}?`,
      back: `Visual aids activate double coding theory in human memory, anchoring verbal narration with high-contrast diagrams, concept splits, and stat loaders.`
    },
    {
      front: `How can you decompose complex details of ${cleanTopic}?`,
      back: `By breaking the topic down into specific scene modalities: beginning with title cards, revealing bullet points, applying analogies, and reviewing metric stats.`
    },
    {
      front: `What role does active recall play in learning ${cleanTopic}?`,
      back: `Rather than passively reading, testing yourself with interactive quizzes and flashcards forces your brain to retrieve info, creating durable pathways.`
    },
    {
      front: `What is the final summary takeaway for ${cleanTopic}?`,
      back: `Focus on mastering the underlying fundamentals first, connect them with clear analogies, and reinforce them through targeted self-testing.`
    }
  ];
}

function generateFallbackDoubt(topic: string, question: string) {
  const cleanTopic = topic || "this topic";
  return `### Vyakhya AI Assistant — Doubt Clarification

That is a fantastic question about **${cleanTopic}**! Here is a structured, intuitive explanation to clarify your doubt:

#### 1. The Core Principle
To understand *"${question}"*, we must look at how the active mechanisms of **${cleanTopic}** collaborate. Think of it like gears in a clock: every piece operates in concert to move the hands forward.

#### 2. Clear Metaphor
* **The Concept**: It acts like a digital translator.
* **The Analogy**: Imagine traveling to a foreign country. Instead of reading a massive dictionary, you use a pocket device that instantly points out the exact path to your destination.

#### 3. Actionable Next Steps
1. **Identify the core trigger** in your query.
2. **Deconstruct the components** into smaller, manageable units.
3. **Validate with interactive tools** like the quiz and flashcards below to lock in the logic!

Feel free to ask another doubt or explore the interactive learning tools!`;
}

// 1. API Endpoints

// Explainer Video Script Generation
app.post("/api/generate-script", async (req, res) => {
  try {
    const { topic, language, style, length, documentText, url, voicePreference } = req.body;
    if (!topic && !documentText && !url) {
      return res.status(400).json({ error: "Prompt, document text or URL is required" });
    }

    const languageMap: Record<string, string> = {
      "en-IN": "English",
      "hi-IN": "Hindi",
      "ta-IN": "Tamil",
      "te-IN": "Telugu",
      "bn-IN": "Bengali",
      "mr-IN": "Marathi",
      "ml-IN": "Malayalam",
      "gu-IN": "Gujarati"
    };
    const targetLanguageName = languageMap[language] || language || "English";
    const styleLabel = style || "simple";
    const lenLabel = length || "short";
    const voiceLabel = voicePreference || "female";
    
    // Map length to approximate time
    const durationMap: Record<string, string> = {
      short: "1 minute",
      medium: "3 minutes",
      deep: "5 minutes"
    };
    const durationLabel = durationMap[lenLabel] || "1 minute";

    let contextText = "";
    if (documentText) {
      contextText += `\n[Reference Document Content]:\n${documentText}\n`;
    }
    if (url) {
      const resolvedText = await resolveUrlContent(url);
      if (resolvedText) {
        contextText += `\n[Reference URL Web Content]:\n${resolvedText}\n`;
      } else {
        contextText += `\n[Reference URL]:\n${url}\n`;
      }
    }

    const userPrompt = `Generate a video explainer script about: "${topic || "the uploaded document/URL"}"
Language: ${targetLanguageName}
Style: ${styleLabel}
Duration Target: ${durationLabel}
Voice Gender Preference: ${voiceLabel}
${contextText}`;

    let sceneGuidance = "";
    if (lenLabel === "medium") {
      sceneGuidance = "CRITICAL: The user requested a 3-minute video. You MUST generate between 20 and 30 scenes. Ensure the sum of 'duration_seconds' across all scenes exactly equals roughly 180 seconds, and the total narration word count should be around 400-500 words to prevent content compression.";
    } else if (lenLabel === "deep") {
      sceneGuidance = "CRITICAL: The user requested a 5-minute video. You MUST generate between 40 and 50 scenes. Ensure the sum of 'duration_seconds' across all scenes exactly equals roughly 300 seconds, and the total narration word count should be around 700-800 words to prevent content compression.";
    } else {
      sceneGuidance = "CRITICAL: The user requested a 1-minute video. Generate 8-12 scenes, with around 150 words total narration and sum of 'duration_seconds' exactly roughly 60 seconds.";
    }

    const response = await generateAIContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: `You are Vyakhya, an expert visual explainer script writer.
Create a structured, scene-by-scene script for an animated explainer video.
Follow these constraints strictly:
1. The explanation must strictly match the user's requested topic and answer any specific questions, focus points, or guidelines they asked for.
2. Narration and headlines must be entirely in ${targetLanguageName}. The text, narration script, and slide content MUST be written in the natural native script of ${targetLanguageName} (for example, Devanagari script for Hindi, Tamil script for Tamil, etc.). Do not write in romanized/transliterated form (e.g. do not write 'Namaste' in english characters for Hindi, write 'नमस्ते' in Devanagari script). Use locally natural greetings and idioms appropriate for ${targetLanguageName} speakers — do not force English conventions. The narration style must be simple, conversational, and highly engaging.
3. ${sceneGuidance}
4. Ensure rich visual imagery, descriptions of animations, and graphical elements are included for each scene.
5. For EACH scene, provide a detailed, descriptive 'image_description' field that explains the visual content, composition, and style of the image for that scene.
6. Select appropriate theme background colors (hex format e.g. "#1e293b") and high-contrast accent colors that reflect the topic's mood.
7. Each scene must map to one of these types:
   - 'title_card': Huge headline + brief subtitle + visual instruction
   - 'concept_split': Split layout with left_label, right_label, comparison
   - 'bullet_reveal': headline + 1 to 3 key bullet points (represented in 'bullets' array)
   - 'analogy_card': headline + a relatable metaphor ('analogy_text' field)
   - 'data_stat': large stat number ('stat_value' e.g. "97%") + label ('stat_label')
   - 'timeline': chronological steps represented in 'steps' array (max 4 steps)
   - 'quote_card': famous or impactful quote ('quote_text') + author ('quote_attribution')
   - 'summary_card': key concluding takeaways
8. Ensure the script begins with a 'title_card' and ends with a 'summary_card'.
9. Double-check that all headlines, narration, visual elements, analogies, and metrics directly reflect the user's exact query in high resolution (not shallow generalities).
10. Return valid JSON only, strictly matching the requested schema. No conversational preamble.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            language: { type: Type.STRING },
            style: { type: Type.STRING },
            duration_breakdown: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array explicitly mapping video sections to exact time intervals to guarantee duration"
            },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: {
                    type: Type.STRING,
                    description: "Must be one of: 'title_card', 'concept_split', 'bullet_reveal', 'analogy_card', 'data_stat', 'timeline', 'quote_card', 'summary_card'",
                  },
                  headline: { type: Type.STRING },
                  narration: { type: Type.STRING },
                  visual_instruction: { type: Type.STRING, description: "Detailed description of graphics for canvas renderer" },
                  image_description: { type: Type.STRING, description: "Detailed description of the image for this scene" },
                  duration_seconds: { type: Type.INTEGER, description: "Length of narration, usually 6 to 10" },
                  bg_color: { type: Type.STRING },
                  accent_color: { type: Type.STRING },
                  // Optional scene-specific fields
                  left_label: { type: Type.STRING },
                  right_label: { type: Type.STRING },
                  bullets: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  analogy_text: { type: Type.STRING },
                  stat_value: { type: Type.STRING },
                  stat_label: { type: Type.STRING },
                  steps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  quote_text: { type: Type.STRING },
                  quote_attribution: { type: Type.STRING },
                },
                required: [
                  "id",
                  "type",
                  "headline",
                  "narration",
                  "visual_instruction",
                  "duration_seconds",
                  "bg_color",
                  "accent_color",
                ],
              },
            },
            total_duration_seconds: { type: Type.INTEGER },
          },
          required: ["title", "language", "style", "scenes", "total_duration_seconds"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No script generated from Gemini");
    }

    res.json(JSON.parse(text));
  } catch (error: any) {
    console.error("Error generating script with Gemini:", error);
    res.status(500).json({ error: `Failed to generate script. Gemini API reported: ${error.message || error}. Please ensure your API Key is correctly configured in the settings menu or try again shortly.` });
  }
});

// Podcast Mode Script Generation (Host + Guest Dialogue)
app.post("/api/generate-podcast", async (req, res) => {
  try {
    const { topic, language, style, length, documentText, url } = req.body;
    if (!topic && !documentText && !url) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const languageMap: Record<string, string> = {
      "en-IN": "English",
      "hi-IN": "Hindi",
      "ta-IN": "Tamil",
      "te-IN": "Telugu",
      "bn-IN": "Bengali",
      "mr-IN": "Marathi",
      "ml-IN": "Malayalam",
      "gu-IN": "Gujarati"
    };
    const targetLanguageName = languageMap[language] || language || "English";
    const styleLabel = style || "simple";
    const lenLabel = length || "short";

    let contextText = "";
    if (documentText) {
      contextText += `\n[Reference Document Content]:\n${documentText}\n`;
    }
    if (url) {
      const resolvedText = await resolveUrlContent(url);
      if (resolvedText) {
        contextText += `\n[Reference URL Web Content]:\n${resolvedText}\n`;
      } else {
        contextText += `\n[Reference URL]:\n${url}\n`;
      }
    }

    const userPrompt = `Generate a dual-speaker podcast conversation discussing: "${topic || "the uploaded document/URL"}"
Language: ${targetLanguageName}
Style: ${styleLabel}
Length Category: ${lenLabel} (short: ~10 turns, medium: ~20 turns, deep: ~30 turns)${contextText}`;

    const response = await generateAIContent({
      model: "gemini-3.1-flash-lite",
      contents: userPrompt,
      config: {
        systemInstruction: `You are an expert podcast scriptwriter for Vyakhya Talks.
Create a highly engaging, educational conversational dialogue between Joe (the host) and Jane (the guest expert).
Follow these constraints strictly:
1. The podcast conversation must strictly match the user's requested topic and answer any direct questions or guidelines they specified. Avoid unrelated banter or generalities.
2. The podcast dialogue must be entirely in ${targetLanguageName}. The dialogue script and content MUST be written in the natural native script of ${targetLanguageName} (for example, Devanagari script for Hindi, Tamil script for Tamil, etc.). Do not write in romanized/transliterated form (e.g. do not write 'Namaste' in english characters for Hindi, write 'नमस्ते' in Devanagari script). Use locally natural greetings and idioms appropriate for ${targetLanguageName} speakers — do not force English greeting conventions.
3. Joe is curious, relatable, asking smart questions.
4. Jane is highly knowledgeable, breaks down complex topics with brilliant analogies, and speaks clearly and friendly.
5. Ensure that Jane's expert explanations and Joe's questions directly address the core technical or conceptual details of the user's prompt in high fidelity.
6. Keep turns punchy and natural (approx 15-40 words per turn).
7. Output strictly in JSON format matching the schema provided. No conversational wrapper or markdown fences.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            format: { type: Type.STRING, description: "Must be 'podcast'" },
            turns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING, description: "Must be 'host' or 'guest'" },
                  text: { type: Type.STRING },
                },
                required: ["speaker", "text"],
              },
            },
          },
          required: ["title", "format", "turns"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No podcast generated from Gemini");
    }

    res.json(JSON.parse(text));
  } catch (error: any) {
    console.error("Error generating podcast script with Gemini:", error);
    res.status(500).json({ error: `Failed to generate podcast script. Gemini API reported: ${error.message || error}. Please ensure your API Key is correctly configured in the settings menu or try again shortly.` });
  }
});

// Text-to-Speech API proxying Gemini TTS with WAV headers
app.post("/api/generate-speech", async (req, res) => {
  try {
    const { text, voice, languageCode } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const voiceName = voice || "Kore";
    const lang = languageCode || "en-IN";

    const LANGUAGE_GUIDANCE: Record<string, string> = {
      "en-IN": "Speak in natural, warm, conversational Indian English with correct pronunciation and pacing.",
      "hi-IN": "Speak in natural, fluent, native Hindi (हिन्दी) with a warm Indian accent, correct pronunciation, and proper pacing. Please pronounce Devanagari characters accurately.",
      "ta-IN": "Speak in natural, fluent, native Tamil (தமிழ்) with proper accent, correct pronunciation, and pacing.",
      "te-IN": "Speak in natural, fluent, native Telugu (తెలుగు) with proper accent, correct pronunciation, and pacing.",
      "bn-IN": "Speak in natural, fluent, native Bengali (বাংলা) with proper accent, correct pronunciation, and pacing.",
      "mr-IN": "Speak in natural, fluent, native Marathi (मराठी) with proper accent, correct pronunciation, and pacing.",
      "ml-IN": "Speak in natural, fluent, native Malayalam (മലയാളം) with proper accent, correct pronunciation, and pacing.",
      "gu-IN": "Speak in natural, fluent, native Gujarati (ગુજરાતી) with proper accent, correct pronunciation, and pacing."
    };

    const sysInstruction = LANGUAGE_GUIDANCE[lang] || LANGUAGE_GUIDANCE["en-IN"];

    const response = await retryWithBackoff(() =>
      getAI().models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ role: "user", parts: [{ text: text }] }],
        config: {
          systemInstruction: sysInstruction,
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      }),
      1, // Max 1 retry for TTS
      1000 // 1 second initial delay
    );

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      console.error("Gemini TTS response lacked inline audio data.");
      throw new Error("Failed to generate voice narration");
    }

    // Convert raw PCM buffer and prepend WAV header
    const pcmBuffer = Buffer.from(base64Audio, "base64");
    const wavBuffer = addWavHeader(pcmBuffer, 24000);

    res.json({ audio: wavBuffer.toString("base64") });
  } catch (error: any) {
    console.error("Error generating speech:", error);
    res.status(500).json({ error: error.message || "Failed to generate speech" });
  }
});

// Analytics Dashboard metrics live aggregation endpoint using Firestore
app.get("/api/analytics-metrics", async (req, res) => {
  try {
    const explainersCol = collection(db, "explainers");
    const snapshot = await getDocs(explainersCol);
    const explainers: any[] = [];
    snapshot.forEach((doc) => {
      explainers.push({ id: doc.id, ...doc.data() });
    });

    const totalCreations = explainers.length;
    // Sum total views (using views field from docs, default 0 if undefined)
    const totalViews = explainers.reduce((sum, exp) => sum + (exp.views || 0), 0);
    // Average duration
    const totalDuration = explainers.reduce((sum, exp) => sum + (exp.duration || 0), 0);
    const averageDurationSeconds = totalCreations > 0 ? Math.round(totalDuration / totalCreations) : 0;

    // Remaining Quota derivation (remaining from 20 creations per day)
    const todayStr = new Date().toDateString();
    const createdToday = explainers.filter(exp => {
      const date = exp.createdAt ? new Date(exp.createdAt) : new Date();
      return date.toDateString() === todayStr;
    }).length;
    const remainingQuota = Math.max(0, 20 - createdToday);

    // Active Users calculation (count unique creatorIds/emails or fallback to unique usernames)
    const uniqueCreators = new Set(explainers.map(exp => exp.creatorId || exp.creatorEmail || exp.creatorName).filter(Boolean));
    const activeUsers = Math.max(1, uniqueCreators.size);

    // Weekly activity
    // Days bucket: Mon, Tue, Wed, Thu, Fri, Sat, Sun
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyMap: { [key: string]: { videos: number; podcasts: number } } = {
      "Mon": { videos: 0, podcasts: 0 },
      "Tue": { videos: 0, podcasts: 0 },
      "Wed": { videos: 0, podcasts: 0 },
      "Thu": { videos: 0, podcasts: 0 },
      "Fri": { videos: 0, podcasts: 0 },
      "Sat": { videos: 0, podcasts: 0 },
      "Sun": { videos: 0, podcasts: 0 },
    };

    // Filter explainers created in the last 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentExplainers = explainers.filter(exp => (exp.createdAt || 0) >= sevenDaysAgo);
    
    recentExplainers.forEach(exp => {
      const date = new Date(exp.createdAt || Date.now());
      const dayName = daysOfWeek[date.getDay()];
      if (weeklyMap[dayName]) {
        if (exp.format === "video") {
          weeklyMap[dayName].videos++;
        } else {
          weeklyMap[dayName].podcasts++;
        }
      }
    });

    const weeklyActivity = [
      { day: "Mon", ...weeklyMap["Mon"] },
      { day: "Tue", ...weeklyMap["Tue"] },
      { day: "Wed", ...weeklyMap["Wed"] },
      { day: "Thu", ...weeklyMap["Thu"] },
      { day: "Fri", ...weeklyMap["Fri"] },
      { day: "Sat", ...weeklyMap["Sat"] },
      { day: "Sun", ...weeklyMap["Sun"] },
    ];

    // Format breakdown
    const totalVideos = explainers.filter(exp => exp.format === "video").length;
    const totalPodcasts = explainers.filter(exp => exp.format === "podcast" || exp.format === "audio").length;
    const formatBreakdown = [
      { name: "Explainer Videos", value: totalVideos },
      { name: "Podcast Dialogues", value: totalPodcasts },
    ];

    // Language breakdown
    const languageCounts: { [key: string]: number } = {};
    explainers.forEach(exp => {
      const lang = exp.language || "en-IN";
      languageCounts[lang] = (languageCounts[lang] || 0) + 1;
    });
    // Map lang codes to human names or keep as codes, let's map them beautifully
    const langNames: { [key: string]: string } = {
      "en-IN": "English (India)",
      "hi-IN": "Hindi",
      "ta-IN": "Tamil",
      "te-IN": "Telugu",
      "bn-IN": "Bengali",
    };
    const languageBreakdown = Object.entries(languageCounts).map(([lang, count]) => ({
      language: langNames[lang] || lang,
      count
    })).sort((a, b) => b.count - a.count).slice(0, 5);

    // Style distribution
    const styleCounts: { [key: string]: number } = {};
    explainers.forEach(exp => {
      const style = exp.style || "Simple";
      styleCounts[style] = (styleCounts[style] || 0) + 1;
    });
    const styleBreakdownNames: { [key: string]: string } = {
      "simple": "Simple & Friendly",
      "academic": "Deep Academic",
      "metaphorical": "Metaphorical Story",
      "news": "Breaking News Report",
    };
    const styleDistribution = Object.entries(styleCounts).map(([style, count]) => ({
      styleName: styleBreakdownNames[style] || style,
      count
    }));

    // Voice Engine Usage
    // We can count how many use "browser" vs "api" or default
    const voiceEngineUsage = [
      { engine: "Browser Engine (Free)", count: explainers.filter(exp => exp.voiceEngine !== "api").length },
      { engine: "Gemini AI Voice (Quota)", count: explainers.filter(exp => exp.voiceEngine === "api").length },
    ];

    res.json({
      metrics: {
        totalCreations,
        totalViews,
        averageDurationSeconds,
        remainingQuota,
        quotaMax: 20,
        activeUsers,
      },
      weeklyActivity,
      formatBreakdown,
      languageBreakdown,
      styleDistribution,
      voiceEngineUsage,
    });
  } catch (err: any) {
    console.error("Failed to query real analytics:", err);
    res.status(500).json({ error: err.message || "Failed to retrieve live analytics" });
  }
});

const upload = multer({ storage: multer.memoryStorage() });
 
// Parse article content from a public URL using actual scraping
app.post("/api/parse-url", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const scrapedText = await resolveUrlContent(url);
    
    // Summarize scraped content using Gemini
    const response = await generateAIContent({
      model: "gemini-3.1-flash-lite",
      contents: `You are an expert educator. Based on the following source document text extracted from the URL, provide a comprehensive, structured educational article/summary. Retain all core facts, key definitions, equations, and structures.

Source Content:
${scrapedText}

Provide an elegant, structured summary in plain text.`,
    });

    res.json({ text: response.text || scrapedText });
  } catch (error: any) {
    console.error("Error parsing URL:", error);
    res.status(500).json({ error: error.message || "Failed to extract content from URL" });
  }
});

// Parse document content
app.post("/api/parse-document", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { buffer, mimetype } = req.file;
    let text = "";

    if (mimetype === "application/pdf") {
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
      const parsedResult: any = await officeparser.parseOffice(buffer);
      text = typeof parsedResult === "string" ? parsedResult : (parsedResult?.text || String(parsedResult));
    } else {
        text = buffer.toString("utf-8");
    }
    
    res.json({ text });
  } catch (error: any) {
    console.error("Error parsing document:", error);
    res.status(500).json({ error: error.message || "Failed to parse document" });
  }
});

// Clarify Doubt Q&A endpoint
app.post("/api/ask-doubt", express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { topic, question, context } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const prompt = `You are Vyakhya, an elite academic advisor. Clarify the student's doubt with absolute clarity, using intuitive metaphors, clear step-by-step logic, and supportive tone.

Topic: ${topic || "General learning topic"}
Context (e.g. explainer transcript/script): ${context || "None provided"}
Student's question: ${question}

Provide an elegant, structured, clear markdown response explaining the answer perfectly to the student. Use markdown headers, bold keywords, bullet points, and codeblocks where relevant.`;

    const response = await generateAIContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
    });

    res.json({ answer: response.text });
  } catch (error: any) {
    console.warn("Error clarifying doubt with Gemini, activating dynamic robust fallback:", error);
    try {
      const { topic, question } = req.body;
      const fallbackText = generateFallbackDoubt(topic, question);
      res.json({ answer: fallbackText });
    } catch (fallbackError: any) {
      res.status(500).json({ error: error.message || "Failed to clarify doubt" });
    }
  }
});

// Dynamic Quiz generation endpoint
app.post("/api/generate-quiz", express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { topic, context } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const prompt = `Generate exactly 5 high-quality multiple choice questions (with 4 options each) designed to quiz the user's understanding of the following topic.

Topic: ${topic}
Context: ${context || "None"}

Ensure that the options are challenging and educational. Provide a detailed, highly supportive explanation of why the correct option is right and others are wrong. Return the questions in JSON format matching the schema requested.`;

    const response = await generateAIContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "An array of exactly 5 multiple choice questions.",
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: "The multiple choice question text." },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Exactly 4 options for answers."
              },
              correctIndex: { type: Type.INTEGER, description: "0-based index of the correct option (0, 1, 2, or 3)." },
              explanation: { type: Type.STRING, description: "Encouraging, clear explanation of the correct answer and feedback." }
            },
            required: ["question", "options", "correctIndex", "explanation"]
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("No quiz data generated from Gemini");
    }

    res.json(JSON.parse(jsonText));
  } catch (error: any) {
    console.error("Error generating quiz with Gemini:", error);
    res.status(500).json({ error: `Failed to generate quiz. Gemini API reported: ${error.message || error}. Please ensure your API Key is correctly configured in the settings menu or try again shortly.` });
  }
});

// Dynamic Flashcards generation endpoint
app.post("/api/generate-flashcards", express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { topic, context } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const prompt = `Generate exactly 5 distinct, high-yield study flashcards for the following topic.

Topic: ${topic}
Context: ${context || "None"}

The front of each card should pose a concise question or concept name. The back of each card should have a crisp, highly educational, easy-to-understand explanation or answer. Return the cards in JSON format matching the schema requested.`;

    const response = await generateAIContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "An array of exactly 5 educational flashcards.",
          items: {
            type: Type.OBJECT,
            properties: {
              front: { type: Type.STRING, description: "The front of the flashcard containing a brief, high-impact prompt or question." },
              back: { type: Type.STRING, description: "The back of the flashcard containing the key explanation or answer." }
            },
            required: ["front", "back"]
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("No flashcard data generated from Gemini");
    }

    res.json(JSON.parse(jsonText));
  } catch (error: any) {
    console.error("Error generating flashcards with Gemini:", error);
    res.status(500).json({ error: `Failed to generate flashcards. Gemini API reported: ${error.message || error}. Please ensure your API Key is correctly configured in the settings menu or try again shortly.` });
  }
});

// F-01: Generate real video clip using veo-3.1-lite-generate-preview
app.post("/api/generate-scene-video", express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { sceneId, visualInstruction, headline, style } = req.body;
    if (!visualInstruction) {
      return res.status(400).json({ error: "visualInstruction is required" });
    }

    const veoPrompt = `Educational explainer video scene about: "${headline || "topic"}". Visual concept: ${visualInstruction}. Clean educational animation. Minimal motion, clear composition, visual diagram style. No text overlays, no people talking to camera, no watermarks, high-quality.`;

    const ai = getAI();
    const operation = await ai.models.generateVideos({
      model: "veo-3.1-lite-generate-preview",
      prompt: veoPrompt,
      config: {
        numberOfVideos: 1,
        durationSeconds: 5, // Keep it short and fast to generate
        aspectRatio: "16:9",
        resolution: "720p"
      }
    });

    res.json({ operationName: operation.name, sceneId });
  } catch (error: any) {
    console.error("Veo generation error:", error);
    res.status(500).json({ error: error.message || "Failed to start video generation" });
  }
});

// F-01: Poll Veo status
app.get("/api/veo-status/:operationId", async (req, res) => {
  try {
    const { operationId } = req.params;
    const ai = getAI();
    const op = new GenerateVideosOperation();
    op.name = decodeURIComponent(operationId);

    const updated = await ai.operations.getVideosOperation({ operation: op });
    if (!updated.done) {
      return res.json({ status: "pending" });
    }

    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      return res.json({ status: "error", message: "No video URI returned" });
    }

    res.json({ status: "complete", uri });
  } catch (error: any) {
    console.error("Veo status check error:", error);
    res.status(500).json({ error: error.message || "Failed to check video status" });
  }
});

// F-01: Download and stream video to client
app.get("/api/video-download", async (req, res) => {
  try {
    const { uri } = req.query;
    if (!uri) {
      return res.status(400).send("URI is required");
    }

    const videoRes = await fetch(uri as string, {
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY || "" },
    });

    if (!videoRes.ok) {
      throw new Error(`Failed to fetch video stream: ${videoRes.statusText}`);
    }

    res.setHeader("Content-Type", "video/mp4");
    
    const reader = videoRes.body?.getReader();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (error: any) {
    console.error("Video stream error:", error);
    res.status(500).send(error.message || "Failed to stream video");
  }
});

// F-02: Lyria background music generation
app.post("/api/generate-soundtrack", express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { topic, style } = req.body;
    const ai = getAI();

    const styleMusics: Record<string, string> = {
      simple: "gentle upbeat lo-fi instrumental, soft piano and light percussion, warm educational vibe",
      academic: "minimal orchestral, strings and light brass, intellectual documentary feel, no percussion",
      storytelling: "cinematic narrative underscore, acoustic guitar, subtle ambient texture, emotive",
      news: "corporate news intro, clean percussion, professional tone, minimal melody",
    };

    const musicPrompt = `${styleMusics[style] || styleMusics.simple}. Topic inspiration: ${topic || "education"}. Continuous loop-friendly background music, does not distract from narration. Instrumental only, 30 seconds.`;

    let musicResponse;
    let attempts = 0;
    const MAX_ATTEMPTS = 2;

    while (attempts <= MAX_ATTEMPTS) {
      try {
        musicResponse = await ai.models.generateContent({
          model: "lyria-3-clip-preview",
          contents: musicPrompt,
        });
        break; // Success
      } catch (error: any) {
        if (error?.status === 429 && attempts < MAX_ATTEMPTS) {
          attempts++;
          // Wait for 15 seconds
          await new Promise(resolve => setTimeout(resolve, 15000));
        } else {
          throw error;
        }
      }
    }

    const response = musicResponse;

    const audioStep = response.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData?.mimeType?.startsWith("audio/")
    );

    if (!audioStep?.inlineData?.data) {
      throw new Error("No audio generated by Lyria 3 Clip");
    }

    res.json({ audioBase64: audioStep.inlineData.data, mimeType: audioStep.inlineData.mimeType });
  } catch (error: any) {
    console.error("Lyria soundtrack generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate soundtrack" });
  }
});

// F-06: Scene Thumbnail Generation using Pollinations (Open Source Image Models)
app.post("/api/generate-scene-thumbnail", express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { visualInstruction, headline, bgColor, accentColor } = req.body;
    if (!visualInstruction) {
      return res.status(400).json({ error: "visualInstruction is required" });
    }

    const prompt = `Clean flat vector style illustration. Headline: "${headline || ""}". Concept: ${visualInstruction}. Minimalist infographic vector art, solid background, clean layout. Academic vibe.`;
    const encodedPrompt = encodeURIComponent(prompt);
    
    // Pollinations AI uses open-source models (Stable Diffusion / Flux) for generation.
    // It's completely free and does not require an API key.
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=450&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
    
    const USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
  ];
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const response = await fetch(url, {
    headers: { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(15000)
  });
    if (!response.ok) {
      throw new Error(`Failed to generate image with Pollinations: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imageBase64 = buffer.toString("base64");
    
    res.json({ 
      imageBase64: imageBase64, 
      mimeType: "image/jpeg" 
    });
  } catch (error: any) {
    console.error("Image generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate scene thumbnail" });
  }
});

const trendingCache = new Map<string, { data: any, expiry: number }>();

// F-07: Grounded Trending Topics Discovery using Google Search Grounding
app.get("/api/trending-topics", async (req, res) => {
  try {
    const { domain = "Science" } = req.query;
    const domainStr = String(domain);

    // Simple in-memory cache to prevent quota exhaustion
    if (trendingCache.has(domainStr)) {
      const cached = trendingCache.get(domainStr)!;
      if (Date.now() < cached.expiry) {
        return res.json(cached.data);
      }
    }

    const response = await generateAIContent({
      model: "gemini-3.1-flash-lite",
      contents: `Find exactly 6 highly popular or trending academic topics related to "${domain}" suitable for class 6-12 Indian school students. 
Provide a catchy, educational title and a short 1-sentence hook explaining why this topic is fascinating or trending.
Also include 2-3 tags and recommend the ideal duration (short, medium, deep).
Return ONLY a raw JSON array string without Markdown formatting.
Example: [{"topic": "string", "hook": "string", "tags": ["string"], "length": "short"}]`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "text/plain"
      }
    });

    // Remove markdown code blocks if present
    const rawText = response.text || "[]";
    const cleanText = rawText.replace(/^```json/m, '').replace(/^```/m, '').trim();
    const parsedData = JSON.parse(cleanText);
    
    // Cache for 60 minutes
    trendingCache.set(domainStr, { data: parsedData, expiry: Date.now() + 1000 * 60 * 60 });
    
    res.json(parsedData);
  } catch (error: any) {
    // Suppress console.error if it's a rate limit error to avoid polluting logs
    if (error?.status !== "RESOURCE_EXHAUSTED" && error?.status !== 429) {
      console.error("Grounded trends discovery error:", error.message || error);
    }
    
    // Hardcoded high-quality trending topics for class 6-12 Indian science / social curricula as perfect fallback
    const fallbackTrends = [
      {
        topic: "Chandrayaan 3 Moon Mission",
        hook: "Discover the spectacular engineering behind the lander's soft landing on the south pole of the Moon.",
        tags: ["Space Science", "Physics", "ISRO"],
        length: "medium",
      },
      {
        topic: "How Photosynthesis Works",
        hook: "The biological machinery that keeps every living organism on Earth alive using sunlight.",
        tags: ["Biology", "Botany", "NCERT Class 10"],
        length: "short",
      },
      {
        topic: "Sinking Towns & Land Subsidence",
        hook: "Understanding the geological instability causing structural hazards in cities like Joshimath.",
        tags: ["Geology", "Environment", "Geography"],
        length: "deep",
      },
      {
        topic: "Generative AI and Large Language Models",
        hook: "How computers are learning to understand human sentences and produce realistic creative content.",
        tags: ["Computer Science", "Technology", "Future"],
        length: "medium",
      },
    ];
    res.json(fallbackTrends);
  }
});

// F-05: Multimodal Textbook page or diagram upload to Script
app.post("/api/generate-script-from-image", express.json({ limit: "20mb" }), async (req, res) => {
  try {
    const { imageBase64, mimeType, language, style, length } = req.body;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: "imageBase64 and mimeType are required" });
    }

    const lenLabel = length || "short";
    const durationMap: Record<string, string> = {
      short: "1 minute",
      medium: "3 minutes",
      deep: "5 minutes"
    };
    const durationLabel = durationMap[lenLabel] || "1 minute";

    let sceneGuidance = "";
    if (lenLabel === "medium") {
      sceneGuidance = "CRITICAL: The user requested a 3-minute video. You MUST generate between 20 and 30 scenes. Ensure the sum of 'duration_seconds' across all scenes exactly equals roughly 180 seconds, and the total narration word count should be around 400-500 words to prevent content compression.";
    } else if (lenLabel === "deep") {
      sceneGuidance = "CRITICAL: The user requested a 5-minute video. You MUST generate between 40 and 50 scenes. Ensure the sum of 'duration_seconds' across all scenes exactly equals roughly 300 seconds, and the total narration word count should be around 700-800 words to prevent content compression.";
    } else {
      sceneGuidance = "CRITICAL: The user requested a 1-minute video. Generate 8-12 scenes, with around 150 words total narration and sum of 'duration_seconds' exactly roughly 60 seconds.";
    }

    const ai = getAI();
    const prompt = `You are an expert curriculum educator for Vyakhya.
Analyze the uploaded image (e.g. textbook page, diagram, equation, chart, or laboratory sketch).
Generate a complete, highly structured educational explainer video script explaining the concepts shown in this image from first principles.
The script must be in ${language || "English"}.
The tone should be ${style || "simple"}.
Duration Target: ${durationLabel}.
${sceneGuidance}
Provide exactly the required number of scenes to match the duration.
Return strictly JSON format matching the schema provided. No markdown code blocks or wrapper text.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          }
        },
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            language: { type: Type.STRING },
            style: { type: Type.STRING },
            duration_breakdown: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array explicitly mapping video sections to exact time intervals to guarantee duration"
            },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["title_card", "concept_split", "bullet_reveal", "analogy_card", "data_stat", "timeline", "quote_card", "summary_card"] },
                  headline: { type: Type.STRING },
                  narration: { type: Type.STRING },
                  visual_instruction: { type: Type.STRING },
                  duration_seconds: { type: Type.INTEGER },
                  bg_color: { type: Type.STRING, description: "A dark hex color (e.g., #022c22, #0c0a09, #0b1329) matching the scene mood." },
                  accent_color: { type: Type.STRING, description: "A vibrant accent hex color (e.g., #10b981, #38bdf8, #f43f5e) for highlighting keys." },
                  left_label: { type: Type.STRING, description: "For concept_split: left pane text" },
                  right_label: { type: Type.STRING, description: "For concept_split: right pane text" },
                  bullets: { type: Type.ARRAY, items: { type: Type.STRING }, description: "For bullet_reveal: up to 3 points" },
                  analogy_text: { type: Type.STRING, description: "For analogy_card" },
                  stat_value: { type: Type.STRING, description: "For data_stat (e.g. 78%)" },
                  stat_label: { type: Type.STRING, description: "For data_stat (e.g. Earth's Nitrogen)" },
                  steps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "For timeline: chronological steps" },
                  quote_text: { type: Type.STRING, description: "For quote_card" },
                  quote_attribution: { type: Type.STRING, description: "For quote_card" },
                },
                required: ["id", "type", "headline", "narration", "visual_instruction", "duration_seconds", "bg_color", "accent_color"],
              },
            },
            total_duration_seconds: { type: Type.INTEGER },
          },
          required: ["title", "language", "style", "scenes", "total_duration_seconds"],
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Multimodal script generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate script from image textbook" });
  }
});

// F-04: Index explainer embedding
app.post("/api/index-explainer", express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { explainerId, title, topic, scenes, turns, language } = req.body;
    if (!explainerId) {
      return res.status(400).json({ error: "explainerId is required" });
    }

    const ai = getAI();
    const contentForEmbedding = [
      `Title: ${title || ""}`,
      `Topic: ${topic || ""}`,
      `Language: ${language || ""}`,
      ...(scenes || []).map((s: any, i: number) => `Scene ${i+1} [${s.type}]: ${s.headline}. ${s.narration}`),
      ...(turns || []).map((t: any) => `[${t.speaker}]: ${t.text}`),
    ].join("\n");

    const embeddingResponse = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: contentForEmbedding,
    });

    const vector = embeddingResponse.embeddings?.[0]?.values;
    if (!vector) {
      throw new Error("No embedding values generated");
    }

    const docRef = doc(db, "explainer_embeddings", explainerId);
    await setDoc(docRef, {
      explainerId,
      title: title || "",
      topic: topic || "",
      language: language || "",
      vector,
      createdAt: Date.now(),
    });

    res.json({ indexed: true });
  } catch (error: any) {
    console.error("Embedding indexing error:", error);
    res.status(500).json({ error: error.message || "Failed to index explainer embedding" });
  }
});

// F-04: Semantic Search
app.post("/api/semantic-search", express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const ai = getAI();
    const queryEmbedding = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: query,
    });

    const queryVector = queryEmbedding.embeddings?.[0]?.values;
    if (!queryVector) {
      throw new Error("Failed to compute query embedding");
    }

    const snapshot = await getDocs(collection(db, "explainer_embeddings"));
    const results: any[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.vector) {
        const similarity = cosineSimilarity(queryVector, data.vector);
        results.push({
          explainerId: data.explainerId,
          title: data.title,
          topic: data.topic,
          language: data.language,
          similarity,
        });
      }
    });

    results.sort((a, b) => b.similarity - a.similarity);
    res.json({ results: results.slice(0, 10) });
  } catch (error: any) {
    console.error("Semantic search error:", error);
    res.status(500).json({ error: error.message || "Failed to execute semantic search" });
  }
});

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Set up WebSocket server for F-03 Live tutor
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", async (clientWs, req) => {
  try {
    const urlObj = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const contextScript = urlObj.searchParams.get("context") || "";
    const language = urlObj.searchParams.get("language") || "en-IN";
    const languageMap: Record<string, string> = {
      "en-IN": "English",
      "hi-IN": "Hindi",
      "ta-IN": "Tamil",
      "te-IN": "Telugu",
      "bn-IN": "Bengali",
      "mr-IN": "Marathi",
      "ml-IN": "Malayalam",
      "gu-IN": "Gujarati"
    };
    const targetLanguageName = languageMap[language] || "English";

    const ai = getAI();
    const session = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: ["AUDIO" as any],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Kore",
            }
          }
        },
        systemInstruction: `You are Vya, an expert tutor who just narrated a highly educational lesson to this student.
You speak naturally, warmly, and encouragingly in ${targetLanguageName} using its natural script. Use locally natural greetings and idioms — do not force English conventions.
The lesson script you narrated is:
---
${contextScript.slice(0, 5000)}
---
Help the student by explaining concepts further, answering questions about this lesson, or providing simple analogies.
Always answer the student's spoken questions about this content in ${targetLanguageName}. Keep your spoken answers under 3 concise sentences. Be extremely warm and helpful.`
      },
      callbacks: {
        onmessage: (message: any) => {
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio) {
            clientWs.send(JSON.stringify({ type: "audio", data: audio, mimeType: "audio/pcm;rate=24000" }));
          }
          const text = message.serverContent?.modelTurn?.parts?.[0]?.text;
          if (text) {
            clientWs.send(JSON.stringify({ type: "transcript", text }));
          }
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ type: "interrupted" }));
          }
        }
      }
    });

    clientWs.on("message", (data) => {
      try {
        session.sendRealtimeInput({
          audio: { data: data.toString("base64"), mimeType: "audio/pcm;rate=16000" }
        });
      } catch (err) {
        console.error("Error sending realtime input to Gemini Live:", err);
      }
    });

    clientWs.on("close", () => {
      try {
        session.close();
      } catch (err) {}
    });
  } catch (error: any) {
    console.error("Gemini Live connection error:", error);
    clientWs.send(JSON.stringify({ type: "error", message: error.message || "Failed to initialize Live Voice Tutor session." }));
    clientWs.close();
  }
});

// Upgrade handler to route WebSocket requests
server.on("upgrade", (request, socket, head) => {
  const urlObj = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
  if (urlObj.pathname === "/api/live-tutor") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Start server function handling Vite environment routing
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();
