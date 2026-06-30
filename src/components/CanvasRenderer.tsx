import React, { useRef, useEffect, useState } from "react";
import { Scene, LANGUAGES } from "../types";
import { Play, Pause, RefreshCw, Download, Volume2, VolumeX } from "lucide-react";
import { useToast } from "../contexts/ToastContext";

interface CanvasRendererProps {
  scenes: Scene[];
  activeSceneIndex: number;
  onSceneChange?: (index: number) => void;
  isEditable?: boolean;
  syncOffset?: number;
  onUpdateScenes?: (scenes: Scene[]) => void;
  voicePreference?: "male" | "female";
  language?: string;
}

export default function CanvasRenderer({
  scenes,
  activeSceneIndex,
  onSceneChange,
  isEditable = false,
  syncOffset = 0,
  onUpdateScenes,
  voicePreference,
  language,
}: CanvasRendererProps) {
  const { showToast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(activeSceneIndex);
  const [progress, setProgress] = useState(0); // 0 to 1 for current scene
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);

  // Captions toggle state
  const [captionsEnabled, setCaptionsEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("vyakhya_captions_enabled");
      return saved !== "false";
    }
    return true;
  });

  // Local non-destructive scene thumbnails (BUG-008)
  const [sceneThumbnails, setSceneThumbnails] = useState<Record<string, string>>({});

  // Active scene editing states
  const [editHeadline, setEditHeadline] = useState("");
  const [editNarration, setEditNarration] = useState("");
  const [editTransition, setEditTransition] = useState("");
  const [editBgColor, setEditBgColor] = useState("");
  const [editAccentColor, setEditAccentColor] = useState("");
  const [isRegeneratingAudio, setIsRegeneratingAudio] = useState(false);

  // AI Upgrades States (F-01, F-06)
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [videoStatus, setVideoStatus] = useState<"idle" | "generating" | "completed" | "failed">("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoProgressText, setVideoProgressText] = useState("");

  const activeScene = scenes[currentIndex];

  // Initialize edit fields when scene changes
  useEffect(() => {
    if (activeScene) {
      setEditHeadline(activeScene.headline);
      setEditNarration(activeScene.narration);
      setEditTransition(activeScene.transition_type || "fade");
      setEditBgColor(activeScene.bg_color || "#15131A");
      setEditAccentColor(activeScene.accent_color || "#7c6af7");
    }
  }, [currentIndex, activeScene]);

  const handleGenerateThumbnail = async () => {
    if (!activeScene) return;
    setThumbnailLoading(true);
    try {
      const response = await fetch("/api/generate-scene-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: activeScene.headline,
          visualInstruction: activeScene.visual_instruction,
          bgColor: activeScene.bg_color,
          accentColor: activeScene.accent_color,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.imageBase64) {
          const thumbUrl = `data:${data.mimeType};base64,${data.imageBase64}`;
          setSceneThumbnails((prev) => ({ ...prev, [activeScene.id]: thumbUrl }));
          if (onUpdateScenes) {
            const updated = scenes.map((s) =>
              s.id === activeScene.id ? { ...s, imageUrl: thumbUrl } : s
            );
            onUpdateScenes(updated);
          }
        }
      }
    } catch (err) {
      console.error("Failed to generate scene thumbnail:", err);
    } finally {
      setThumbnailLoading(false);
    }
  };

  const handleGenerateVeoVideo = async () => {
    if (!activeScene) return;
    setVideoStatus("generating");
    setVideoProgressText("Sending cinematic prompt to Google Veo model...");
    try {
      const startRes = await fetch("/api/generate-scene-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: activeScene.id,
          visualInstruction: activeScene.visual_instruction,
          headline: activeScene.headline,
          style: "educational",
        }),
      });

      if (!startRes.ok) throw new Error("Failed to start Veo video");
      const startData = await startRes.json();
      const operationName = startData.operationName;

      if (!operationName) {
        throw new Error("No operationName returned from Veo API");
      }

      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        if (attempts > 30) {
          clearInterval(pollInterval);
          setVideoStatus("failed");
          setVideoProgressText("Generation timeout.");
          return;
        }

        try {
          const statusRes = await fetch(`/api/veo-status/${encodeURIComponent(operationName)}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            setVideoProgressText(`Veo rendering progress: ${statusData.status || "Processing..."}`);
            
            if (statusData.status === "complete") {
              clearInterval(pollInterval);
              const downloadUrl = `/api/video-download?uri=${encodeURIComponent(statusData.uri)}`;
              setVideoUrl(downloadUrl);
              setVideoStatus("completed");
              setVideoProgressText("Cinematic video generated successfully!");
              activeScene.videoUrl = downloadUrl;
            } else if (statusData.status === "error") {
              clearInterval(pollInterval);
              setVideoStatus("failed");
              setVideoProgressText("Veo video generation failed on the server.");
            }
          }
        } catch (pollErr) {
          console.warn("Error polling video status:", pollErr);
        }
      }, 4000);

    } catch (err: any) {
      console.error("Failed to generate Veo video:", err);
      setVideoStatus("failed");
      setVideoProgressText(err.message || "Veo connection failure.");
    }
  };

  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  
  // Ref to track if Web Speech API browser TTS is actively speaking
  const ttsSpeakingRef = useRef<boolean>(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Ref to track current index synchronously in high-frequency animation loops
  const currentIndexRef = useRef(activeSceneIndex);
  const updateCurrentIndex = (index: number) => {
    setCurrentIndex(index);
    currentIndexRef.current = index;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Sync index from prop if activeSceneIndex changes
  useEffect(() => {
    updateCurrentIndex(activeSceneIndex);
    setProgress(0);
    if (isPlaying) {
      playScene(activeSceneIndex);
    }
  }, [activeSceneIndex]);

  const speakWithBrowserTTS = (text: string, sceneIndex: number) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (isMuted) return;

    window.speechSynthesis.cancel(); // cancel any active speaking
    ttsSpeakingRef.current = true;
    startTimeRef.current = null; // wait for actual speech start callback

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtteranceRef.current = utterance;
    
    const resolvedLanguage = language || localStorage.getItem("vyakhya_language") || "en-IN";
    const resolvedPreference = voicePreference || localStorage.getItem("vyakhya_voice_preference") || "female";
    
    // Fallback language parsing
    utterance.lang = resolvedLanguage;

    // Pitch styling for gender representation
    utterance.pitch = resolvedPreference === "male" ? 0.85 : 1.2;
    utterance.rate = 1.02;

    // Try to locate a matching native browser voice!
    if (window.speechSynthesis.getVoices) {
      const voices = window.speechSynthesis.getVoices();
      // Filter by language
      let langVoices = voices.filter((v) => 
        v.lang.toLowerCase() === resolvedLanguage.toLowerCase() || 
        v.lang.toLowerCase().startsWith(resolvedLanguage.split("-")[0].toLowerCase())
      );
      
      if (langVoices.length === 0) {
        langVoices = voices;
      }
      
      // Filter by gender preference
      let matchedVoice = null;
      if (resolvedPreference === "female") {
        matchedVoice = langVoices.find(v => 
          v.name.toLowerCase().includes("female") || 
          v.name.toLowerCase().includes("zira") || 
          v.name.toLowerCase().includes("susan") || 
          v.name.toLowerCase().includes("hazel") || 
          v.name.toLowerCase().includes("google us english") || 
          v.name.toLowerCase().includes("microsoft") && !v.name.toLowerCase().includes("david")
        );
      } else {
        matchedVoice = langVoices.find(v => 
          v.name.toLowerCase().includes("male") || 
          v.name.toLowerCase().includes("david") || 
          v.name.toLowerCase().includes("george") || 
          v.name.toLowerCase().includes("ravi")
        );
      }
      
      if (!matchedVoice && langVoices.length > 0) {
        matchedVoice = langVoices[0];
      }
      
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
    }

    utterance.onstart = () => {
      if (currentUtteranceRef.current === utterance) {
        startTimeRef.current = performance.now();
      }
    };

    utterance.onend = () => {
      if (currentUtteranceRef.current === utterance) {
        ttsSpeakingRef.current = false;
      }
    };
    utterance.onerror = () => {
      if (currentUtteranceRef.current === utterance) {
        ttsSpeakingRef.current = false;
      }
    };

    window.speechSynthesis.speak(utterance);

    // Safety fallback in case the browser onstart fails to fire
    setTimeout(() => {
      if (currentUtteranceRef.current === utterance && startTimeRef.current === null) {
        startTimeRef.current = performance.now();
      }
    }, 500);
  };

  // Handle playing a scene's audio
  const playScene = (index: number) => {
    // Stop all audio
    (Object.values(audioRefs.current) as HTMLAudioElement[]).forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    ttsSpeakingRef.current = false; // Reset TTS state for new scene
    startTimeRef.current = null;    // Postpone start timer until loaded/started

    const activeScene = scenes[index];
    if (!activeScene) return;

    // Synchronize both state and ref
    updateCurrentIndex(index);

    const audio = audioRefs.current[activeScene.id];
    if (audio && activeScene.audioUrl) {
      audio.muted = isMuted;

      const onAudioMetadataLoaded = () => {
        startTimeRef.current = performance.now();
        audio.play().catch((err) => {
          console.warn("Audio playback error, falling back to Web Speech Synthesis:", err);
          speakWithBrowserTTS(activeScene.narration, index);
        });
      };

      if (audio.readyState >= 1) {
        onAudioMetadataLoaded();
      } else {
        audio.onloadedmetadata = onAudioMetadataLoaded;
      }

      // Safety fallback in case loading audio metadata gets stuck
      setTimeout(() => {
        if (currentIndexRef.current === index && startTimeRef.current === null && audio.readyState < 1) {
          startTimeRef.current = performance.now();
          audio.play().catch(() => {});
        }
      }, 800);
    } else {
      speakWithBrowserTTS(activeScene.narration, index);
    }
    
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    tick();
  };

  const tick = () => {
    const activeScene = scenes[currentIndexRef.current];
    if (!activeScene) return;

    // Wait until the audio metadata has loaded or speech has started
    if (!startTimeRef.current) {
      drawFrame(0, activeScene);
      animationRef.current = requestAnimationFrame(tick);
      return;
    }

    const now = performance.now();
    const audio = audioRefs.current[activeScene.id];
    let isEnded = false;
    let currentProgress = 0;
    const offsetSecs = syncOffset / 1000;

    if (audio && activeScene.audioUrl) {
      // Audio element case: let the real audio control the duration and completion precisely
      const duration = audio.duration || activeScene.duration_seconds || 8;
      
      // Adjust visual playhead timing using sync offset
      const adjustedVisualTime = Math.max(0, audio.currentTime + offsetSecs);
      currentProgress = Math.min(adjustedVisualTime / duration, 1);

      if (audio.ended) {
        isEnded = true;
      } else if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        isEnded = audio.currentTime >= audio.duration;
      } else {
        // Fallback if metadata is loading or duration is unavailable yet
        const elapsed = (now - startTimeRef.current) / 1000;
        const fallbackDuration = activeScene.duration_seconds || 8;
        const adjustedElapsed = Math.max(0, elapsed + offsetSecs);
        currentProgress = Math.min(adjustedElapsed / fallbackDuration, 1);
        isEnded = elapsed >= fallbackDuration;
      }
    } else {
      // Browser Speech Synthesis case
      const words = activeScene.narration.split(/\s+/).length;
      const estimatedDuration = Math.max(5, words / 2.2); // Speaking rate: ~2.2 words/sec
      const elapsed = (now - startTimeRef.current) / 1000;

      const adjustedElapsed = Math.max(0, elapsed + offsetSecs);
      currentProgress = Math.min(adjustedElapsed / estimatedDuration, 1);

      // We consider speech ended when:
      // (1) browser indicates TTS is done speaking, OR
      // (2) we have exceeded the estimated duration plus a generous 5s buffer (safety lockup protection)
      const isSpeechDone = !ttsSpeakingRef.current;
      if (isSpeechDone) {
        isEnded = true;
      } else if (elapsed >= estimatedDuration + 5) {
        isEnded = true;
      }
    }

    setProgress(currentProgress);

    // Render Canvas Frame
    drawFrame(currentProgress, activeScene);

    if (!isEnded) {
      animationRef.current = requestAnimationFrame(tick);
    } else {
      // Finished current scene
      if (currentIndexRef.current < scenes.length - 1) {
        const nextIndex = currentIndexRef.current + 1;
        updateCurrentIndex(nextIndex);
        if (onSceneChange) onSceneChange(nextIndex);
        playScene(nextIndex);
      } else {
        // Entire video completed
        setIsPlaying(false);
        setProgress(1);
      }
    }
  };

  // Helper functions for captions & karaoke timing
  const getNarrationChunks = (narration: string): string[] => {
    if (!narration) return [];
    const sentences = narration.match(/[^.!?]+[.!?]*/g) || [narration];
    return sentences.map(s => s.trim()).filter(Boolean);
  };

  const getActiveCaption = (p: number, narration: string) => {
    const chunks = getNarrationChunks(narration);
    if (chunks.length === 0) return { text: "", chunkProgress: 0 };
    if (chunks.length === 1) return { text: chunks[0], chunkProgress: p };
    
    const chunkWordCounts = chunks.map(chunk => chunk.split(/\s+/).filter(Boolean).length);
    const totalWords = chunkWordCounts.reduce((a, b) => a + b, 0);
    if (totalWords === 0) return { text: chunks[0], chunkProgress: p };
    
    let cumulativeWeight = 0;
    for (let i = 0; i < chunks.length; i++) {
      const startP = cumulativeWeight / totalWords;
      const chunkWeight = chunkWordCounts[i] / totalWords;
      const endP = startP + chunkWeight;
      
      if (p >= startP && p <= endP) {
        const chunkProgress = (p - startP) / chunkWeight;
        return { text: chunks[i], chunkProgress: Math.min(1, Math.max(0, chunkProgress)) };
      }
      cumulativeWeight += chunkWordCounts[i];
    }
    
    return { text: chunks[chunks.length - 1], chunkProgress: 1 };
  };

  const drawCaptions = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, text: string, accentColor: string) => {
    if (!text) return;
    
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;
    
    const currentWordIndex = Math.min(Math.floor(p * words.length), words.length - 1);
    
    ctx.save();
    
    const bottomY = h - 65;
    
    ctx.font = "bold 22px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    const gap = 6;
    let totalTextWidth = 0;
    const wordWidths = words.map(word => {
      const width = ctx.measureText(word).width;
      totalTextWidth += width + gap;
      return width;
    });
    totalTextWidth -= gap;
    
    const paddingX = 24;
    const paddingY = 12;
    const bgWidth = Math.min(w - 60, totalTextWidth + paddingX * 2);
    const bgHeight = 44;
    const bgX = (w - bgWidth) / 2;
    const bgY = bottomY - bgHeight / 2;
    
    ctx.fillStyle = "rgba(10, 10, 12, 0.85)";
    ctx.beginPath();
    ctx.roundRect(bgX, bgY, bgWidth, bgHeight, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    
    let startX = (w - Math.min(w - 100, totalTextWidth)) / 2;
    let scaleFactor = 1;
    if (totalTextWidth > w - 100) {
      scaleFactor = (w - 100) / totalTextWidth;
      ctx.font = `bold ${Math.max(12, Math.floor(22 * scaleFactor))}px 'Inter', sans-serif`;
      
      totalTextWidth = 0;
      words.forEach((word, index) => {
        const width = ctx.measureText(word).width;
        totalTextWidth += width + gap;
        wordWidths[index] = width;
      });
      totalTextWidth -= gap;
      startX = (w - totalTextWidth) / 2;
    }
    
    let currentX = startX;
    words.forEach((word, index) => {
      const isCurrent = index === currentWordIndex;
      if (isCurrent) {
        ctx.fillStyle = accentColor || "#7c6af7";
      } else {
        ctx.fillStyle = "#ffffff";
      }
      
      ctx.fillText(word, currentX + wordWidths[index] / 2, bottomY);
      currentX += wordWidths[index] + gap;
    });
    
    ctx.restore();
  };

  // Draw scene contents onto HTML5 Canvas
  const drawFrame = (p: number, scene: Scene) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.save();

    // Smooth scene transitions (BUG-010 / F-P1-03)
    const tType = scene.transition_type || "fade";
    if (tType === "fade") {
      if (p < 0.08) {
        ctx.globalAlpha = p / 0.08;
      } else if (p > 0.92) {
        ctx.globalAlpha = (1 - p) / 0.08;
      }
    } else if (tType === "slide-left") {
      if (p < 0.08) {
        const slideX = (1 - p / 0.08) * w;
        ctx.translate(slideX, 0);
      } else if (p > 0.92) {
        const slideX = -((p - 0.92) / 0.08) * w;
        ctx.translate(slideX, 0);
      }
    } else if (tType === "slide-right") {
      if (p < 0.08) {
        const slideX = -(1 - p / 0.08) * w;
        ctx.translate(slideX, 0);
      } else if (p > 0.92) {
        const slideX = ((p - 0.92) / 0.08) * w;
        ctx.translate(slideX, 0);
      }
    } else if (tType === "zoom-in") {
      if (p < 0.08) {
        const scale = 0.96 + (p / 0.08) * 0.04;
        ctx.translate(w / 2, h / 2);
        ctx.scale(scale, scale);
        ctx.translate(-w / 2, -h / 2);
      } else if (p > 0.92) {
        const scale = 1.0 + ((p - 0.92) / 0.08) * 0.04;
        ctx.translate(w / 2, h / 2);
        ctx.scale(scale, scale);
        ctx.translate(-w / 2, -h / 2);
      }
    }

    const currentImageUrl = sceneThumbnails[scene.id] || scene.imageUrl;

    // 1. Background
    if (currentImageUrl) {
      const img = new Image();
      img.src = currentImageUrl;
      if (img.complete) {
        const imgRatio = img.width / img.height;
        const canvasRatio = w / h;
        let drawWidth = w;
        let drawHeight = h;
        let offsetX = 0;
        let offsetY = 0;

        if (imgRatio > canvasRatio) {
          drawWidth = h * imgRatio;
          offsetX = (w - drawWidth) / 2;
        } else {
          drawHeight = w / imgRatio;
          offsetY = (h - drawHeight) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        ctx.fillStyle = "rgba(10, 10, 12, 0.72)";
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.fillStyle = scene.bg_color || "#15131A";
        ctx.fillRect(0, 0, w, h);
        img.onload = () => {
          drawFrame(p, scene);
        };
      }
    } else {
      ctx.fillStyle = scene.bg_color || "#15131A";
      ctx.fillRect(0, 0, w, h);
    }

    // Decorative backdrop grids or glowing circles
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
    for (let j = 0; j < h; j += 40) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(w, j);
      ctx.stroke();
    }

    // Glowing background orb
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, 400 + Math.sin(p * Math.PI) * 50);
    gradient.addColorStop(0, `${scene.accent_color}1a`);
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 500, 0, Math.PI * 2);
    ctx.fill();

    // 2. Main Drawing Router based on Scene Type
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    switch (scene.type) {
      case "title_card":
        renderTitleCard(ctx, w, h, p, scene);
        break;
      case "concept_split":
        renderConceptSplit(ctx, w, h, p, scene);
        break;
      case "bullet_reveal":
        renderBulletReveal(ctx, w, h, p, scene);
        break;
      case "analogy_card":
        renderAnalogyCard(ctx, w, h, p, scene);
        break;
      case "data_stat":
        renderDataStat(ctx, w, h, p, scene);
        break;
      case "timeline":
        renderTimeline(ctx, w, h, p, scene);
        break;
      case "quote_card":
        renderQuoteCard(ctx, w, h, p, scene);
        break;
      case "summary_card":
        renderSummaryCard(ctx, w, h, p, scene);
        break;
      default:
        // Fallback title card
        renderTitleCard(ctx, w, h, p, scene);
        break;
    }

    ctx.restore();

    // Render Captions overlay outside the scene transition boundary (F-P1-01)
    if (captionsEnabled && scene.narration) {
      const activeCap = getActiveCaption(p, scene.narration);
      drawCaptions(ctx, w, h, activeCap.chunkProgress, activeCap.text, scene.accent_color);
    }

    // Progress bar at the bottom
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(0, h - 8, w, 8);
    ctx.fillStyle = scene.accent_color || "#7c6af7";
    ctx.fillRect(0, h - 8, w * p, 8);
  };

  // Rendering Layout Helpers
  const renderTitleCard = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: Scene) => {
    // Title slides up and fades in smoothly
    const yOffset = (1 - p) * 35;
    const accent = s.accent_color || "#818cf8";

    // Frosted Glass Effect Center Panel
    ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 320, h / 2 - 200, 640, 400, 24);
    ctx.fill();
    ctx.stroke();

    // Fine decorative concentric rings
    ctx.strokeStyle = `${accent}25`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 - 110, 85 + Math.sin(p * Math.PI) * 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `${accent}40`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 - 110, 60 + Math.cos(p * Math.PI) * 6, 0, Math.PI * 2);
    ctx.stroke();

    // Central pulsing core
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 - 110, 18 + Math.sin(p * Math.PI * 2) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // reset shadow

    // Tag Badge with JetBrains Mono font
    ctx.fillStyle = `${accent}15`;
    ctx.strokeStyle = `${accent}35`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 120, h / 2 - 25, 240, 28, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px 'Inter', sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText("VYAKHYA CREATOR STUDIO", w / 2, h / 2 - 11);
    ctx.letterSpacing = "0px"; // reset

    // Main Headline using modern 'Outfit' font
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 42px 'Space Grotesk', sans-serif";
    ctx.fillText(s.headline, w / 2, h / 2 + 50 - yOffset);

    // Decorative line below headline
    ctx.strokeStyle = `rgba(255, 255, 255, 0.15)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 160, h / 2 + 105);
    ctx.lineTo(w / 2 + 160, h / 2 + 105);
    ctx.stroke();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 40 * p, h / 2 + 105);
    ctx.lineTo(w / 2 + 40 * p, h / 2 + 105);
    ctx.stroke();

    // Visual Instruction / Theme footer
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.font = "500 13px 'Inter', sans-serif";
    ctx.fillText(`DIRECTIVE: ${s.visual_instruction.toUpperCase()}`, w / 2, h / 2 + 145);
  };

  const renderConceptSplit = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: Scene) => {
    const accent = s.accent_color || "#818cf8";
    
    // Header Headline using Outfit
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 30px 'Space Grotesk', sans-serif";
    ctx.fillText(s.headline, w / 2, 75);

    const cardW = w / 2 - 80;
    const cardH = h - 230;
    const cardY = 130;

    // LEFT BENTO-CARD
    const leftX = w / 4 - 20;
    const leftOffset = (1 - Math.min(p * 1.5, 1)) * 30;

    ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
    ctx.strokeStyle = `${accent}25`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(45, cardY, cardW, cardH, 20);
    ctx.fill();
    ctx.stroke();

    // Left Title tag
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 24px 'Space Grotesk', sans-serif";
    ctx.fillText(s.left_label || "Concept A", leftX, cardY + 45 + leftOffset);

    // Left comparison illustration (Dynamic Node structure)
    const leftCenterY = cardY + cardH / 2 + 10;
    ctx.strokeStyle = `${accent}40`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftX - 60, leftCenterY - 30);
    ctx.lineTo(leftX, leftCenterY + 40);
    ctx.lineTo(leftX + 60, leftCenterY - 30);
    ctx.closePath();
    ctx.stroke();

    const nodeCoords = [
      { x: leftX - 60, y: leftCenterY - 30 },
      { x: leftX, y: leftCenterY + 40 },
      { x: leftX + 60, y: leftCenterY - 30 },
      { x: leftX, y: leftCenterY - 15 }
    ];

    nodeCoords.forEach((node, i) => {
      ctx.fillStyle = i === 3 ? "#ffffff" : accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = i === 3 ? 0 : 8;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 8 + Math.sin(p * Math.PI + i) * 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = "500 14px 'Inter', sans-serif";
    ctx.fillText("INTEGRATED SYSTEM NODES", leftX, cardY + cardH - 40 + leftOffset);


    // RIGHT BENTO-CARD
    const rightX = (w / 4) * 3 + 20;
    const rightOffset = (1 - Math.min(p * 1.5, 1)) * 30;

    ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(w / 2 + 35, cardY, cardW, cardH, 20);
    ctx.fill();
    ctx.stroke();

    // Right Title tag
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 24px 'Space Grotesk', sans-serif";
    ctx.fillText(s.right_label || "Concept B", rightX, cardY + 45 + rightOffset);

    // Right comparison illustration (Dynamic orbital shell target structure)
    const rightCenterY = cardY + cardH / 2 + 10;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(rightX, rightCenterY, 65, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.beginPath();
    ctx.arc(rightX, rightCenterY, 40, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(rightX + Math.cos(p * Math.PI * 2) * 40, rightCenterY + Math.sin(p * Math.PI * 2) * 40, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.arc(rightX, rightCenterY, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = "500 14px 'Inter', sans-serif";
    ctx.fillText("ORBITAL SHELL MODEL", rightX, cardY + cardH - 40 + rightOffset);


    // CENTRAL VS BADGE
    ctx.fillStyle = "#121214";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, cardY + cardH / 2, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.font = "bold 15px 'Inter', sans-serif";
    ctx.fillText("VS", w / 2, cardY + cardH / 2 + 1);
  };

  const renderBulletReveal = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: Scene) => {
    const accent = s.accent_color || "#818cf8";
    
    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 30px 'Space Grotesk', sans-serif";
    ctx.fillText(s.headline, w / 2, 75);

    const bullets = s.bullets || ["Core point one", "Core point two", "Core point three"];
    const startY = 160;
    const spacingY = 85;

    bullets.forEach((bullet, index) => {
      // Calculate staggered entrance
      const triggerP = index * 0.22;
      const bulletP = Math.max(0, Math.min((p - triggerP) / 0.22, 1));

      if (bulletP > 0) {
        const xOffset = (1 - bulletP) * 35;
        const alpha = bulletP;

        const cardX = 120;
        const cardY = startY + index * spacingY;
        const cardW = w - 240;
        const cardH = 68;

        // Card Container with frosted styling
        ctx.fillStyle = `rgba(255, 255, 255, ${0.02 * alpha})`;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 * alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cardX - xOffset, cardY - cardH / 2, cardW, cardH, 14);
        ctx.fill();
        ctx.stroke();

        // Color Accent strip on the left edge
        ctx.fillStyle = `rgba(${parseInt(accent.slice(1, 3), 16) || 129}, ${parseInt(accent.slice(3, 5), 16) || 140}, ${parseInt(accent.slice(5, 7), 16) || 248}, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(cardX - xOffset, cardY - cardH / 2, 6, cardH, [14, 0, 0, 14]);
        ctx.fill();

        // Index indicator with JetBrains Mono
        ctx.fillStyle = `rgba(255, 255, 255, ${0.35 * alpha})`;
        ctx.font = "500 13px 'Inter', sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`0${index + 1}`, cardX + 30 - xOffset, cardY + 1);

        // Separator line
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cardX + 65 - xOffset, cardY - 14);
        ctx.lineTo(cardX + 65 - xOffset, cardY + 14);
        ctx.stroke();

        // Bullet text with Outfit font
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = "500 18px 'Space Grotesk', sans-serif";
        ctx.fillText(bullet, cardX + 85 - xOffset, cardY + 1);
        ctx.textAlign = "center"; // reset
      }
    });
  };

  const renderAnalogyCard = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: Scene) => {
    const accent = s.accent_color || "#818cf8";

    // Headline using Outfit
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 30px 'Space Grotesk', sans-serif";
    ctx.fillText(s.headline, w / 2, 75);

    // Split Canvas Left and Right
    const leftX = w / 4 + 20;
    const rightX = (w / 4) * 3 - 20;

    // --- LEFT GRAPHIC (The Metaphor Lightbulb/Core) ---
    const centerY = h / 2 + 15;
    const coreRad = 55 + Math.sin(p * Math.PI) * 6;

    // Outer glow ring
    ctx.strokeStyle = `${accent}15`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(leftX, centerY, coreRad + 25, 0, Math.PI * 2);
    ctx.stroke();

    // Secondary colored ring
    ctx.strokeStyle = `${accent}35`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(leftX, centerY, coreRad, 0, Math.PI * 2);
    ctx.stroke();

    // Geometric lines connecting core to infinity
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 + p * 0.25;
      ctx.beginPath();
      ctx.moveTo(leftX + Math.cos(angle) * coreRad, centerY + Math.sin(angle) * coreRad);
      ctx.lineTo(leftX + Math.cos(angle) * (coreRad + 50), centerY + Math.sin(angle) * (coreRad + 50));
      ctx.stroke();
    }

    // Inner core sphere
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(leftX, centerY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // reset

    // --- RIGHT ANALOGY CONTENT (Frosted Quote Card) ---
    const boxW = w / 2 - 40;
    const boxH = h - 230;
    const boxY = 130;

    ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 10, boxY, boxW, boxH, 20);
    ctx.fill();
    ctx.stroke();

    // Decorative quote marks with Playfair Display
    ctx.fillStyle = `${accent}18`;
    ctx.font = "italic bold 100px 'Space Grotesk', sans-serif";
    ctx.fillText("“", w / 2 + 35, boxY + 75);

    // Headline/Tag
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "600 11px 'Inter', sans-serif";
    ctx.letterSpacing = "1.5px";
    ctx.fillText("CONCEPTUAL METAPHOR", w / 2 + boxW / 2 - 10, boxY + 35);
    ctx.letterSpacing = "0px";

    // Metaphor description text wrap
    const metaphorText = s.analogy_text || "A great way to think of this is like a lock and key.";
    const words = metaphorText.split(" ");
    let line = "";
    let lines = [];
    const maxWidth = boxW - 80;

    ctx.font = "italic 21px 'Space Grotesk', sans-serif";
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + " ";
      let metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + " ";
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    // Draw wrapped lines inside the citation card
    ctx.fillStyle = "#ffffff";
    const startLinesY = boxY + (boxH - (lines.length * 32)) / 2 + 10;
    lines.forEach((l, idx) => {
      ctx.fillText(l.trim(), w / 2 + boxW / 2 - 10, startLinesY + idx * 34);
    });
  };

  const renderDataStat = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: Scene) => {
    const accent = s.accent_color || "#818cf8";

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 30px 'Space Grotesk', sans-serif";
    ctx.fillText(s.headline, w / 2, 75);

    // Extract numerical value
    const targetVal = s.stat_value || "100%";
    const numOnly = parseInt(targetVal) || 0;
    const suffix = targetVal.replace(/[0-9]/g, "");

    // Count Up animation
    const currentNum = Math.floor(numOnly * p);
    const textToShow = `${currentNum}${suffix}`;

    // Modern Double Ring Gauge
    const centerX = w / 2;
    const centerY = h / 2 - 10;
    const radius = 100;

    // Track arc
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI, Math.PI);
    ctx.stroke();

    // Secondary fine decorative dotted loop
    ctx.strokeStyle = `${accent}22`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 15, -Math.PI, Math.PI);
    ctx.stroke();
    ctx.setLineDash([]); // reset

    // Active fill gauge
    ctx.strokeStyle = accent;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * p));
    ctx.stroke();
    ctx.lineCap = "butt"; // reset

    // Giant stat count-up text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 82px 'Space Grotesk', sans-serif";
    ctx.fillText(textToShow, centerX, centerY);

    // Label Card below
    const labelBoxY = h / 2 + 115;
    ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 200, labelBoxY - 25, 400, 50, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.font = "600 11px 'Inter', sans-serif";
    ctx.letterSpacing = "1.5px";
    ctx.fillText(s.stat_label?.toUpperCase() || "CRITICAL PERFORMANCE INDICATOR", w / 2, labelBoxY + 3);
    ctx.letterSpacing = "0px";
  };

  const renderTimeline = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: Scene) => {
    const accent = s.accent_color || "#818cf8";

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 30px 'Space Grotesk', sans-serif";
    ctx.fillText(s.headline, w / 2, 75);

    const steps = s.steps || ["Stage 1", "Stage 2", "Stage 3", "Stage 4"];
    const startX = 160;
    const lineW = w - 320;
    const centerY = h / 2 + 15;

    // Background track line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(startX, centerY);
    ctx.lineTo(startX + lineW, centerY);
    ctx.stroke();

    // Active glowing fill line
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(startX, centerY);
    ctx.lineTo(startX + lineW * p, centerY);
    ctx.stroke();
    ctx.lineCap = "butt"; // reset

    steps.forEach((step, index) => {
      const stepX = startX + (lineW / (steps.length - 1)) * index;
      const stepTriggerP = index / (steps.length - 1);
      const isActive = p >= stepTriggerP;

      const scale = isActive ? 1.0 : 0.88;
      const opacity = isActive ? 1.0 : 0.4;

      // Draw custom node card
      ctx.fillStyle = "rgba(20, 20, 22, 0.95)";
      ctx.strokeStyle = isActive ? accent : "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(stepX - 60, centerY - 80, 120, 48, 10);
      ctx.fill();
      ctx.stroke();

      // Badge indicator inside card
      ctx.fillStyle = isActive ? `${accent}20` : "rgba(255, 255, 255, 0.05)";
      ctx.beginPath();
      ctx.roundRect(stepX - 50, centerY - 72, 24, 18, 5);
      ctx.fill();

      ctx.fillStyle = isActive ? accent : "rgba(255, 255, 255, 0.4)";
      ctx.font = "bold 10px 'Inter', sans-serif";
      ctx.fillText(`0${index + 1}`, stepX - 38, centerY - 63);

      // Label beneath
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.font = isActive ? "bold 15px 'Space Grotesk', sans-serif" : "14px 'Space Grotesk', sans-serif";
      ctx.fillText(step, stepX, centerY + 45);

      // Small glowing core dot on the track line
      ctx.fillStyle = isActive ? "#ffffff" : "#1e1e24";
      ctx.strokeStyle = isActive ? accent : "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(stepX, centerY, isActive ? 9 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  };

  const renderQuoteCard = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: Scene) => {
    const accent = s.accent_color || "#818cf8";

    // Elite glass block frame
    ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(100, 100, w - 200, h - 200, 24);
    ctx.fill();
    ctx.stroke();

    // Giant artistic quote marks with Playfair Display
    ctx.fillStyle = `${accent}22`;
    ctx.font = "italic bold 180px 'Space Grotesk', sans-serif";
    ctx.fillText("“", 180, 240);

    // Simple word wrapping for quote
    const text = s.quote_text || "Quote text is missing.";
    const words = text.split(" ");
    let line = "";
    let lines = [];
    const maxWidth = w - 320;

    ctx.font = "italic 25px 'Space Grotesk', sans-serif";
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + " ";
      let metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + " ";
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    // Draw quote text
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(p * 2, 1)})`;
    const startY = h / 2 - (lines.length - 1) * 20;
    lines.forEach((l, idx) => {
      ctx.fillText(l.trim(), w / 2, startY + idx * 38);
    });

    // Author attribution with minimal glowing line
    if (p > 0.4) {
      const alpha = (p - 0.4) * 1.6;
      const attributionY = h / 2 + lines.length * 25 + 35;

      ctx.strokeStyle = `${accent}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 30, attributionY - 14);
      ctx.lineTo(w / 2 + 30, attributionY - 14);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 255, 255, ${0.75 * alpha})`;
      ctx.font = "600 15px 'Inter', sans-serif";
      ctx.letterSpacing = "1px";
      ctx.fillText(`— ${s.quote_attribution?.toUpperCase() || "SOURCE UNKNOWN"}`, w / 2, attributionY + 12);
      ctx.letterSpacing = "0px"; // reset
    }
  };

  const renderSummaryCard = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: Scene) => {
    const accent = s.accent_color || "#818cf8";

    // Ambient center core glow
    const glowRad = p * 160;
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, glowRad);
    gradient.addColorStop(0, `${accent}1c`);
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, glowRad, 0, Math.PI * 2);
    ctx.fill();

    // Headline with Outfit
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 42px 'Space Grotesk', sans-serif";
    ctx.fillText(s.headline, w / 2, h / 2 - 50);

    // Subtitle complete indicator
    ctx.fillStyle = accent;
    ctx.font = "bold 13px 'Inter', sans-serif";
    ctx.letterSpacing = "3px";
    ctx.fillText("EXPLAINER SUMMARY", w / 2, h / 2 + 10);
    ctx.letterSpacing = "0px";

    // Elegant separator lines extending horizontally
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 180, h / 2 + 50);
    ctx.lineTo(w / 2 + 180, h / 2 + 50);
    ctx.stroke();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 70 * p, h / 2 + 50);
    ctx.lineTo(w / 2 + 70 * p, h / 2 + 50);
    ctx.stroke();

    // Little footer brand stamp
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "500 13px 'Space Grotesk', sans-serif";
    ctx.fillText("Vyakhya - Professional Storyteller Engine", w / 2, h / 2 + 90);
  };

  // Recording Engine to merge Audio + Canvas stream into WebM file
  const startRecordingVideo = async () => {
    if (scenes.length === 0) return;
    setIsRecording(true);
    setRecordProgress(0);

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas element not loaded");

      // Setup Web Audio Context and Destination Node
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const destNode = audioCtx.createMediaStreamDestination();

      // Create video track from canvas
      const canvasStream = canvas.captureStream(30); // 30 FPS
      const tracks: MediaStreamTrack[] = [canvasStream.getVideoTracks()[0]];

      // Connect all audio elements to node if they exist
      const audioSources = scenes.map((scene) => {
        const audio = audioRefs.current[scene.id];
        if (audio) {
          const source = audioCtx.createMediaElementSource(audio);
          source.connect(destNode);
          source.connect(audioCtx.destination); // Let user hear it during render
          return { audio, source };
        }
        return null;
      });

      // Add audio track to streams
      if (destNode.stream.getAudioTracks().length > 0) {
        tracks.push(destNode.stream.getAudioTracks()[0]);
      }

      const combinedStream = new MediaStream(tracks);
      
      let selectedMimeType = "video/webm;codecs=vp9,opus";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
          selectedMimeType = "video/webm;codecs=vp9,opus";
        } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
          selectedMimeType = "video/webm;codecs=vp9";
        } else if (MediaRecorder.isTypeSupported("video/webm")) {
          selectedMimeType = "video/webm";
        } else if (MediaRecorder.isTypeSupported("video/mp4")) {
          selectedMimeType = "video/mp4";
        } else {
          selectedMimeType = "";
        }
      }

      if (!selectedMimeType) {
      showToast("Your browser doesn't support video recording natively. Please use Chrome, Firefox, or Edge.", "error");
        setIsRecording(false);
        return;
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: selectedMimeType,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const ext = selectedMimeType.includes("mp4") ? "mp4" : "webm";
        const finalBlob = new Blob(chunks, { type: selectedMimeType || `video/${ext}` });
        const url = URL.createObjectURL(finalBlob);

        // Download client side
        const a = document.createElement("a");
        a.href = url;
        a.download = `${scenes[0].headline.toLowerCase().replace(/[^a-z0-9]/g, "_")}_vyakhya_explainer.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Cleanup audio sources connections
        audioSources.forEach((as) => {
          if (as) as.source.disconnect();
        });
        audioCtx.close();
        setIsRecording(false);
      };

      // Play each scene sequentially to record
      recorder.start();

      for (let i = 0; i < scenes.length; i++) {
        setCurrentIndex(i);
        if (onSceneChange) onSceneChange(i);

        setRecordProgress(Math.floor((i / scenes.length) * 100));

        // Play matching audio
        const scene = scenes[i];
        const audio = audioRefs.current[scene.id];
        if (audio) {
          audio.currentTime = 0;
          audio.play();
          // Wait for audio to finish playing
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
          });
        } else {
          // fallback delay if no audio
          await new Promise((resolve) => setTimeout(resolve, scene.duration_seconds * 1000));
        }
      }

      setRecordProgress(100);
      recorder.stop();
    } catch (err) {
      console.error("Recording failed:", err);
      setIsRecording(false);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      // Pause current audio
      const audio = audioRefs.current[scenes[currentIndexRef.current]?.id];
      if (audio) audio.pause();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } else {
      setIsPlaying(true);
      playScene(currentIndexRef.current);
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    const audio = audioRefs.current[scenes[currentIndexRef.current]?.id];
    if (audio) audio.muted = newMuted;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      if (newMuted) {
        window.speechSynthesis.cancel();
      } else if (isPlaying) {
        speakWithBrowserTTS(scenes[currentIndexRef.current]?.narration || "", currentIndexRef.current);
      }
    }
  };

  const restartVideo = () => {
    updateCurrentIndex(0);
    setProgress(0);
    if (onSceneChange) onSceneChange(0);
    if (isPlaying) {
      playScene(0);
    } else {
      drawFrame(0, scenes[0]);
    }
  };

  return (
    <div id="renderer_container" className="flex flex-col items-center bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden p-4 shadow-2xl w-full">
      {/* Hidden Audio element storage for all scene voices */}
      {scenes.map((scene) => (
        <audio
          key={scene.id}
          ref={(el) => {
            if (el && scene.audioUrl) {
              audioRefs.current[scene.id] = el;
            }
          }}
          src={scene.audioUrl ? `data:audio/wav;base64,${scene.audioUrl}` : undefined}
          preload="auto"
        />
      ))}

      {/* Actual HTML5 Canvas */}
      <div className="relative w-full aspect-video rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="w-full h-full object-contain"
        />

        {/* Loading Overlay */}
        {scenes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm text-zinc-400">
            <RefreshCw className="animate-spin w-10 h-10 mb-2 text-indigo-500" />
            <p className="font-medium text-sm">Awaiting scene scripts...</p>
          </div>
        )}

        {/* Rendering / Export progress bar overlay */}
        {isRecording && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white p-6">
            <RefreshCw className="animate-spin w-12 h-12 text-indigo-500 mb-4" />
            <p className="text-xl font-bold tracking-wide">Compiling Explainer Video...</p>
            <p className="text-sm text-zinc-400 mt-1">Please do not close this window</p>
            <div className="w-64 bg-zinc-800 h-2.5 rounded-full overflow-hidden mt-6">
              <div
                className="bg-indigo-500 h-full transition-all duration-300"
                style={{ width: `${recordProgress}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 mt-2 font-mono">{recordProgress}% completed</p>
          </div>
        )}
      </div>

      {/* Control Actions bar */}
      <div className="flex items-center justify-between mt-4 w-full text-zinc-200">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={scenes.length === 0 || isRecording}
            className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-full p-2.5 shadow-md transition"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
          </button>

          <button
            onClick={restartVideo}
            disabled={scenes.length === 0 || isRecording}
            className="flex items-center justify-center border border-zinc-700 hover:bg-zinc-900 disabled:opacity-50 text-zinc-300 rounded-full p-2.5 transition"
            title="Restart Video"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          <button
            onClick={toggleMute}
            disabled={scenes.length === 0 || isRecording}
            className="flex items-center justify-center border border-zinc-700 hover:bg-zinc-900 disabled:opacity-50 text-zinc-300 rounded-full p-2.5 transition"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-500" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {/* CC Caption Toggle (F-P1-01) */}
          <button
            onClick={() => {
              const newval = !captionsEnabled;
              setCaptionsEnabled(newval);
              localStorage.setItem("vyakhya_captions_enabled", String(newval));
            }}
            disabled={scenes.length === 0 || isRecording}
            className={`flex items-center justify-center border ${
              captionsEnabled ? "bg-indigo-600/20 border-indigo-500 text-indigo-400 font-extrabold" : "border-zinc-700 text-zinc-300"
            } hover:bg-zinc-900 disabled:opacity-50 rounded-full w-10 h-10 transition`}
            title={captionsEnabled ? "Disable Captions" : "Enable Captions"}
          >
            <span className="text-xs font-mono">CC</span>
          </button>
        </div>

        {/* Current scene marker details */}
        {scenes.length > 0 && (
          <div className="text-xs font-mono text-zinc-400 select-none">
            Scene {currentIndex + 1} of {scenes.length} ({Math.floor(progress * 100)}%)
          </div>
        )}

        <button
          onClick={startRecordingVideo}
          disabled={scenes.length === 0 || isRecording}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 font-medium px-4 py-2 rounded-xl text-sm transition"
          title="Export and Download local .webm video"
        >
          <Download className="w-4 h-4" />
          <span>Export Video</span>
        </button>
      </div>

      {!scenes.every((s) => s.audioUrl) && scenes.length > 0 && (
        <div className="text-xs text-amber-500 mt-2 text-center select-none font-medium">
          Note: Some scene audios are missing due to rate limits and will export with silence. Browser-native text-to-speech will narrate them live during playback!
        </div>
      )}

      {/* Active Scene Customizer Panel (F-P1-04, F-P2-06, F-P1-03) */}
      {isEditable && activeScene && (
        <div className="mt-6 w-full border-t border-zinc-800 pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-indigo-400">
              Customize Active Scene {currentIndex + 1}
            </h3>
            <span className="text-xs font-mono text-zinc-500 bg-zinc-900 px-2 py-1 rounded">
              Type: {activeScene.type}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Headline and Narration */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Headline</label>
                <input
                  type="text"
                  value={editHeadline}
                  onChange={(e) => setEditHeadline(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Voiceover Script (Narration)</label>
                <textarea
                  value={editNarration}
                  rows={3}
                  onChange={(e) => setEditNarration(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                />
              </div>
            </div>

            {/* Styling, Color Themes, and Transitions */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1">Transition Animation</label>
                  <select
                    value={editTransition}
                    onChange={(e) => setEditTransition(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                  >
                    <option value="fade">Fade Cross</option>
                    <option value="slide-left">Slide Left</option>
                    <option value="slide-right">Slide Right</option>
                    <option value="zoom-in">Zoom In</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1">Accent Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={editAccentColor}
                      onChange={(e) => setEditAccentColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={editAccentColor}
                      onChange={(e) => setEditAccentColor(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Background Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={editBgColor}
                    onChange={(e) => setEditBgColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={editBgColor}
                    onChange={(e) => setEditBgColor(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Preset Palette Buttons */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1">Preset Palettes</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditBgColor("#0a0a16"); setEditAccentColor("#3D3A8C"); }}
                    className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 px-2 py-1 rounded text-[10px] font-bold text-indigo-400 font-sans cursor-pointer"
                  >
                    Indigo Slate
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditBgColor("#06120e"); setEditAccentColor("#10b981"); }}
                    className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 px-2 py-1 rounded text-[10px] font-bold text-emerald-400 font-sans cursor-pointer"
                  >
                    Forest Green
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditBgColor("#100826"); setEditAccentColor("#a855f7"); }}
                    className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 px-2 py-1 rounded text-[10px] font-bold text-purple-400 font-sans cursor-pointer"
                  >
                    Midnight Violet
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditBgColor("#1a1206"); setEditAccentColor("#f59e0b"); }}
                    className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 px-2 py-1 rounded text-[10px] font-bold text-amber-400 font-sans cursor-pointer"
                  >
                    Warm Ember
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (isRegeneratingAudio) return;
                  setIsRegeneratingAudio(true);
                  try {
                    const activeLanguage = language || "en-IN";
                    const activePref = voicePreference || "female";
                    
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
                    
                    const voiceName = getVoiceForPreference(activeLanguage, activePref);

                    const res = await fetch("/api/generate-speech", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        text: editNarration,
                        voice: voiceName,
                        languageCode: activeLanguage,
                      }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      if (data.audio) {
                        // Propagate scene updates back including the base64 audio
                        const updated = scenes.map((s, idx) => {
                          if (idx === currentIndex) {
                            return {
                              ...s,
                              headline: editHeadline,
                              narration: editNarration,
                              transition_type: editTransition,
                              bg_color: editBgColor,
                              accent_color: editAccentColor,
                              audioUrl: data.audio,
                            };
                          }
                          return s;
                        });
                        if (onUpdateScenes) onUpdateScenes(updated);
                        showToast("Speech generated successfully!", "success");
                      }
                    } else {
                      showToast("Could not generate audio. Using browser-native TTS as fallback.", "error");
                    }
                  } catch (e) {
                    console.error(e);
                    showToast("Failed to generate speech. Fallback will narrate natively.", "error");
                  } finally {
                    setIsRegeneratingAudio(false);
                  }
                }}
                disabled={isRegeneratingAudio}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5 font-sans cursor-pointer"
              >
                {isRegeneratingAudio ? <RefreshCw className="animate-spin w-3 h-3" /> : null}
                <span>Regenerate Narration</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  // Propagate colors to all scenes
                  const updated = scenes.map(s => ({
                    ...s,
                    bg_color: editBgColor,
                    accent_color: editAccentColor,
                  }));
                  if (onUpdateScenes) onUpdateScenes(updated);
                  showToast("Theme colors propagated to all storyboard scenes!", "success");
                }}
                className="border border-zinc-800 hover:bg-zinc-900 text-zinc-300 font-bold px-3 py-1.5 rounded-xl text-xs transition font-sans cursor-pointer"
              >
                Apply Palette Globally
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const updated = scenes.map((s, idx) => {
                  if (idx === currentIndex) {
                    return {
                      ...s,
                      headline: editHeadline,
                      narration: editNarration,
                      transition_type: editTransition,
                      bg_color: editBgColor,
                      accent_color: editAccentColor,
                    };
                  }
                  return s;
                });
                if (onUpdateScenes) onUpdateScenes(updated);
                showToast("Scene changes saved!", "success");
              }}
              className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-extrabold px-4 py-2 rounded-xl text-xs transition font-sans cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

