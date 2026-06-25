import React, { useEffect, useRef, useState } from "react";
import { PodcastTurn } from "../types";
import { Play, Pause, RefreshCw, Volume2, VolumeX, SkipForward, Sparkles } from "lucide-react";

interface AudioWaveformProps {
  title: string;
  turns: PodcastTurn[];
  topic: string;
  syncOffset?: number;
}

export default function AudioWaveform({ title, turns, topic, syncOffset = 0 }: AudioWaveformProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTurnIndex, setActiveTurnIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRefs = useRef<{ [key: number]: HTMLAudioElement }>({});
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const animationPhaseRef = useRef<number>(0);

  // Refs to track browser SpeechSynthesis state precisely
  const podcastTtsSpeakingRef = useRef<boolean>(false);
  const podcastUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Reset state when turns change
    setIsPlaying(false);
    setActiveTurnIndex(0);
    setProgress(0);
    stopAllAudio();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  }, [turns]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopAllAudio = () => {
    (Object.values(audioRefs.current) as HTMLAudioElement[]).forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  };

  const [estimatedDuration, setEstimatedDuration] = useState<number>(5);

  const speakTurnWithBrowserTTS = (turn: PodcastTurn) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (isMuted) return;

    window.speechSynthesis.cancel(); // Cancel any current speech
    podcastTtsSpeakingRef.current = true;
    startTimeRef.current = null; // wait for start callback

    const utterance = new SpeechSynthesisUtterance(turn.text);
    podcastUtteranceRef.current = utterance;
    const isJoe = turn.speaker === "host";
    
    // Set pitch/rate based on speaker to distinguish Joe and Jane!
    utterance.pitch = isJoe ? 0.95 : 1.25;
    utterance.rate = 1.05;

    utterance.onstart = () => {
      if (podcastUtteranceRef.current === utterance) {
        startTimeRef.current = performance.now();
      }
    };

    utterance.onend = () => {
      if (podcastUtteranceRef.current === utterance) {
        podcastTtsSpeakingRef.current = false;
      }
    };
    utterance.onerror = () => {
      if (podcastUtteranceRef.current === utterance) {
        podcastTtsSpeakingRef.current = false;
      }
    };

    window.speechSynthesis.speak(utterance);

    // Safety fallback
    setTimeout(() => {
      if (podcastUtteranceRef.current === utterance && startTimeRef.current === null) {
        startTimeRef.current = performance.now();
      }
    }, 500);
  };

  const playTurn = (index: number) => {
    stopAllAudio();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    podcastTtsSpeakingRef.current = false; // Reset state for the new turn
    startTimeRef.current = null; // Wait for metadata/onstart

    const activeTurn = turns[index];
    if (!activeTurn) return;

    const audio = audioRefs.current[index];
    if (audio && activeTurn.audioUrl) {
      audio.muted = isMuted;
      audio.currentTime = 0;

      const onMetadataLoaded = () => {
        startTimeRef.current = performance.now();
        audio.play().catch((err) => {
          console.warn("Audio play failed, falling back to Web Speech:", err);
          speakTurnWithBrowserTTS(activeTurn);
        });
      };

      if (audio.readyState >= 1) {
        onMetadataLoaded();
      } else {
        audio.onloadedmetadata = onMetadataLoaded;
      }

      // Safety fallback
      setTimeout(() => {
        if (activeTurnIndex === index && startTimeRef.current === null && audio.readyState < 1) {
          startTimeRef.current = performance.now();
          audio.play().catch(() => {});
        }
      }, 800);
    } else {
      // Compute estimated duration based on text length (about 2.5 words per second)
      const words = activeTurn.text.split(/\s+/).length;
      setEstimatedDuration(Math.max(4, words / 2.5));
      speakTurnWithBrowserTTS(activeTurn);
    }
    
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    tick();
  };

  const tick = () => {
    // Wait until started
    if (!startTimeRef.current) {
      setProgress(0);
      drawWaveform();
      animationRef.current = requestAnimationFrame(tick);
      return;
    }

    const audio = audioRefs.current[activeTurnIndex];
    let duration = 5;
    let currentProgress = 0;
    let isEnded = false;
    const offsetSecs = syncOffset / 1000;

    if (audio && audio.src) {
      duration = audio.duration || 5;
      currentProgress = Math.min(Math.max(0, audio.currentTime + offsetSecs) / duration, 1);
      isEnded = audio.ended;
    } else {
      // Browser Speech Synthesis / Mock Progress Case
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      duration = estimatedDuration;
      currentProgress = Math.min(Math.max(0, elapsed + offsetSecs) / duration, 1);
      
      // Ended when browser states TTS has stopped OR we've exceeded a safe timeout (estimated + 5s)
      const isSpeechDone = !podcastTtsSpeakingRef.current;
      if (isSpeechDone) {
        isEnded = true;
      } else if (elapsed >= duration + 5) {
        isEnded = true;
      }
    }

    setProgress(currentProgress);

    // Draw reacting waveforms on Canvas
    drawWaveform();

    if (!isEnded && isPlaying) {
      animationRef.current = requestAnimationFrame(tick);
    } else if (isEnded && isPlaying) {
      if (activeTurnIndex < turns.length - 1) {
        const nextIdx = activeTurnIndex + 1;
        setActiveTurnIndex(nextIdx);
        playTurn(nextIdx);
      } else {
        setIsPlaying(false);
        setProgress(1);
      }
    }
  };

  // Draw an organic animated waveform
  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear and draw background card
    ctx.fillStyle = "#111115";
    ctx.fillRect(0, 0, w, h);

    // Grid backdrop
    ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }

    // Organic soundwave lines (sin/cos overlapping waves)
    animationPhaseRef.current += isPlaying ? 0.08 : 0.005;
    const phase = animationPhaseRef.current;
    const amp = isPlaying ? 40 + Math.random() * 15 : 4; // Flat line if paused

    ctx.lineWidth = 3;
    
    // Wave 1: Indigo
    ctx.strokeStyle = "rgba(124, 106, 247, 0.8)";
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const y = h / 2 + Math.sin(x * 0.01 + phase) * amp * Math.sin(x * Math.PI / w);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Wave 2: Saffron Saffron
    ctx.strokeStyle = "rgba(247, 162, 106, 0.6)";
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const y = h / 2 + Math.cos(x * 0.015 - phase) * (amp * 0.8) * Math.sin(x * Math.PI / w);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Wave 3: Dim white
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const y = h / 2 + Math.sin(x * 0.02 + phase * 1.5) * (amp * 0.4) * Math.sin(x * Math.PI / w);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  // Run initial drawing on mount
  useEffect(() => {
    drawWaveform();
  }, [isPlaying]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      const audio = audioRefs.current[activeTurnIndex];
      if (audio) audio.pause();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } else {
      setIsPlaying(true);
      playTurn(activeTurnIndex);
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    (Object.values(audioRefs.current) as HTMLAudioElement[]).forEach((audio) => {
      audio.muted = newMuted;
    });

    if (typeof window !== "undefined" && window.speechSynthesis) {
      if (newMuted) {
        window.speechSynthesis.cancel();
      } else if (isPlaying) {
        speakTurnWithBrowserTTS(turns[activeTurnIndex]);
      }
    }
  };

  const handleSkip = () => {
    if (activeTurnIndex < turns.length - 1) {
      const nextIdx = activeTurnIndex + 1;
      setActiveTurnIndex(nextIdx);
      setProgress(0);
      if (isPlaying) {
        playTurn(nextIdx);
      }
    }
  };

  return (
    <div className="flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl w-full">
      {/* Dynamic Podcast Audio Stores */}
      {turns.map((turn, index) => (
        <audio
          key={index}
          ref={(el) => {
            if (el && turn.audioUrl) {
              audioRefs.current[index] = el;
            }
          }}
          src={turn.audioUrl ? `data:audio/wav;base64,${turn.audioUrl}` : undefined}
          preload="auto"
        />
      ))}

      {/* Visual Header / Cover Card */}
      <div className="flex flex-col sm:flex-row gap-6 items-center mb-6">
        <div className="w-32 h-32 bg-gradient-to-tr from-indigo-900 to-amber-700/80 rounded-xl flex flex-col items-center justify-center p-3 text-center border border-zinc-800 shadow-md">
          <Sparkles className="w-8 h-8 text-indigo-200 fill-indigo-300 mb-2" />
          <span className="text-[10px] uppercase tracking-widest font-mono text-indigo-300 font-bold">Vyakhya Talks</span>
          <span className="text-[11px] font-bold text-white mt-1 line-clamp-2 leading-tight">{title}</span>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <span className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-semibold font-mono text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
            Conversational Podcast Mode
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 mt-2">{title}</h2>
          <p className="text-sm text-zinc-400 mt-1">Dialogue between Joe (Host) & Jane (Expert)</p>
          <p className="text-xs text-zinc-500 mt-2 bg-zinc-900/40 inline-block px-3 py-1 rounded-md border border-zinc-800 font-mono">
            Topic: {topic}
          </p>
        </div>
      </div>

      {/* Oscillating Waveform Area */}
      <div className="relative w-full h-32 rounded-xl border border-zinc-900 bg-zinc-950 overflow-hidden">
        <canvas ref={canvasRef} width={600} height={128} className="w-full h-full object-fill" />
      </div>

      {/* Action Controls */}
      <div className="flex items-center justify-between mt-5 text-zinc-200">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={turns.length === 0}
            className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-full p-3 shadow-lg transition active:scale-95"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
          </button>

          <button
            onClick={handleSkip}
            disabled={turns.length === 0 || activeTurnIndex === turns.length - 1}
            className="flex items-center justify-center border border-zinc-800 hover:bg-zinc-900 disabled:opacity-30 text-zinc-300 rounded-full p-3 transition"
            title="Next Speaker Turn"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          <button
            onClick={toggleMute}
            disabled={turns.length === 0}
            className="flex items-center justify-center border border-zinc-800 hover:bg-zinc-900 disabled:opacity-30 text-zinc-300 rounded-full p-3 transition"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-500" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>

        <div className="text-xs font-mono text-zinc-400 select-none">
          Turn {activeTurnIndex + 1} of {turns.length} ({Math.floor(progress * 100)}%)
        </div>
      </div>

      {/* Dialogue Dialogue list matching playback */}
      <div className="mt-6 flex-1 max-h-64 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        {turns.map((turn, index) => {
          const isActive = index === activeTurnIndex;
          const isJoe = turn.speaker === "host";

          return (
            <div
              key={index}
              className={`p-3.5 rounded-xl border transition-all duration-300 ${
                isActive
                  ? isJoe
                    ? "bg-indigo-950/40 border-indigo-500/40 translate-x-1"
                    : "bg-amber-950/30 border-amber-500/40 translate-x-1"
                  : isJoe
                  ? "bg-zinc-900/20 border-zinc-900 opacity-60 hover:opacity-80"
                  : "bg-zinc-900/10 border-zinc-900 opacity-60 hover:opacity-80"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded-full ${
                    isJoe
                      ? "text-indigo-400 bg-indigo-900/20"
                      : "text-amber-400 bg-amber-900/20"
                  }`}
                >
                  {isJoe ? "Joe (Host)" : "Jane (Expert)"}
                </span>
                {isActive && (
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-indigo-400 animate-pulse font-mono">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    Speaking
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-200 leading-relaxed">{turn.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
