import React, { useState, useEffect } from "react";
import { HashRouter as Router, Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import Navbar from "./components/Navbar";
import CreationForm from "./components/CreationForm";
import DiscoverFeed from "./components/DiscoverFeed";
import WatchPage from "./components/WatchPage";
import LibraryPage from "./components/LibraryPage";
import NameModal from "./components/NameModal";
import InteractiveHub from "./components/InteractiveHub";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { auth, db } from "./lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { Sparkles, Brain, Mic, Film, CheckCircle2, AlertCircle, ArrowRight, Compass, Pencil, Plus, Trash2, ArrowUp, ArrowDown, Check, Save, RotateCcw, Clock, Eye } from "lucide-react";
import { Scene, Explainer, PodcastTurn, LANGUAGES } from "./types";

// Create QueryClient instance for TanStack Query integration
const queryClient = new QueryClient();

// 1. HOME / STUDIO PAGE (Left Input, Right Info, Bottom Feed)
function StudioPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (formData: any) => {
    setIsLoading(true);
    // Create unique identifier for the job
    const jobId = `job_${Math.random().toString(36).substring(2, 11)}`;
    
    // Direct trigger to Progress tracker carrying state parameters
    navigate(`/create/${jobId}`, {
      state: { ...formData },
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* Hero Tagline */}
        <div className="text-center max-w-2xl mx-auto py-6 select-none">
          <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider font-mono">
            Vibe-Coded Multilingual Explanation Engine
          </span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-zinc-100 tracking-tight mt-4 leading-snug">
            Confused by a complex topic? <br />
            Meet Vyakhya, simple, animated explainers in <span className="text-indigo-500">60 seconds</span>.
          </h1>
          <p className="text-sm sm:text-base text-zinc-500 mt-3 leading-relaxed">
            Vyakhya parses dense topics, generates scripts via Gemini Flash, narrates in regional Indian accents, and draws visual animations automatically.
          </p>
        </div>

        {/* Bentogrid split form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7">
            <CreationForm 
              onSubmit={handleCreate} 
              isLoading={isLoading} 
              initialTopic={state?.topic} 
              initialLength={state?.length} 
            />
          </div>

          <div className="lg:col-span-5 h-full space-y-6">
            {/* Visual guide card */}
            <div className="bg-gradient-to-br from-indigo-950/20 to-zinc-950 border border-indigo-900/30 rounded-2xl p-6 sm:p-8 flex flex-col justify-between h-full shadow-lg select-none">
              <div className="space-y-4">
                <span className="text-[11px] font-bold uppercase font-mono tracking-widest text-indigo-400">Vyakhya Pipeline</span>
                <h3 className="text-xl font-bold text-zinc-100 leading-tight">Dynamic AI-Generated Vector Stages</h3>
                
                <div className="space-y-3.5 pt-2">
                  <div className="flex gap-3 items-start">
                    <div className="bg-indigo-600/10 text-indigo-400 p-1.5 rounded-lg border border-indigo-500/10 font-bold text-xs">01</div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-300">Gemini Scriptwriting</h4>
                      <p className="text-[11px] text-zinc-500 leading-normal">Transforms topic input into bullet-reveals, analogies, or timelines based on scientific guidelines.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="bg-indigo-600/10 text-indigo-400 p-1.5 rounded-lg border border-indigo-500/10 font-bold text-xs">02</div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-300">Multilingual Narration Accents</h4>
                      <p className="text-[11px] text-zinc-500 leading-normal">Narration scripts sent to Gemini text-to-speech to play in English, Hindi, Tamil, and Bengali.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="bg-indigo-600/10 text-indigo-400 p-1.5 rounded-lg border border-indigo-500/10 font-bold text-xs">03</div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-300">Interactive Canvas Renderer</h4>
                      <p className="text-[11px] text-zinc-500 leading-normal">Vector timelines, charts, and diagrams rendered in real-time, matching narration audio perfectly.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-900 pt-6 mt-8 flex justify-between items-center text-xs text-zinc-500">
                <span>Free Tier quota: 5 generations / day</span>
                <span className="flex items-center gap-1 hover:text-zinc-300 cursor-pointer">
                  Learn how it works <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Practice & Doubt Hub (Standalone Mode) */}
        <div className="border-t border-zinc-900/60 pt-10">
          <div className="flex items-center gap-2 mb-6 select-none">
            <Brain className="w-5 h-5 text-indigo-500 animate-pulse" />
            <h2 className="text-lg font-extrabold text-zinc-200 uppercase tracking-wider">Unlimited Practice & Doubt Hub</h2>
          </div>
          <InteractiveHub isStandalone={true} />
        </div>

        {/* Discovery Feed panel */}
        <div className="border-t border-zinc-900/60 pt-10">
          <div className="flex items-center gap-2 mb-6">
            <Compass className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-extrabold text-zinc-200 uppercase tracking-wider">Explore Public Curation</h2>
          </div>
          <DiscoverFeed />
        </div>
      </div>
    </div>
  );
}

// Helper function for API retries to gracefully handle rate limits/quota
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 1500): Promise<Response> {
  let res: Response | null = null;
  for (let i = 0; i < retries; i++) {
    res = await fetch(url, options);
    // If it's a 429 Too Many Requests or 503 Service Unavailable, retry
    if (res.status === 429 || res.status === 503 || res.status === 500) {
      if (i < retries - 1) {
        console.warn(`API ${res.status} error, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        backoff *= 2; // Exponential backoff
        continue;
      }
    }
    break; // Break if success or we reached last retry
  }
  
  if (res && res.status === 429) {
    throw new Error("Quota Exceeded / Rate Limit Reached: The Gemini API is currently receiving too many requests or you have exhausted your quota. Please try again later or configure your API key.");
  }
  return res!;
}

// Helper function to split long narration/dialogue paragraphs into sentence/clause-level chunks
function splitTextIntoSentenceChunks(text: string, maxWords = 15): string[] {
  // Split by common punctuation but preserve them
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    const currentWordCount = currentChunk ? currentChunk.split(/\s+/).length : 0;
    const sentenceWordCount = trimmed.split(/\s+/).length;

    if (currentWordCount + sentenceWordCount <= maxWords) {
      currentChunk = currentChunk ? `${currentChunk} ${trimmed}` : trimmed;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      // If a single sentence is extremely long, split it by clauses/commas or words
      if (sentenceWordCount > maxWords) {
        const subClauses = trimmed.split(/[,;:]+/);
        let subChunk = "";
        for (const clause of subClauses) {
          const trimmedClause = clause.trim();
          const subWordCount = subChunk ? subChunk.split(/\s+/).length : 0;
          const clauseWordCount = trimmedClause.split(/\s+/).length;
          
          if (subWordCount + clauseWordCount <= maxWords) {
            subChunk = subChunk ? `${subChunk}, ${trimmedClause}` : trimmedClause;
          } else {
            if (subChunk) chunks.push(subChunk);
            
            if (clauseWordCount > maxWords) {
              const words = trimmedClause.split(/\s+/);
              let temp = "";
              for (const word of words) {
                if ((temp ? temp.split(/\s+/).length : 0) >= maxWords) {
                  chunks.push(temp);
                  temp = word;
                } else {
                  temp = temp ? `${temp} ${word}` : word;
                }
              }
              if (temp) subChunk = temp;
            } else {
              subChunk = trimmedClause;
            }
          }
        }
        if (subChunk) {
          currentChunk = subChunk;
        } else {
          currentChunk = "";
        }
      } else {
        currentChunk = trimmed;
      }
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  return chunks;
}

// Enhances speech/video cadence by ensuring narration is split into smaller, time-aligned chunks
function optimizeScriptCadence(scenes: Scene[]): Scene[] {
  const optimized: Scene[] = [];
  
  for (const scene of scenes) {
    const text = scene.narration;
    const words = text.split(/\s+/).filter(Boolean);
    const originalDuration = scene.duration_seconds || 5;
    
    if (words.length <= 20) {
      optimized.push({
        ...scene,
        duration_seconds: originalDuration,
      });
      continue;
    }
    
    // Split long text into chunks
    const chunks = splitTextIntoSentenceChunks(text, 15);
    
    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunkText = chunks[chunkIdx];
      const chunkWords = chunkText.split(/\s+/).filter(Boolean).length;
      
      // Proportionally distribute the original generated duration
      const durationRatio = chunkWords / Math.max(1, words.length);
      const chunkDuration = Math.max(3.0, Math.round(originalDuration * durationRatio * 10) / 10);
      
      const partSuffix = chunks.length > 1 ? ` (${chunkIdx + 1}/${chunks.length})` : "";
      
      // Proportional bullet/steps reveals to align with chunk segments
      let currentBullets = scene.bullets;
      if (scene.type === "bullet_reveal" && scene.bullets && scene.bullets.length > 0) {
        const bulletCount = scene.bullets.length;
        const bulletsPerChunk = Math.ceil(bulletCount / chunks.length);
        const limit = Math.min(bulletCount, (chunkIdx + 1) * bulletsPerChunk);
        currentBullets = scene.bullets.slice(0, limit);
      }
      
      let currentSteps = scene.steps;
      if (scene.type === "timeline" && scene.steps && scene.steps.length > 0) {
        const stepCount = scene.steps.length;
        const stepsPerChunk = Math.ceil(stepCount / chunks.length);
        const limit = Math.min(stepCount, (chunkIdx + 1) * stepsPerChunk);
        currentSteps = scene.steps.slice(0, limit);
      }
      
      optimized.push({
        ...scene,
        id: `${scene.id}_chunk_${chunkIdx}`,
        headline: chunkIdx === 0 ? scene.headline : `${scene.headline}${partSuffix}`,
        narration: chunkText,
        duration_seconds: chunkDuration,
        bullets: currentBullets,
        steps: currentSteps,
      });
    }
  }
  
  return optimized;
}

function optimizePodcastCadence(turns: PodcastTurn[]): PodcastTurn[] {
  const optimized: PodcastTurn[] = [];
  
  for (const turn of turns) {
    const text = turn.text;
    const words = text.split(/\s+/).filter(Boolean);
    
    if (words.length <= 22) {
      optimized.push(turn);
      continue;
    }
    
    const chunks = splitTextIntoSentenceChunks(text, 16);
    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      optimized.push({
        ...turn,
        text: chunks[chunkIdx],
      });
    }
  }
  
  return optimized;
}

// 2. GENERATION PROGRESS TRACKING PAGE
function ProgressPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { state } = useLocation();

  const [currentStage, setCurrentStage] = useState<"scripting" | "reviewing" | "narrating" | "compiling" | "error">("scripting");
  const [showPreview, setShowPreview] = useState(false);
  const [progress, setProgress] = useState(10);
  const [logText, setLogText] = useState("Initializing understanding nodes...");
  const [errorText, setErrorText] = useState("");

  const [scriptDataState, setScriptDataState] = useState<any>(null);
  const [reviewedTitle, setReviewedTitle] = useState<string>("");
  const [reviewedScenes, setReviewedScenes] = useState<Scene[]>([]);
  const [reviewedTurns, setReviewedTurns] = useState<PodcastTurn[]>([]);

  useEffect(() => {
    let active = true;
    const triggerGeneration = async () => {
      if (!state) {
        setErrorText("Missing creation configurations.");
        setCurrentStage("error");
        return;
      }

      const { topic, language, style, length, format, documentText, url, imageBase64, mimeType } = state;

      try {
        // --- STAGE 1: Scripting ---
        setLogText(imageBase64 ? "Calling Gemini to analyze textbook diagram and draft script..." : "Calling Gemini Flash model to draft scripts...");
        setProgress(25);

        let scriptResponse;
        if (imageBase64 && mimeType) {
          scriptResponse = await fetchWithRetry("/api/generate-script-from-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64, mimeType, language, style, length }),
          });
        } else {
          scriptResponse = await fetchWithRetry(format === "video" ? "/api/generate-script" : "/api/generate-podcast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, language, style, length, documentText, url }),
          });
        }

        if (!scriptResponse.ok) {
          const errData = await scriptResponse.json();
          throw new Error(errData.error || "Script scripting failed");
        }

        const scriptData = await scriptResponse.json();
        
        if (!active) return;
        
        setLogText("Analyzing narration script and optimizing visual cadence...");
        
        if (format === "video") {
          scriptData.scenes = optimizeScriptCadence(scriptData.scenes || []);
        } else {
          scriptData.turns = optimizePodcastCadence(scriptData.turns || []);
        }

        setLogText("Script parsed successfully. Ready for your review.");
        setScriptDataState(scriptData);
        setReviewedTitle(scriptData.title || `Detailed Explainer of ${topic}`);
        if (format === "video") {
          setReviewedScenes(scriptData.scenes || []);
        } else {
          setReviewedTurns(scriptData.turns || []);
        }
        setProgress(35);
        setCurrentStage("reviewing");
      } catch (err: any) {
        if (!active) return;
        console.error("Pipeline failure in Stage 1 scripting:", err);
        let errorMsg = err.message || "Failed to compile the video script.";
        if (errorMsg.toLowerCase().includes("failed to fetch")) {
          errorMsg = "Network error: Failed to connect to the backend server. Please check your internet connection, verify that the dev server is active, and ensure that your GEMINI_API_KEY is configured in the Settings.";
        }
        setErrorText(errorMsg);
        setCurrentStage("error");
      }
    };

    triggerGeneration();
    return () => {
      active = false;
    };
  }, [jobId]);

  const handleUpdateScene = (index: number, key: keyof Scene, value: any) => {
    setReviewedScenes((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const handleUpdateSceneBullets = (index: number, valStr: string) => {
    const list = valStr.split("\n").map(s => s.trim()).filter(Boolean);
    handleUpdateScene(index, "bullets", list);
  };

  const handleUpdateSceneSteps = (index: number, valStr: string) => {
    const list = valStr.split("\n").map(s => s.trim()).filter(Boolean);
    handleUpdateScene(index, "steps", list);
  };

  const handleUpdateTurn = (index: number, key: keyof PodcastTurn, value: any) => {
    setReviewedTurns((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const handleAddScene = () => {
    const newScene: Scene = {
      id: `scene_custom_${Date.now()}`,
      type: "title_card",
      headline: "Custom Slide",
      narration: "Enter narration script segment here.",
      visual_instruction: "Describe custom illustration or chart guides here.",
      duration_seconds: 7,
      bg_color: "#0f172a",
      accent_color: "#4f46e5",
    };
    setReviewedScenes((prev) => [...prev, newScene]);
  };

  const handleAddTurn = () => {
    const newTurn: PodcastTurn = {
      speaker: "host",
      text: "Enter dialogue segment text here.",
    };
    setReviewedTurns((prev) => [...prev, newTurn]);
  };

  const handleDeleteScene = (index: number) => {
    if (reviewedScenes.length <= 1) {
      alert("An explainer must have at least one scene!");
      return;
    }
    setReviewedScenes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteTurn = (index: number) => {
    if (reviewedTurns.length <= 1) {
      alert("A podcast must have at least one dialogue turn!");
      return;
    }
    setReviewedTurns((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveScene = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= reviewedScenes.length) return;
    setReviewedScenes((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[nextIndex];
      copy[nextIndex] = temp;
      return copy;
    });
  };

  const handleMoveTurn = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= reviewedTurns.length) return;
    setReviewedTurns((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[nextIndex];
      copy[nextIndex] = temp;
      return copy;
    });
  };

  const handleApproveAndSynthesize = async () => {
    if (!state) return;
    const { topic, language, style, length, format, voiceEngine = "browser" } = state;

    setCurrentStage("narrating");
    setProgress(40);
    setLogText(voiceEngine === "browser" ? "Configuring local browser speech modules..." : "Synthesizing voice narration segments sequentially...");

    try {
      // Find prebuilt voice config for target language
      const targetLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];
      const updatedScriptData = {
        ...scriptDataState,
        title: reviewedTitle,
      };

      if (format === "video") {
        const scenesWithAudio: Scene[] = [];
        
        for (let idx = 0; idx < reviewedScenes.length; idx++) {
          const scene = reviewedScenes[idx];
          
          if (voiceEngine === "browser") {
            setLogText(`Bypassing API voice quota. Routing Scene ${idx + 1} to local speech synthesis...`);
            scenesWithAudio.push(scene);
            setProgress(40 + Math.floor(((idx + 1) / reviewedScenes.length) * 40));
            await new Promise((resolve) => setTimeout(resolve, 80)); // quick visual progress feel
            continue;
          }

          setLogText(`Generating narration audio for Scene ${idx + 1} of ${reviewedScenes.length}...`);
          try {
            const ttsResponse = await fetchWithRetry("/api/generate-speech", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: scene.narration,
                voice: idx % 2 === 0 ? targetLang.voiceHost : targetLang.voiceGuest,
              }),
            });

            if (!ttsResponse.ok) throw new Error("TTS segment failure");
            const ttsData = await ttsResponse.json();
            
            scenesWithAudio.push({ ...scene, audioUrl: ttsData.audio });
          } catch (err) {
            console.warn(`Fallback speech active for scene ${scene.id}`, err);
            scenesWithAudio.push(scene); // return scene without audio (fallback)
          }
          
          // Add progress incrementally
          const stepProgress = 40 + Math.floor((idx + 1) / reviewedScenes.length * 40);
          setProgress(Math.min(stepProgress, 80));

          // Sleep 1200ms to stay well below free tier concurrent and rate limits
          if (idx < reviewedScenes.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1200));
          }
        }

        updatedScriptData.scenes = scenesWithAudio;
      } else {
        // Podcast turns
        const turnsWithAudio: PodcastTurn[] = [];

        for (let idx = 0; idx < reviewedTurns.length; idx++) {
          const turn = reviewedTurns[idx];
          
          if (voiceEngine === "browser") {
            setLogText(`Bypassing API voice quota. Routing dialogue turn ${idx + 1} to local speech...`);
            turnsWithAudio.push(turn);
            setProgress(40 + Math.floor(((idx + 1) / reviewedTurns.length) * 40));
            await new Promise((resolve) => setTimeout(resolve, 80));
            continue;
          }

          setLogText(`Generating conversation dialogue for voice turn ${idx + 1} of ${reviewedTurns.length}...`);
          try {
            const ttsResponse = await fetchWithRetry("/api/generate-speech", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: turn.text,
                voice: turn.speaker === "host" ? targetLang.voiceHost : targetLang.voiceGuest,
              }),
            });

            if (!ttsResponse.ok) throw new Error("Podcast TTS segment failure");
            const ttsData = await ttsResponse.json();

            turnsWithAudio.push({ ...turn, audioUrl: ttsData.audio });
          } catch (err) {
            console.warn("Podcast audio fallback active for turn", idx, err);
            turnsWithAudio.push(turn);
          }

          // Add progress incrementally
          const stepProgress = 40 + Math.floor((idx + 1) / reviewedTurns.length * 40);
          setProgress(Math.min(stepProgress, 80));

          // Sleep 1200ms to stay well below free tier concurrent and rate limits
          if (idx < reviewedTurns.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1200));
          }
        }

        updatedScriptData.turns = turnsWithAudio;
      }

      // --- STAGE 2.5: Generate Immersive Soundtrack (Lyria / F-02) ---
      let soundtrackBase64 = undefined;
      try {
        setLogText("Orchestrating ambient soundtrack with Lyria...");
        const lyriaRes = await fetchWithRetry("/api/generate-soundtrack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, style }),
        });
        if (lyriaRes.ok) {
          const lyriaData = await lyriaRes.json();
          if (lyriaData.audioBase64) {
            soundtrackBase64 = `data:${lyriaData.mimeType || 'audio/wav'};base64,${lyriaData.audioBase64}`;
          }
        }
      } catch (lyriaErr) {
        console.warn("Lyria soundtrack generation skipped or failed:", lyriaErr);
      }

      // --- STAGE 3: Compiling Caching ---
      setProgress(85);
      setCurrentStage("compiling");
      setLogText("Bundling assets and caching workspace locally...");

      // Save Completed Explainer to Firestore and LocalStorage
      const explainerId = `exp_${Math.random().toString(36).substring(2, 11)}`;
      const localNickname = localStorage.getItem("vyakhya_username") || "Guest Creator";

      // Calculate total duration
      let finalDuration = 30;
      if (format === "video") {
        finalDuration = reviewedScenes.reduce((sum, s) => sum + s.duration_seconds, 0);
      } else {
        finalDuration = reviewedTurns.reduce((sum, t) => sum + Math.max(4, Math.ceil(t.text.split(/\s+/).length / 2)), 0);
      }

      const newExplainer: Explainer = {
        id: explainerId,
        title: reviewedTitle || `Detailed Explainer of ${topic}`,
        topic: topic || "Web content exploration",
        creatorId: "local_" + localNickname.toLowerCase().replace(/\s+/g, "_"),
        creatorEmail: "local_" + localNickname.toLowerCase().replace(/\s+/g, "_") + "@vyakhya.ai",
        creatorName: localNickname,
        format,
        language,
        style,
        length,
        status: "complete",
        duration: finalDuration,
        isPublic: true,
        tags: [format === "video" ? "Video" : "Podcast", targetLang.name.split(" ")[0]],
        views: 0,
        saves: 0,
        createdAt: Date.now(),
        scenes: format === "video" ? updatedScriptData.scenes : undefined,
        turns: format === "podcast" ? updatedScriptData.turns : undefined,
        soundtrackUrl: soundtrackBase64,
      };

      // Write to LocalStorage
      const localGenerations = JSON.parse(localStorage.getItem("vyakhya_generations") || "[]");
      localGenerations.unshift(newExplainer);
      localStorage.setItem("vyakhya_generations", JSON.stringify(localGenerations));

      // Write to Firestore so it immediately appears in the Discovery Feed
      try {
        await setDoc(doc(db, "explainers", explainerId), newExplainer);
        
        // F-04: Trigger background semantic indexing
        fetch("/api/index-explainer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            explainerId,
            title: newExplainer.title,
            topic: newExplainer.topic,
            scenes: newExplainer.scenes,
            turns: newExplainer.turns,
            language: newExplainer.language,
          }),
        }).catch((e) => console.warn("Embedding index error:", e));
      } catch (fireErr) {
        console.warn("Firestore write bypass:", fireErr);
      }

      setProgress(100);
      setLogText("Media generated! Redirecting to Player...");

      // Small delay to allow progress bar to load
      setTimeout(() => {
        navigate(`/watch/${explainerId}`);
      }, 800);
    } catch (err: any) {
      console.error("Pipeline failure in Stage 2/3:", err);
      let errorMsg = err.message || "Failed to compile the audio-visual output.";
      setErrorText(errorMsg);
      setCurrentStage("error");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between">
      <Navbar />

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-12">
        {currentStage === "reviewing" ? (
          <div className="w-full max-w-4xl bg-zinc-900/60 border border-zinc-850 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-4 gap-2">
              <div>
                <h2 className="text-2xl font-black text-zinc-100 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                  Pre-computation Script Review
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Fine-tune slide headers, narration timelines, and dialogues before video rendering.
                </p>
              </div>
              <div className="flex items-center gap-3 self-start sm:self-auto">
               <button
                  onClick={state?.format === "video" ? handleAddScene : handleAddTurn}
                  className="flex items-center gap-1.5 text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg font-bold transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Slide/Turn</span>
                </button>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center gap-1.5 text-xs ${showPreview ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"} border px-3 py-1.5 rounded-lg font-bold transition active:scale-95 cursor-pointer`}
                >
                  <Eye className="w-4 h-4" />
                  <span>{showPreview ? "Hide Preview" : "Show Preview"}</span>
                </button>
              </div>
            </div>

            {/* Title block */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider">Explainer Title</label>
              <input
                type="text"
                value={reviewedTitle}
                onChange={(e) => setReviewedTitle(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 focus:border-indigo-500 text-zinc-100 rounded-xl px-4 py-2 text-sm font-bold outline-none transition"
                placeholder="Enter explainer title..."
              />
            </div>

            {/* Main scrollable list of segments */}
            <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
              {state?.format === "video" ? (
                reviewedScenes.map((scene, index) => (
                  <div key={scene.id} className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 space-y-4 shadow relative group">
                    <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                      <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded">
                        Slide {index + 1} ({scene.type.replace("_", " ")})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleMoveScene(index, "up")}
                          disabled={index === 0}
                          className="p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-20 transition"
                          title="Move Slide Up"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveScene(index, "down")}
                          disabled={index === reviewedScenes.length - 1}
                          className="p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-20 transition"
                          title="Move Slide Down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteScene(index)}
                          className="p-1 text-rose-500 hover:text-rose-400 transition ml-1"
                          title="Delete Slide"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Left half: Headline and prompts */}
                      {showPreview ? (
                         <div className="flex flex-col items-center justify-center p-4 bg-zinc-950 border border-zinc-800 rounded-lg text-center gap-2">
                           <div className="text-zinc-600"><Sparkles className="w-10 h-10" /></div>
                           <p className="text-xs text-zinc-400 font-mono italic break-words w-full">Mockup for: {scene.image_description || "Visual illustration placeholder"}</p>
                         </div>
                      ) : (
                        <div className="space-y-3 flex flex-col">
                          <div>
                            <label className="text-[11px] font-mono text-zinc-400">Slide Headline</label>
                            <textarea
                              value={scene.headline}
                              onChange={(e) => handleUpdateScene(index, "headline", e.target.value)}
                              rows={2}
                              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-1.5 text-xs font-medium outline-none mt-1 focus:border-indigo-500 break-words resize-none"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-mono text-zinc-400">Visual Illustration prompt</label>
                            <textarea
                              value={scene.visual_instruction}
                              onChange={(e) => handleUpdateScene(index, "visual_instruction", e.target.value)}
                              rows={2}
                              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-1.5 text-xs outline-none mt-1 focus:border-indigo-500 text-zinc-300 break-words resize-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-auto">
                            <div>
                              <label className="text-[11px] font-mono text-zinc-400">Duration (s)</label>
                              <input
                                type="number"
                                min="3"
                                max="30"
                                value={scene.duration_seconds}
                                onChange={(e) => handleUpdateScene(index, "duration_seconds", Math.max(3, parseInt(e.target.value, 10) || 5))}
                                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-1 text-xs outline-none mt-1 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-mono text-zinc-400">Accent Color</label>
                              <input
                                type="text"
                                value={scene.accent_color}
                                onChange={(e) => handleUpdateScene(index, "accent_color", e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-1 text-xs outline-none mt-1 focus:border-indigo-500 font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Right half: Narration speech and sub-elements */}
                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-mono text-zinc-400">Narration Script (Voiceover Text)</label>
                          <textarea
                            value={scene.narration}
                            onChange={(e) => handleUpdateScene(index, "narration", e.target.value)}
                            rows={3}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg p-2.5 text-xs outline-none mt-1 focus:border-indigo-500 leading-relaxed resize-none"
                            placeholder="Enter the narration script for this slide..."
                          />
                        </div>

                        {/* Optional interactive steps/bullets */}
                        {(scene.bullets && scene.bullets.length > 0) && (
                          <div>
                            <label className="text-[11px] font-mono text-indigo-300">Bullet Points (One per line)</label>
                            <textarea
                              value={scene.bullets.join("\n")}
                              onChange={(e) => handleUpdateSceneBullets(index, e.target.value)}
                              rows={2}
                              className="w-full bg-zinc-900 border border-zinc-800 text-indigo-100 rounded-lg p-2 text-xs outline-none mt-1 focus:border-indigo-500 font-mono break-words resize-y"
                            />
                          </div>
                        )}
                        {(scene.steps && scene.steps.length > 0) && (
                          <div>
                            <label className="text-[11px] font-mono text-indigo-300">Timeline Milestones (One per line)</label>
                            <textarea
                              value={scene.steps.join("\n")}
                              onChange={(e) => handleUpdateSceneSteps(index, e.target.value)}
                              rows={2}
                              className="w-full bg-zinc-900 border border-zinc-800 text-indigo-100 rounded-lg p-2 text-xs outline-none mt-1 focus:border-indigo-500 font-mono break-words resize-y"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                reviewedTurns.map((turn, index) => (
                  <div key={index} className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 space-y-3 shadow relative group">
                    <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                      <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded ${turn.speaker === "host" ? "text-indigo-400 bg-indigo-500/10" : "text-emerald-400 bg-emerald-500/10"}`}>
                        Turn {index + 1} - Speaker: {turn.speaker.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleMoveTurn(index, "up")}
                          disabled={index === 0}
                          className="p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-20 transition"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveTurn(index, "down")}
                          disabled={index === reviewedTurns.length - 1}
                          className="p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-20 transition"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTurn(index)}
                          className="p-1 text-rose-500 hover:text-rose-400 transition ml-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-[11px] font-mono text-zinc-400">Speaker Role</label>
                        <select
                          value={turn.speaker}
                          onChange={(e) => handleUpdateTurn(index, "speaker", e.target.value as "host" | "guest")}
                          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-2 py-1.5 text-xs outline-none mt-1 focus:border-indigo-500"
                        >
                          <option value="host">Host (Joe)</option>
                          <option value="guest">Guest (Jane)</option>
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-[11px] font-mono text-zinc-400">Dialogue Script</label>
                        <textarea
                          value={turn.text}
                          onChange={(e) => handleUpdateTurn(index, "text", e.target.value)}
                          rows={2}
                          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg p-2.5 text-xs outline-none mt-1 focus:border-indigo-500 leading-relaxed resize-none font-medium"
                          placeholder="Enter podcast dialogue sentence..."
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom summary and approve button */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-800 pt-5 gap-4">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
                <Clock className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span>
                  {state?.format === "video" 
                    ? `Slides: ${reviewedScenes.length} | Est. Duration: ${reviewedScenes.reduce((sum, s) => sum + s.duration_seconds, 0)} seconds`
                    : `Dialogue Turns: ${reviewedTurns.length}`
                  }
                </span>
              </div>
              
              <button
                onClick={handleApproveAndSynthesize}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold px-8 py-3 rounded-xl text-sm transition hover:shadow-lg active:scale-95 cursor-pointer hover:shadow-indigo-500/10"
              >
                <Check className="w-5 h-5" />
                <span>Approve & Synthesize Audio</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
            {/* Animated Graphic Stage headers */}
            <div className="flex justify-center mb-4">
              {currentStage === "scripting" && (
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-full animate-bounce">
                  <Brain className="w-10 h-10" />
                </div>
              )}
              {currentStage === "narrating" && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-full animate-pulse">
                  <Mic className="w-10 h-10" />
                </div>
              )}
              {currentStage === "compiling" && (
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-full animate-spin">
                  <Film className="w-10 h-10" />
                </div>
              )}
              {currentStage === "error" && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-full">
                  <AlertCircle className="w-10 h-10" />
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xl font-extrabold tracking-wide">
                {currentStage === "scripting" && "Stage 1: Scripting Content"}
                {currentStage === "narrating" && "Stage 2: Narrating Audios"}
                {currentStage === "compiling" && "Stage 3: Compiling Canvas"}
                {currentStage === "error" && "Generation Pipeline Interrupted"}
              </h2>
              <p className="text-xs text-zinc-500 mt-1 uppercase font-semibold font-mono tracking-wider">
                {jobId}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full">
              <div className="w-full bg-zinc-900 border border-zinc-850 h-3 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    currentStage === "error" ? "bg-rose-500" : "bg-indigo-500"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 mt-2">
                <span>{progress}% complete</span>
                <span>EST TIME: ~45s</span>
              </div>
            </div>

            {/* Log message */}
            <p className="text-sm font-medium text-zinc-300 leading-normal animate-pulse">
              {currentStage === "error" ? errorText : logText}
            </p>

            {currentStage === "error" && (
              <button
                onClick={() => navigate("/")}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-sm transition"
              >
                Return to Studio
              </button>
            )}
          </div>
        )}
      </div>

      <div className="text-center text-xs text-zinc-600 pb-6 font-mono select-none">
        Powered by Google Gemini API · gemini-1.5-flash
      </div>
    </div>
  );
}

// 3. MAIN ROUTER WRAPPER
export default function App() {
  const [userName, setUserName] = useState<string | null>(() => {
    return localStorage.getItem("vyakhya_username");
  });

  useEffect(() => {
    const handleStorage = () => {
      setUserName(localStorage.getItem("vyakhya_username"));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleSaveName = (name: string) => {
    localStorage.setItem("vyakhya_username", name);
    setUserName(name);
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThemeAwareApp userName={userName} handleSaveName={handleSaveName} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function ThemeAwareApp({ userName, handleSaveName }: { userName: string | null; handleSaveName: (name: string) => void }) {
  return (
    <>
      {!userName && <NameModal onSave={handleSaveName} />}
      <Router>
        <Routes>
          <Route path="/" element={<StudioPage />} />
          <Route path="/create/:jobId" element={<ProgressPage />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/discover" element={<StudioPage />} /> {/* Handled inline */}
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/analytics" element={<AnalyticsDashboard />} />
        </Routes>
      </Router>
    </>
  );
}
