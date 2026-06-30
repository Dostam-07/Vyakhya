import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Explainer } from "../types";
import { db, auth } from "../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import CanvasRenderer from "./CanvasRenderer";
import AudioWaveform from "./AudioWaveform";
import Navbar from "./Navbar";
import InteractiveHub from "./InteractiveHub";
import { SEED_EXPLAINERS } from "./DiscoverFeed";
import { ArrowLeft, Sparkles, Eye, Bookmark, Share2, Clipboard, AlertCircle, Sliders, RotateCcw, Music, Download, Presentation } from "lucide-react";
import { exportReviewedScenesToPPTX } from "../lib/pptxExport";

export default function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [explainer, setExplainer] = useState<Explainer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeSceneIdx, setActiveSceneIdx] = useState(0);
  const [syncOffset, setSyncOffset] = useState<number>(0);
  const [autoAdjustActive, setAutoAdjustActive] = useState<boolean>(false);

  const handleAutoAdjustSync = () => {
    if (!explainer) return;
    
    // Auto-adjust sync heuristic:
    // 1. If using video format, calculate word density.
    // 2. If average words per second is high (> 2.2 words/sec), we need to slow down/delay animations to prevent clipping.
    // 3. If format is video with custom narration, add a default 400ms buffer to compensate for Web Speech API/TTS start-up latency.
    let calculatedOffset = 0;
    
    if (explainer.format === "video" && explainer.scenes) {
      let totalWords = 0;
      let totalDuration = 0;
      
      explainer.scenes.forEach(scene => {
        const words = scene.narration.split(/\s+/).filter(Boolean).length;
        totalWords += words;
        totalDuration += scene.duration_seconds;
      });
      
      const avgWps = totalWords / (totalDuration || 1);
      
      // If words are read too fast (wps > 2.2), we delay visuals to match slower speaking rate
      if (avgWps > 2.2) {
        calculatedOffset = Math.round((avgWps - 2.2) * 800); // positive offset delays visuals / lets narration breathe
      } else {
        calculatedOffset = 400; // default 400ms to compensate for TTS engine startup latency
      }
    } else if (explainer.format === "podcast" && explainer.turns) {
      // For podcasts, add standard 300ms speaker transition offset
      calculatedOffset = 300;
    }
    
    // Clamp offset to safe limits [-2000, 2000]
    const clamped = Math.max(-2000, Math.min(2000, calculatedOffset));
    setSyncOffset(clamped);
    
    setAutoAdjustActive(true);
    setTimeout(() => setAutoAdjustActive(false), 3000);
  };

  useEffect(() => {
    const fetchExplainer = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        // Try Firestore
        const docRef = doc(db, "explainers", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Explainer;
          setExplainer(data);

          // Increment view count
          try {
            await updateDoc(docRef, {
              views: (data.views || 0) + 1,
            });
          } catch (updateErr) {
            console.warn("Could not increment view count on Firestore (offline/permission):", updateErr);
          }
        } else {
          // Check LocalStorage drafts/generations
          const localGenerations = JSON.parse(localStorage.getItem("vyakhya_generations") || "[]");
          const localItem = localGenerations.find((item: Explainer) => item.id === id);
          if (localItem) {
            setExplainer(localItem);
          } else {
            // Check SEED_EXPLAINERS
            const seedItem = SEED_EXPLAINERS.find((item: Explainer) => item.id === id);
            if (seedItem) {
              setExplainer(seedItem);
            } else {
              console.error("Explainer not found in Firestore, LocalStorage or Seed curation");
            }
          }
        }
      } catch (err) {
        console.error("Error fetching watch content:", err);
        // Fallback checks
        const localGenerations = JSON.parse(localStorage.getItem("vyakhya_generations") || "[]");
        const localItem = localGenerations.find((item: Explainer) => item.id === id);
        if (localItem) {
          setExplainer(localItem);
        } else {
          const seedItem = SEED_EXPLAINERS.find((item: Explainer) => item.id === id);
          if (seedItem) setExplainer(seedItem);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchExplainer();
  }, [id]);

  useEffect(() => {
    if (!explainer) return;
    try {
      const history = JSON.parse(localStorage.getItem("vyakhya_history") || "[]");
      const filtered = history.filter((h: any) => h.id !== explainer.id);
      
      const historyItem = {
        id: explainer.id,
        title: explainer.title,
        topic: explainer.topic,
        creatorName: explainer.creatorName,
        format: explainer.format,
        language: explainer.language,
        style: explainer.style,
        duration: explainer.duration,
        views: explainer.views,
        saves: explainer.saves,
        tags: explainer.tags,
        createdAt: explainer.createdAt,
        viewedAt: Date.now()
      };
      
      filtered.unshift(historyItem);
      localStorage.setItem("vyakhya_history", JSON.stringify(filtered.slice(0, 50)));
    } catch (err) {
      console.error("Error saving to history:", err);
    }
  }, [explainer]);

  const handleDownload = () => {
    if (!explainer) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(explainer));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${explainer.title.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleUpdateExplainer = async (updatedExplainer: Explainer) => {
    setExplainer(updatedExplainer);
    try {
      // Save to Firestore if it exists there
      const docRef = doc(db, "explainers", updatedExplainer.id);
      await updateDoc(docRef, {
        scenes: updatedExplainer.scenes,
        title: updatedExplainer.title,
        topic: updatedExplainer.topic,
      });
    } catch (err) {
      console.warn("Could not save updates to Firestore, updating locally:", err);
    }

    // Always update LocalStorage
    try {
      const localGenerations = JSON.parse(localStorage.getItem("vyakhya_generations") || "[]");
      const updatedLocal = localGenerations.map((item: Explainer) => 
        item.id === updatedExplainer.id ? updatedExplainer : item
      );
      localStorage.setItem("vyakhya_generations", JSON.stringify(updatedLocal));
    } catch (err) {
      console.error("Failed to update local storage:", err);
    }
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    if (explainer) {
      // update saves locally
      setExplainer({
        ...explainer,
        saves: explainer.saves + (isSaved ? -1 : 1),
      });
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleRemix = () => {
    if (!explainer) return;
    // Pass remix state to homepage creation form
    navigate("/", {
      state: {
        remixTopic: explainer.topic,
        remixFormat: explainer.format,
        remixLang: explainer.language,
        remixStyle: explainer.style,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-20 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 mt-4 font-medium text-sm animate-pulse">Loading explainer details...</p>
        </div>
      </div>
    );
  }

  if (!explainer) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-2" />
          <h2 className="text-xl font-bold">Explainer Not Found</h2>
          <p className="text-zinc-500 text-sm mt-1">This video was deleted or exists under a different identifier.</p>
          <button
            onClick={() => navigate("/")}
            className="mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-sm transition"
          >
            Return to Studio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 select-none">
        {/* Back Button */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 text-xs sm:text-sm font-semibold mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Studio</span>
        </button>

        {/* Media Player Column */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-6">
            {explainer.format === "video" ? (
              <CanvasRenderer
                scenes={explainer.scenes || []}
                activeSceneIndex={activeSceneIdx}
                onSceneChange={setActiveSceneIdx}
                syncOffset={syncOffset}
                voicePreference={explainer.voicePreference}
                language={explainer.language}
                isEditable={!explainer.creatorId || explainer.creatorId === auth.currentUser?.uid || auth.currentUser?.email === explainer.creatorEmail}
                onUpdateScenes={(updatedScenes) => {
                  handleUpdateExplainer({
                    ...explainer,
                    scenes: updatedScenes,
                  });
                }}
              />
            ) : (
              <AudioWaveform 
                title={explainer.title} 
                turns={explainer.turns || []} 
                topic={explainer.topic} 
                syncOffset={syncOffset}
                voicePreference={explainer.voicePreference}
                language={explainer.language}
              />
            )}

            {/* AV Sync Calibration Accordion */}
            {explainer.soundtrackUrl && (
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 p-1.5 rounded-lg">
                    <Music className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-extrabold text-zinc-100 uppercase tracking-wider">Immersive Lyria Soundtrack</h3>
                </div>
                <audio 
                  src={explainer.soundtrackUrl} 
                  autoPlay 
                  loop 
                  controls 
                  className="w-full h-8 outline-none [&::-webkit-media-controls-panel]:bg-zinc-900 [&::-webkit-media-controls-current-time-display]:text-zinc-300 [&::-webkit-media-controls-time-remaining-display]:text-zinc-300 [&::-webkit-media-controls-play-button]:brightness-150"
                />
              </div>
            )}

            <details className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 shadow-xl group outline-none">
              <summary className="flex items-center justify-between cursor-pointer list-none select-none outline-none">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400 group-open:animate-none" />
                  <h3 className="text-xs font-extrabold text-zinc-100 uppercase tracking-wider">Advanced Sync Calibration</h3>
                </div>
                <div className="flex items-center gap-2">
                  {syncOffset !== 0 && (
                    <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                      Offset: {syncOffset > 0 ? `+${(syncOffset / 1000).toFixed(1)}s` : `${(syncOffset / 1000).toFixed(1)}s`}
                    </span>
                  )}
                  <span className="text-zinc-500 text-xs transition-transform duration-200 group-open:rotate-180">▼</span>
                </div>
              </summary>

              <div className="mt-4 pt-4 border-t border-zinc-900/60 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-400">Heuristic Engine Calibration</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleAutoAdjustSync}
                      className="flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition active:scale-95 cursor-pointer font-bold"
                    >
                      <Sparkles className={`w-3.5 h-3.5 text-emerald-400 ${autoAdjustActive ? 'animate-spin' : 'animate-pulse'}`} />
                      <span>{autoAdjustActive ? "Calculated!" : "Auto-Adjust Sync"}</span>
                    </button>
                    {syncOffset !== 0 && (
                      <button
                        onClick={() => setSyncOffset(0)}
                        className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 px-2.5 py-1 rounded-lg transition active:scale-95 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                    <span>Visuals Lag (Delayed)</span>
                    <span className={`px-2 py-0.5 rounded-md font-bold ${syncOffset === 0 ? "text-zinc-500 bg-zinc-900" : syncOffset > 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}`}>
                      {syncOffset > 0 ? `+${(syncOffset / 1000).toFixed(1)}s` : `${(syncOffset / 1000).toFixed(1)}s`} (Offset)
                    </span>
                    <span>Visuals Lead (Advance)</span>
                  </div>
                  
                  <input
                    type="range"
                    min="-3000"
                    max="3000"
                    step="100"
                    value={syncOffset}
                    onChange={(e) => setSyncOffset(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-indigo-500 outline-none"
                  />
                  
                  <p className="text-[11px] text-zinc-500 leading-normal">
                    💡 <span className="font-semibold text-zinc-400">Calibration Instructions:</span> Adjust if the narration does not line up perfectly with the slide transitions. Slide <strong className="text-indigo-400">positive (+)</strong> to speed up / advance animations relative to narration, or <strong className="text-indigo-400">negative (-)</strong> to delay animations.
                  </p>
                </div>
              </div>
            </details>

            {/* Description Info block */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 leading-tight">
                    {explainer.title}
                  </h1>
                  <p className="text-xs text-zinc-500 font-mono mt-1">Created by {explainer.creatorName}</p>
                </div>

                {/* Remix Button */}
                <button
                  onClick={handleRemix}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-md shadow-indigo-500/10 transition active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-indigo-100 fill-indigo-200" />
                  <span>Remix this Topic</span>
                </button>
              </div>

              <div className="text-sm text-zinc-400 leading-relaxed bg-zinc-900/35 p-4 rounded-xl border border-zinc-900">
                <span className="font-bold text-zinc-200 block mb-1">Concept Summary</span>
                {explainer.topic}
              </div>

              {/* Tag Cloud */}
              <div className="flex flex-wrap gap-2 pt-2">
                {explainer.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-indigo-950/15 border border-indigo-950/35 text-indigo-400 font-semibold text-[11px] px-3 py-1 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Interactive Learning Hub: Q&A, Practice Quiz, and Flashcards */}
            <div className="mt-8">
              <InteractiveHub 
                initialTopic={explainer.title || explainer.topic} 
                contextScript={
                  explainer.format === "video"
                    ? explainer.scenes?.map((s, idx) => `[Scene ${idx + 1}: ${s.headline}]: ${s.narration}`).join("\n") || ""
                    : explainer.turns?.map((t) => `[${t.speaker.toUpperCase()}]: ${t.text}`).join("\n") || ""
                } 
              />
            </div>
          </div>

          {/* Sidebar Info & Transcripts Panel */}
          <div className="lg:col-span-4 space-y-6">
            {/* Action Counters card */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Curation Panel</h3>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={handleSave}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border text-[10px] font-bold transition ${
                    isSaved
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                      : "bg-zinc-900/40 border-zinc-800 text-zinc-300 hover:bg-zinc-900"
                  }`}
                >
                  <Bookmark className={`w-4 h-4 ${isSaved ? "fill-amber-500" : ""}`} />
                  <span>{isSaved ? "Saved" : "Save"}</span>
                </button>

                <button
                  onClick={handleShare}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-900 text-[10px] font-bold transition"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{copySuccess ? "Copied" : "Share"}</span>
                </button>

                <button
                  onClick={handleDownload}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-900 text-[10px] font-bold transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </div>

              {explainer.format === "video" && explainer.scenes && (
                <button
                  onClick={() => exportReviewedScenesToPPTX(explainer.scenes || [], explainer.title)}
                  className="w-full py-2.5 rounded-xl border border-indigo-500/20 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer mt-3"
                  title="Export this video's slides to PowerPoint presentation"
                >
                  <Presentation className="w-4 h-4" />
                  <span>Export PowerPoint Presentation</span>
                </button>
              )}

              <div className="flex items-center justify-around border-t border-zinc-900 pt-4 text-xs font-mono text-zinc-500 text-center">
                <div>
                  <span className="text-zinc-400 block font-bold text-sm">{explainer.views}</span>
                  Views
                </div>
                <div>
                  <span className="text-zinc-400 block font-bold text-sm">{explainer.saves}</span>
                  Saves
                </div>
                <div>
                  <span className="text-zinc-400 block font-bold text-sm capitalize">{explainer.style}</span>
                  Tone Style
                </div>
              </div>
            </div>

            {/* Transcript/Scenarios overview panel for Video Mode */}
            {explainer.format === "video" && explainer.scenes && (
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-4 max-h-[380px] overflow-y-auto">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Video Storyboard</h3>
                <div className="space-y-3.5">
                  {explainer.scenes.map((scene, idx) => {
                    const isActive = idx === activeSceneIdx;
                    return (
                      <div
                        key={idx}
                        onClick={() => setActiveSceneIdx(idx)}
                        className={`p-3 rounded-xl cursor-pointer border transition-all duration-200 ${
                          isActive
                            ? "bg-indigo-600/10 border-indigo-500 shadow-[0_0_12px_rgba(79,70,229,0.15)]"
                            : "bg-zinc-900/30 border-zinc-900/50 hover:border-zinc-700/50 hover:bg-zinc-900/50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                            isActive ? "bg-indigo-500 text-white" : "bg-indigo-500/10 text-indigo-400"
                          }`}>
                            Scene {idx + 1}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">{scene.duration_seconds}s</span>
                        </div>
                        <h4 className={`text-xs font-bold transition-colors ${isActive ? "text-indigo-300" : "text-zinc-300"}`}>{scene.headline}</h4>
                        <p className="text-xs text-zinc-400 leading-relaxed mt-1">{scene.narration}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
