import React, { useState, useEffect } from "react";
import { HashRouter as Router, Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { ToastProvider, useToast } from "./contexts/ToastContext";
import AppLayout from "./components/AppLayout";
import CreationForm from "./components/CreationForm";
import DiscoverPage from "./components/DiscoverPage";
import WatchPage from "./components/WatchPage";
import LibraryPage from "./components/LibraryPage";
import LearnPage from "./components/LearnPage";
import ProfilePage from "./components/ProfilePage";
import NameModal from "./components/NameModal";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { auth, db } from "./lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { Sparkles, Brain, Mic, Film, CheckCircle2, AlertCircle, ArrowRight, Compass, Pencil, Plus, Trash2, ArrowUp, ArrowDown, Check, Save, RotateCcw, Clock, Eye, Presentation, Zap } from "lucide-react";
import { Scene, Explainer, PodcastTurn, LANGUAGES } from "./types";
import { exportReviewedScenesToPPTX, PPTX_THEMES } from "./lib/pptxExport";

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
    <div className="w-full space-y-12">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Hero Tagline */}
        <div className="text-center max-w-2xl mx-auto py-6 select-none">
          <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider font-mono">
            Vibe-Coded Multilingual Explanation Engine
          </span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mt-4 leading-snug">
            Confused by a complex topic? <br />
            Meet Vyakhya, simple, animated explainers in <span className="text-indigo-600 dark:text-indigo-500">60 seconds</span>.
          </h1>
          <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 mt-3 leading-relaxed">
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
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-between h-full shadow-lg dark:shadow-glow select-none">
              <div className="space-y-4">
                <span className="text-[11px] font-bold uppercase font-mono tracking-widest text-indigo-600 dark:text-indigo-400">Vyakhya Pipeline</span>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight">Dynamic AI-Generated Vector Stages</h3>
                
                <div className="space-y-3.5 pt-2">
                  <div className="flex gap-3 items-start">
                    <div className="bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 p-1.5 rounded-lg border border-indigo-500/10 font-bold text-xs">01</div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Gemini Scriptwriting</h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">Transforms topic input into bullet-reveals, analogies, or timelines based on scientific guidelines.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 p-1.5 rounded-lg border border-indigo-500/10 font-bold text-xs">02</div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Multilingual Narration Accents</h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">Narration scripts sent to Gemini text-to-speech to play in English, Hindi, Tamil, and Bengali.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 p-1.5 rounded-lg border border-indigo-500/10 font-bold text-xs">03</div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Interactive Canvas Renderer</h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">Vector timelines, charts, and diagrams rendered in real-time, matching narration audio perfectly.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 mt-8 flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-450">
                <span>Free Tier quota: 5 generations / day</span>
                <span className="flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-300 cursor-pointer">
                  Learn how it works <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
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

// Predefined CSS transition effects for the Preview Mode
const TRANSITION_STYLES = `
@keyframes previewFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes previewSlideLeft {
  from { transform: translateX(60px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes previewSlideRight {
  from { transform: translateX(-60px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes previewZoomIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.animate-preview-fade {
  animation: previewFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.animate-preview-slide-left {
  animation: previewSlideLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.animate-preview-slide-right {
  animation: previewSlideRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.animate-preview-zoom-in {
  animation: previewZoomIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
`;

interface ScenePreviewCardProps {
  scene: Scene;
  replayTrigger: number;
  onReplay: () => void;
}

function ScenePreviewCard({ scene, replayTrigger, onReplay }: ScenePreviewCardProps) {
  const transition = scene.transition_type || "fade";
  
  let transitionClass = "animate-preview-fade";
  if (transition === "slide-left") {
    transitionClass = "animate-preview-slide-left";
  } else if (transition === "slide-right") {
    transitionClass = "animate-preview-slide-right";
  } else if (transition === "zoom-in") {
    transitionClass = "animate-preview-zoom-in";
  }

  // Render a mini preview depending on the SceneType
  const renderMiniVisuals = () => {
    switch (scene.type) {
      case "concept_split":
        return (
          <div className="grid grid-cols-2 gap-2 h-16 w-full mt-1">
            <div className="border border-zinc-800/80 rounded p-1.5 bg-zinc-900/60 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-zinc-300 truncate">{scene.left_label || "Concept A"}</span>
              <div className="h-1 bg-zinc-700 w-2/3 rounded-full"></div>
            </div>
            <div className="border border-zinc-800/80 rounded p-1.5 bg-zinc-900/60 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-zinc-300 truncate">{scene.right_label || "Concept B"}</span>
              <div className="h-1 bg-zinc-700 w-1/2 rounded-full"></div>
            </div>
          </div>
        );
      case "bullet_reveal":
        return (
          <div className="flex flex-col gap-1 w-full mt-1.5">
            {(scene.bullets && scene.bullets.length > 0 ? scene.bullets.slice(0, 3) : ["Key Aspect", "Supporting Detail", "Conclusion Node"]).map((bullet, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: scene.accent_color || "#3D3A8C" }}></div>
                <span className="text-[10px] text-zinc-300 truncate max-w-full">{bullet}</span>
              </div>
            ))}
          </div>
        );
      case "data_stat":
        return (
          <div className="flex flex-col items-center justify-center h-16 w-full text-center mt-1 bg-zinc-900/40 rounded border border-zinc-800/50 p-1">
            <span className="text-lg font-black tracking-tight" style={{ color: scene.accent_color || "#3D3A8C" }}>
              {scene.stat_value || "94%"}
            </span>
            <span className="text-[9px] text-zinc-400 font-mono tracking-wider uppercase truncate max-w-full">
              {scene.stat_label || "Metric Name"}
            </span>
          </div>
        );
      case "timeline":
        return (
          <div className="flex items-center justify-between w-full mt-3 px-2">
            {(scene.steps && scene.steps.length > 0 ? scene.steps.slice(0, 3) : ["Initiation", "Execution", "Completion"]).map((step, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1 flex-1 relative">
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white bg-zinc-800 border" style={{ borderColor: scene.accent_color || "#3D3A8C" }}>
                  {idx + 1}
                </div>
                <span className="text-[8px] text-zinc-400 truncate max-w-[50px]">{step}</span>
              </div>
            ))}
          </div>
        );
      case "quote_card":
        return (
          <div className="border-l-2 pl-2 mt-1.5 italic text-zinc-300 text-[10px] space-y-1.5" style={{ borderColor: scene.accent_color || "#3D3A8C" }}>
            <p className="line-clamp-2">"{scene.quote_text || "Complex ideas made visually simple."}"</p>
            {scene.quote_attribution && (
              <p className="text-[8px] text-zinc-500 font-bold not-italic">— {scene.quote_attribution}</p>
            )}
          </div>
        );
      case "analogy_card":
        return (
          <div className="bg-zinc-900/60 border border-dashed border-zinc-850 rounded p-2 mt-2">
            <div className="flex items-center gap-1.5 text-[9px] font-semibold text-amber-400">
              <Sparkles className="w-3 h-3" />
              <span>Analogy Metaphor</span>
            </div>
            <p className="text-[10px] text-zinc-300 line-clamp-2 mt-0.5 italic">
              {scene.analogy_text || "Imagine a complex system as a simple post office..."}
            </p>
          </div>
        );
      case "summary_card":
        return (
          <div className="bg-zinc-900/80 border border-zinc-850 rounded-lg p-2 mt-2 flex flex-col justify-center gap-1">
            <div className="h-1 bg-zinc-700 w-full rounded-full"></div>
            <div className="h-1 bg-zinc-700 w-5/6 rounded-full"></div>
            <div className="h-1 bg-zinc-700 w-2/3 rounded-full"></div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-16 w-full text-center text-zinc-500 border border-zinc-800/40 border-dashed rounded mt-1.5">
            <span className="text-[9px] uppercase font-mono tracking-widest">Illustration Stage</span>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <style>{TRANSITION_STYLES}</style>
      <div 
        key={`${scene.id}-${transition}-${replayTrigger}`}
        style={{ 
          backgroundColor: "#09090b", // clean deep dark card
          borderColor: scene.accent_color || "#4f46e5" 
        }}
        className={`relative w-full aspect-[16/10] rounded-2xl p-4 flex flex-col justify-between overflow-hidden border-2 shadow-2xl ${transitionClass}`}
      >
        {/* BG Accent glow */}
        <div 
          className="absolute -right-16 -top-16 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: scene.accent_color || "#4f46e5" }}
        />

        {/* Header */}
        <div className="z-10">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-zinc-400 bg-zinc-900 uppercase font-mono tracking-wider border border-zinc-850">
              {scene.type.replace("_", " ")}
            </span>
            <span className="text-[9px] font-bold font-mono text-zinc-500 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-indigo-400" />
              {transition.toUpperCase()}
            </span>
          </div>
          <h3 className="font-extrabold text-xs text-zinc-100 tracking-tight mt-1.5 line-clamp-2 uppercase">
            {scene.headline || "Untitled Slide"}
          </h3>
        </div>

        {/* Graphics content wrapper */}
        <div className="flex-1 flex flex-col justify-center z-10 my-2">
          {renderMiniVisuals()}
        </div>

        {/* Footer info */}
        <div className="border-t border-zinc-900/80 pt-1.5 flex justify-between items-center z-10">
          <span className="text-[8px] font-mono text-zinc-500 truncate max-w-[150px]">
            {scene.visual_instruction || "No prompt concept."}
          </span>
          <span className="text-[8px] font-mono font-bold text-zinc-400 shrink-0 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-850">
            {scene.duration_seconds}s
          </span>
        </div>
      </div>
      
      {/* Replay action */}
      <button
        onClick={onReplay}
        className="self-center flex items-center gap-1.5 text-[10px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-850 px-2.5 py-1 rounded-md transition cursor-pointer active:scale-95"
      >
        <Sparkles className="w-3 h-3 text-indigo-400" />
        <span>Replay transition</span>
      </button>
    </div>
  );
}

// 2. GENERATION PROGRESS TRACKING PAGE
function ProgressPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { showToast } = useToast();

  const [currentStage, setCurrentStage] = useState<"scripting" | "reviewing" | "narrating" | "compiling" | "error">("scripting");
  const [showPreview, setShowPreview] = useState(false);
  const [progress, setProgress] = useState(10);
  const [logText, setLogText] = useState("Initializing understanding nodes...");
  const [errorText, setErrorText] = useState("");

  const [scriptDataState, setScriptDataState] = useState<any>(null);
  const [reviewedTitle, setReviewedTitle] = useState<string>("");
  const [reviewedScenes, setReviewedScenes] = useState<Scene[]>([]);
  const [selectedPPTXTheme, setSelectedPPTXTheme] = useState<string>("modern_minimal");
  const [reviewedTurns, setReviewedTurns] = useState<PodcastTurn[]>([]);
  const [replayTriggers, setReplayTriggers] = useState<Record<string, number>>({});

  const triggerReplay = (sceneId: string) => {
    setReplayTriggers((prev) => ({
      ...prev,
      [sceneId]: (prev[sceneId] || 0) + 1,
    }));
  };

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
      showToast("An explainer must have at least one scene!", "error");
      return;
    }
    setReviewedScenes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteTurn = (index: number) => {
    if (reviewedTurns.length <= 1) {
      showToast("A podcast must have at least one dialogue turn!", "error");
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

  const getVoiceForPreference = (langCode: string, preference: "male" | "female") => {
    const lang = LANGUAGES.find(l => l.code === langCode) || LANGUAGES[0];
    const availableVoices = [lang.voiceHost, lang.voiceGuest];
    
    // Correct Gemini voice genders
    const femaleVoices = ["Puck", "Kore", "Aoede"];
    const maleVoices = ["Charon", "Fenrir", "Zephyr"];
    
    const preferredList = preference === "female" ? femaleVoices : maleVoices;
    
    // Find the first voice in this language that matches the requested gender
    const matchedVoice = availableVoices.find(v => preferredList.includes(v));
    
    // Fallback logic: if neither voice matches the requested gender, default to the host voice
    return matchedVoice || lang.voiceHost;
  };

  const handleApproveAndSynthesize = async () => {
    if (!state) return;
    
    // Robustly determine voice engine and preference, checking state then localStorage, then fallback values
    const language = state.language || localStorage.getItem("vyakhya_language") || "en-IN";
    const voiceEngine = state.voiceEngine || localStorage.getItem("vyakhya_voice_engine") || "browser";
    const voicePreference = state.voicePreference || localStorage.getItem("vyakhya_voice_preference") || "female";
    const { topic, style, length, format } = state;

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
            const voiceName = getVoiceForPreference(language, voicePreference);
            const ttsResponse = await fetchWithRetry("/api/generate-speech", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: scene.narration,
                voice: voiceName,
                languageCode: language,
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
            const hostVoice = getVoiceForPreference(language, voicePreference);
            const guestVoice = targetLang.voiceHost === hostVoice ? targetLang.voiceGuest : targetLang.voiceHost;
            const ttsResponse = await fetchWithRetry("/api/generate-speech", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: turn.text,
                voice: turn.speaker === "host" ? hostVoice : guestVoice,
                languageCode: language,
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

      // --- STAGE 2.6: Generate Scene Thumbnails for PPT / UI ---
      if (format === "video" && updatedScriptData.scenes) {
        setLogText("Pre-generating scene artwork illustrations...");
        await Promise.allSettled(updatedScriptData.scenes.map(async (scene) => {
          try {
            const thumbRes = await fetch("/api/generate-scene-thumbnail", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                headline: scene.headline,
                visualInstruction: scene.visual_instruction,
                bgColor: scene.bg_color,
                accentColor: scene.accent_color,
              }),
            });
            if (thumbRes.ok) {
              const data = await thumbRes.json();
              if (data.imageBase64) {
                 scene.imageUrl = `data:${data.mimeType};base64,${data.imageBase64}`;
              }
            }
          } catch(e) {
            console.warn("Thumbnail generation failed for scene", scene.id, e);
          }
        }));
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
        voicePreference,
        voiceEngine,
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
    <div className="w-full flex flex-col justify-between">
      <div className="flex-1 flex flex-col items-center justify-center py-4">
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
                        <div className="flex flex-col gap-3">
                          <ScenePreviewCard 
                            scene={scene} 
                            replayTrigger={replayTriggers[scene.id] || 0} 
                            onReplay={() => triggerReplay(scene.id)} 
                          />
                          
                          {/* Live Settings adjustments during preview */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                            <div>
                              <label className="text-[11px] font-mono text-zinc-400">Duration (s)</label>
                              <input
                                type="number"
                                min="3"
                                max="30"
                                value={scene.duration_seconds}
                                onChange={(e) => handleUpdateScene(index, "duration_seconds", Math.max(3, parseInt(e.target.value, 10) || 5))}
                                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-1.5 text-xs outline-none mt-1 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-mono text-zinc-400">Accent Color</label>
                              <input
                                type="text"
                                value={scene.accent_color}
                                onChange={(e) => handleUpdateScene(index, "accent_color", e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-1.5 text-xs outline-none mt-1 focus:border-indigo-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-mono text-zinc-400">Transition</label>
                              <select
                                value={scene.transition_type || "fade"}
                                onChange={(e) => {
                                  handleUpdateScene(index, "transition_type", e.target.value);
                                  triggerReplay(scene.id);
                                }}
                                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-1.5 text-xs outline-none mt-1 focus:border-indigo-500 cursor-pointer"
                              >
                                <option value="fade">Fade</option>
                                <option value="slide-left">Slide Left</option>
                                <option value="slide-right">Slide Right</option>
                                <option value="zoom-in">Zoom In / Scale</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 flex flex-col justify-between">
                          <div className="space-y-3">
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
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-auto">
                            <div>
                              <label className="text-[11px] font-mono text-zinc-400">Duration (s)</label>
                              <input
                                type="number"
                                min="3"
                                max="30"
                                value={scene.duration_seconds}
                                onChange={(e) => handleUpdateScene(index, "duration_seconds", Math.max(3, parseInt(e.target.value, 10) || 5))}
                                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-1.5 text-xs outline-none mt-1 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-mono text-zinc-400">Accent Color</label>
                              <input
                                type="text"
                                value={scene.accent_color}
                                onChange={(e) => handleUpdateScene(index, "accent_color", e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-1.5 text-xs outline-none mt-1 focus:border-indigo-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-mono text-zinc-400">Transition</label>
                              <select
                                value={scene.transition_type || "fade"}
                                onChange={(e) => {
                                  handleUpdateScene(index, "transition_type", e.target.value);
                                  triggerReplay(scene.id);
                                }}
                                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-1.5 text-xs outline-none mt-1 focus:border-indigo-500 cursor-pointer"
                              >
                                <option value="fade">Fade</option>
                                <option value="slide-left">Slide Left</option>
                                <option value="slide-right">Slide Right</option>
                                <option value="zoom-in">Zoom In / Scale</option>
                              </select>
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
              
              <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3 items-center">
                {state?.format === "video" && reviewedScenes.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto bg-zinc-50 dark:bg-zinc-900/40 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <select
                      value={selectedPPTXTheme}
                      onChange={(e) => setSelectedPPTXTheme(e.target.value)}
                      className="bg-transparent text-xs text-zinc-600 dark:text-zinc-400 focus:outline-none px-2.5 py-1 font-semibold border-r border-zinc-200 dark:border-zinc-800"
                    >
                      {Object.entries(PPTX_THEMES).map(([key, theme]) => (
                        <option key={key} value={key} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
                          {theme.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => exportReviewedScenesToPPTX(reviewedScenes, reviewedTitle || "Presentation", selectedPPTXTheme)}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 text-zinc-700 dark:text-zinc-300 font-bold px-4 py-2 rounded-lg text-xs transition active:scale-95 cursor-pointer"
                      title="Download current storyboard slides as a PowerPoint presentation file"
                    >
                      <Presentation className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                      <span>Download PPTX</span>
                    </button>
                  </div>
                )}
                <button
                  onClick={handleApproveAndSynthesize}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold px-8 py-3 rounded-xl text-sm transition hover:shadow-lg active:scale-95 cursor-pointer hover:shadow-indigo-500/10"
                >
                  <Check className="w-5 h-5" />
                  <span>Approve & Synthesize Audio</span>
                </button>
              </div>
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
        <ToastProvider>
          <ThemeAwareApp userName={userName} handleSaveName={handleSaveName} />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function ThemeAwareApp({ userName, handleSaveName }: { userName: string | null; handleSaveName: (name: string) => void }) {
  return (
    <>
      {!userName && <NameModal onSave={handleSaveName} />}
      <Router>
        <AppLayout>
          <Routes>
            <Route path="/" element={<StudioPage />} />
            <Route path="/create/:jobId" element={<ProgressPage />} />
            <Route path="/watch/:id" element={<WatchPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
          </Routes>
        </AppLayout>
      </Router>
    </>
  );
}
