import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { 
  HelpCircle, 
  BookOpen, 
  Award, 
  MessageSquare, 
  ArrowRight, 
  RotateCw, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  BookOpenCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Send
} from "lucide-react";

interface InteractiveHubProps {
  initialTopic?: string;
  contextScript?: string;
  isStandalone?: boolean; // True when rendered on the homepage without a primary explainer
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Flashcard {
  front: string;
  back: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Global instances for real-time audio pipeline (F-03)
let micStream: MediaStream | null = null;
let scriptProcessor: ScriptProcessorNode | null = null;
let ws: WebSocket | null = null;
let audioContext: AudioContext | null = null;
let nextPlayTime = 0;

function convertFloat32ToInt16(buffer: Float32Array) {
  let l = buffer.length;
  const buf = new Int16Array(l);
  while (l--) {
    buf[l] = Math.min(1, Math.max(-1, buffer[l])) * 0x7FFF;
  }
  return buf.buffer;
}

function playPCMChunk(base64Data: string) {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      nextPlayTime = audioContext.currentTime;
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    const startTime = Math.max(nextPlayTime, audioContext.currentTime);
    source.start(startTime);
    nextPlayTime = startTime + audioBuffer.duration;
  } catch (err) {
    console.warn("Error playing audio chunk:", err);
  }
}

export default function InteractiveHub({ 
  initialTopic = "", 
  contextScript = "",
  isStandalone = false 
}: InteractiveHubProps) {
  const [activeTab, setActiveTab] = useState<"doubt" | "quiz" | "flashcard">("doubt");
  const [topic, setTopic] = useState(initialTopic);

  // Sync topic if initialTopic changes
  useEffect(() => {
    if (initialTopic) {
      setTopic(initialTopic);
    }
  }, [initialTopic]);

  // Voice Tutor State (F-03)
  const [isVoiceTutor, setIsVoiceTutor] = useState(false);
  const [tutorStatus, setTutorStatus] = useState<"idle" | "connecting" | "listening" | "speaking" | "error">("idle");
  const [tutorTranscript, setTutorTranscript] = useState("");
  const [tutorText, setTutorText] = useState("");

  const toggleVoiceTutor = async () => {
    if (isVoiceTutor) {
      cleanupTutor();
      setIsVoiceTutor(false);
      setTutorStatus("idle");
    } else {
      setIsVoiceTutor(true);
      setTutorStatus("connecting");
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/api/live-tutor?context=${encodeURIComponent(contextScript)}&language=${encodeURIComponent(localStorage.getItem("vyakhya_language") || "en-IN")}`;
        
        const socket = new WebSocket(wsUrl);
        ws = socket;

        socket.onopen = async () => {
          setTutorStatus("listening");
          await startRecording(socket);
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "audio") {
              setTutorStatus("speaking");
              playPCMChunk(msg.data);
            } else if (msg.type === "transcript") {
              setTutorText((prev) => prev + " " + msg.text);
              setTutorTranscript(msg.text);
            } else if (msg.type === "interrupted") {
              if (audioContext) {
                nextPlayTime = audioContext.currentTime;
              }
              setTutorStatus("listening");
            } else if (msg.type === "error") {
              setTutorStatus("error");
              console.error("Live voice error:", msg.message);
            }
          } catch (e) {
            console.error("Parse WS error:", e);
          }
        };

        socket.onclose = () => {
          cleanupTutor();
          setTutorStatus("idle");
        };

        socket.onerror = () => {
          setTutorStatus("error");
        };

      } catch (err: any) {
        console.error("Failed to start voice tutor:", err);
        setTutorStatus("error");
      }
    }
  };

  const startRecording = async (socket: WebSocket) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream = stream;

      const recordCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const source = recordCtx.createMediaStreamSource(stream);
      
      const processor = recordCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessor = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBuffer = convertFloat32ToInt16(inputData);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(pcmBuffer);
        }
      };

      source.connect(processor);
      processor.connect(recordCtx.destination);
    } catch (e) {
      console.error("Error accessing mic:", e);
      setTutorStatus("error");
    }
  };

  const cleanupTutor = () => {
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
      micStream = null;
    }
    if (scriptProcessor) {
      scriptProcessor.disconnect();
      scriptProcessor = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    setTutorText("");
    setTutorTranscript("");
  };

  useEffect(() => {
    return () => {
      cleanupTutor();
    };
  }, []);

  // Q&A State
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);

  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [isQuizFinished, setIsQuizFinished] = useState(false);

  // Flashcards State
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFlashcardsLoading, setIsFlashcardsLoading] = useState(false);

  // --- Doubt Solvers Handler ---
  const handleAskDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const userMsg = question.trim();
    setQuestion("");
    setChatHistory((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsAsking(true);

    try {
      const response = await fetch("/api/ask-doubt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic || "General Concept",
          question: userMsg,
          context: contextScript
        })
      });
      const data = await response.json();
      if (data.answer) {
        setChatHistory((prev) => [...prev, { role: "assistant", content: data.answer }]);
      } else {
        throw new Error(data.error || "No answer returned");
      }
    } catch (err: any) {
      console.error("Q&A error:", err);
      setChatHistory((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: "⚠️ **Vyakhya Q&A is currently busy.** Or your Gemini API key is rate-limited. Please retry in a few seconds!" 
        }
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  // --- Quiz Generator Handler ---
  const handleGenerateQuiz = async () => {
    const targetTopic = topic.trim() || "General Knowledge";
    setIsQuizLoading(true);
    setIsQuizFinished(false);
    setCurrentQuizIndex(0);
    setSelectedOption(null);
    setScore(0);

    try {
      const response = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: targetTopic,
          context: contextScript
        })
      });
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setQuizQuestions(data);
      } else {
        throw new Error("Invalid quiz response format");
      }
    } catch (err) {
      console.error("Quiz gen error:", err);
      // Fallback fallback static questions if failure
      setQuizQuestions([
        {
          question: `What is the core theme of ${targetTopic}?`,
          options: ["A simple introductory rule", "A complex multi-layered concept", "An abstract scientific phenomenon", "A computational process"],
          correctIndex: 1,
          explanation: `In the study of ${targetTopic}, we generally delve into complex, multi-layered structures to understand how different modules operate collectively.`
        }
      ]);
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleSelectOption = (idx: number) => {
    if (selectedOption !== null) return; // locked
    setSelectedOption(idx);
    if (idx === quizQuestions[currentQuizIndex].correctIndex) {
      setScore((s) => s + 1);
    }
  };

  const handleNextQuizQuestion = () => {
    setSelectedOption(null);
    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex((i) => i + 1);
    } else {
      setIsQuizFinished(true);
    }
  };

  // --- Flashcards Generator Handler ---
  const handleGenerateFlashcards = async () => {
    const targetTopic = topic.trim() || "General Knowledge";
    setIsFlashcardsLoading(true);
    setCurrentCardIndex(0);
    setIsFlipped(false);

    try {
      const response = await fetch("/api/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: targetTopic,
          context: contextScript
        })
      });
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setFlashcards(data);
      } else {
        throw new Error("Invalid flashcard response format");
      }
    } catch (err) {
      console.error("Flashcards gen error:", err);
      setFlashcards([
        {
          front: `Define: ${targetTopic}`,
          back: `The core structure of ${targetTopic} covers foundational mechanics, properties, and direct real-world applications in scientific fields.`
        }
      ]);
    } finally {
      setIsFlashcardsLoading(false);
    }
  };

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl w-full">
      {/* Standalone Header Topic Input */}
      {isStandalone && (
        <div className="p-6 border-b border-zinc-900 bg-zinc-900/10">
          <label htmlFor="standalone-topic-hub" className="text-xs font-semibold text-zinc-500 uppercase tracking-widest block mb-2">
            Enter Any Topic to Generate Study Hub
          </label>
          <div className="flex gap-3">
            <input
              id="standalone-topic-hub"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Deep Learning Neural Networks, Photosynthesis, Stock Options"
              className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-indigo-500 text-zinc-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none transition font-medium"
            />
            {(quizQuestions.length === 0 || flashcards.length === 0) && (
              <button
                onClick={() => {
                  handleGenerateQuiz();
                  handleGenerateFlashcards();
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 rounded-xl transition flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 fill-indigo-200" />
                <span>Build Deck</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation tabs */}
      <div className="grid grid-cols-3 border-b border-zinc-900 bg-zinc-900/30">
        <button
          onClick={() => setActiveTab("doubt")}
          className={`flex items-center justify-center gap-2 py-4 text-xs sm:text-sm font-semibold transition border-b-2 select-none ${
            activeTab === "doubt"
              ? "text-indigo-400 border-indigo-500 bg-zinc-900/20"
              : "text-zinc-500 border-transparent hover:text-zinc-300"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Ask doubts</span>
        </button>
        <button
          onClick={() => {
            setActiveTab("quiz");
            if (quizQuestions.length === 0) handleGenerateQuiz();
          }}
          className={`flex items-center justify-center gap-2 py-4 text-xs sm:text-sm font-semibold transition border-b-2 select-none ${
            activeTab === "quiz"
              ? "text-indigo-400 border-indigo-500 bg-zinc-900/20"
              : "text-zinc-500 border-transparent hover:text-zinc-300"
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Practice Quiz</span>
        </button>
        <button
          onClick={() => {
            setActiveTab("flashcard");
            if (flashcards.length === 0) handleGenerateFlashcards();
          }}
          className={`flex items-center justify-center gap-2 py-4 text-xs sm:text-sm font-semibold transition border-b-2 select-none ${
            activeTab === "flashcard"
              ? "text-indigo-400 border-indigo-500 bg-zinc-900/20"
              : "text-zinc-500 border-transparent hover:text-zinc-300"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Flashcards</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="p-6 min-h-[380px]">
        {/* TAB 1: ASK DOUBT */}
        {activeTab === "doubt" && (
          <div className="space-y-4 flex flex-col h-full justify-between">
            {/* Live Voice Tutor Toggle Header (F-03) */}
            <div className="flex justify-between items-center bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-900 mb-2 select-none">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isVoiceTutor ? "bg-red-500 animate-pulse" : "bg-zinc-600"}`} />
                <span className="text-xs font-bold text-zinc-300">Live Voice Tutor Mode (Beta)</span>
              </div>
              <button
                type="button"
                onClick={toggleVoiceTutor}
                className={`text-xs font-extrabold px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  isVoiceTutor 
                    ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/10" 
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/15"
                }`}
              >
                {isVoiceTutor ? "Disconnect Tutor" : "Speak to Vya"}
              </button>
            </div>

            {isVoiceTutor ? (
              /* Immersive AI Voice Avatar panel (F-03) */
              <div className="flex flex-col items-center justify-center py-8 space-y-6 flex-1 bg-zinc-900/25 border border-zinc-900/60 rounded-2xl p-6">
                <div className="relative flex items-center justify-center w-24 h-24">
                  <div className={`absolute inset-0 bg-indigo-500/10 rounded-full transition-all duration-500 ${
                    tutorStatus === "speaking" ? "animate-ping scale-125" : tutorStatus === "listening" ? "animate-pulse" : ""
                  }`} />
                  <div className={`absolute inset-2 bg-indigo-600/15 rounded-full transition-all duration-300 ${
                    tutorStatus === "speaking" ? "scale-110" : ""
                  }`} />
                  <div className="bg-zinc-950 border border-zinc-850 text-indigo-400 p-5 rounded-full shadow-xl z-10">
                    <Sparkles className={`w-7 h-7 ${tutorStatus === "speaking" ? "animate-spin-slow" : ""}`} />
                  </div>
                </div>

                <div className="text-center space-y-1.5">
                  <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-indigo-400">
                    {tutorStatus === "connecting" ? "Initializing..." : tutorStatus === "speaking" ? "Vya is speaking" : tutorStatus === "listening" ? "Vya is listening..." : "Tutor Status: " + tutorStatus}
                  </span>
                  <h4 className="text-sm font-bold text-zinc-200">
                    {tutorStatus === "connecting" ? "Waking up Vya..." : tutorStatus === "speaking" ? "Answering your doubt..." : "Ask your doubt aloud!"}
                  </h4>
                  <p className="text-[11px] text-zinc-500 max-w-xs leading-normal">
                    Vyakhya knows this lesson's exact transcript. Speak in English, Hindi, or other regional languages!
                  </p>
                </div>

                {/* Real-time voice transcription logging */}
                {(tutorText || tutorTranscript) && (
                  <div className="w-full bg-zinc-950/50 border border-zinc-900 p-4 rounded-xl max-h-[140px] overflow-y-auto text-center">
                    <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block mb-1">Live Transcript</span>
                    <p className="text-xs text-zinc-300 italic leading-relaxed">"{tutorText || tutorTranscript}"</p>
                  </div>
                )}
              </div>
            ) : (
              /* Standard Chat doubt solver interface */
              <>
                {/* Explainer Intro */}
                {chatHistory.length === 0 && (
                  <div className="text-center py-8 space-y-3">
                    <HelpCircle className="w-12 h-12 text-zinc-700 mx-auto" />
                    <h3 className="text-base font-bold text-zinc-300">Doubt Clarification Hub</h3>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                      Ask Vyakhya any follow-up questions to clear your confusion. We use the video's script details to deliver hyper-relevant answers.
                    </p>
                  </div>
                )}

                {/* Chat History */}
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {chatHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col max-w-[85%] rounded-2xl p-4 leading-relaxed text-sm ${
                        msg.role === "user"
                          ? "ml-auto bg-indigo-600/10 border border-indigo-500/20 text-zinc-100"
                          : "mr-auto bg-zinc-900/60 border border-zinc-800 text-zinc-300"
                      }`}
                    >
                      <span className="text-[10px] font-mono font-bold tracking-widest uppercase mb-1.5 opacity-60">
                        {msg.role === "user" ? "You" : "Vyakhya Mentor"}
                      </span>
                      <div className="markdown-body">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  {isAsking && (
                    <div className="mr-auto bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 text-zinc-400 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                      <span className="text-xs">Vyakhya is formulating an explanation...</span>
                    </div>
                  )}
                </div>

                {/* Input Form */}
                <form onSubmit={handleAskDoubt} className="flex gap-2.5 mt-4 pt-4 border-t border-zinc-900">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={topic ? `Ask anything about "${topic}"...` : "Ask any academic doubt..."}
                    className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-indigo-500 text-zinc-100 px-4 py-3 rounded-xl text-xs sm:text-sm focus:outline-none transition placeholder-zinc-600"
                    disabled={isAsking}
                  />
                  <button
                    type="submit"
                    disabled={isAsking || !question.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white p-3 rounded-xl transition"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* TAB 2: INTERACTIVE QUIZ */}
        {activeTab === "quiz" && (
          <div className="space-y-6">
            {isQuizLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-sm">
                <RefreshCw className="animate-spin w-8 h-8 text-indigo-500 mb-3" />
                <span className="font-mono text-xs">Assembling a custom interactive quiz...</span>
              </div>
            ) : isQuizFinished ? (
              <div className="text-center py-10 space-y-6">
                <div className="inline-block bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-full">
                  <Award className="w-12 h-12" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-zinc-100">Practice Quiz Completed!</h3>
                  <p className="text-xs text-zinc-500">Practice builds retention. Let's see your result:</p>
                </div>
                <div className="text-3xl font-black text-indigo-400 font-mono">
                  {score} / {quizQuestions.length}
                </div>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  {score === quizQuestions.length 
                    ? "Perfect score! You've mastered this topic." 
                    : "Good effort! Go through the explainer or ask follow-up questions to secure a perfect score next time."}
                </p>
                <button
                  onClick={handleGenerateQuiz}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs sm:text-sm transition shadow-md shadow-indigo-500/10"
                >
                  Retake Practice Quiz
                </button>
              </div>
            ) : quizQuestions.length > 0 ? (
              <div className="space-y-5">
                {/* Score & Counter */}
                <div className="flex items-center justify-between text-xs font-mono text-zinc-500 select-none">
                  <span>Question {currentQuizIndex + 1} of {quizQuestions.length}</span>
                  <span>Score: {score}</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full transition-all duration-300"
                    style={{ width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%` }}
                  />
                </div>

                {/* Question */}
                <h4 className="text-sm sm:text-base font-bold text-zinc-200">
                  {quizQuestions[currentQuizIndex].question}
                </h4>

                {/* Options list */}
                <div className="grid grid-cols-1 gap-3">
                  {quizQuestions[currentQuizIndex].options.map((opt, oIdx) => {
                    const isCorrect = oIdx === quizQuestions[currentQuizIndex].correctIndex;
                    const isUserSelected = oIdx === selectedOption;
                    
                    let btnStyle = "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 text-zinc-300";
                    let icon = null;

                    if (selectedOption !== null) {
                      if (isCorrect) {
                        btnStyle = "border-emerald-500/50 bg-emerald-950/20 text-emerald-400 font-semibold";
                        icon = <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 flex-shrink-0" />;
                      } else if (isUserSelected) {
                        btnStyle = "border-rose-500/50 bg-rose-950/20 text-rose-400";
                        icon = <XCircle className="w-4.5 h-4.5 text-rose-500 flex-shrink-0" />;
                      } else {
                        btnStyle = "border-zinc-900 bg-zinc-950 text-zinc-600 opacity-40";
                      }
                    }

                    return (
                      <button
                        key={oIdx}
                        onClick={() => handleSelectOption(oIdx)}
                        className={`flex items-center justify-between text-left p-4 rounded-xl border transition ${btnStyle}`}
                      >
                        <span className="text-xs sm:text-sm">{opt}</span>
                        {icon}
                      </button>
                    );
                  })}
                </div>

                {/* Lock explanation display */}
                {selectedOption !== null && (
                  <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4.5 space-y-3 animate-fade-in text-xs sm:text-sm">
                    <div className="flex items-center gap-1.5 font-bold text-indigo-400">
                      <BookOpenCheck className="w-4 h-4" />
                      <span>Explanation:</span>
                    </div>
                    <p className="text-zinc-400 leading-relaxed text-xs">
                      {quizQuestions[currentQuizIndex].explanation}
                    </p>
                    <button
                      onClick={handleNextQuizQuestion}
                      className="w-full flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-100 font-bold py-2.5 rounded-xl text-xs transition"
                    >
                      <span>{currentQuizIndex < quizQuestions.length - 1 ? "Next Question" : "See Results"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 space-y-4">
                <Award className="w-10 h-10 text-zinc-800 mx-auto" />
                <p className="text-xs text-zinc-500">Need quiz practice? Generate some questions below!</p>
                <button
                  onClick={handleGenerateQuiz}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl text-xs transition"
                >
                  Generate Interactive Quiz
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SMART FLASHCARDS */}
        {activeTab === "flashcard" && (
          <div className="space-y-6">
            {isFlashcardsLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-sm">
                <RefreshCw className="animate-spin w-8 h-8 text-indigo-500 mb-3" />
                <span className="font-mono text-xs">Drafting active recall flashcards...</span>
              </div>
            ) : flashcards.length > 0 ? (
              <div className="space-y-6 flex flex-col items-center">
                {/* Counter */}
                <div className="text-xs font-mono text-zinc-500 select-none">
                  Card {currentCardIndex + 1} of {flashcards.length}
                </div>

                {/* 3D Interactive Flip Card */}
                <div 
                  className="w-full max-w-md h-52 cursor-pointer perspective-1000 group"
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  <div 
                    className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${
                      isFlipped ? "rotate-y-180" : ""
                    }`}
                  >
                    {/* Front side */}
                    <div className="absolute inset-0 backface-hidden bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
                      <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 uppercase tracking-wider">
                        Question / Prompt
                      </span>
                      <h4 className="text-sm sm:text-base font-bold text-zinc-100 leading-relaxed px-2">
                        {flashcards[currentCardIndex].front}
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                        <RotateCw className="w-3.5 h-3.5 animate-spin-slow text-zinc-600" />
                        <span>Click to Flip & Reveal</span>
                      </p>
                    </div>

                    {/* Back side */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180 bg-zinc-900 border border-indigo-950/40 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 shadow-2xl overflow-y-auto">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">
                        Explanation
                      </span>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {flashcards[currentCardIndex].back}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        Click to flip back
                      </p>
                    </div>
                  </div>
                </div>

                {/* Flashcard Navigation controls */}
                <div className="flex items-center gap-6">
                  <button
                    disabled={currentCardIndex === 0}
                    onClick={() => {
                      setIsFlipped(false);
                      setTimeout(() => setCurrentCardIndex((i) => i - 1), 150);
                    }}
                    className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 disabled:opacity-20 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-5 py-2.5 rounded-xl text-xs font-mono font-bold text-zinc-300 transition"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Flip Card</span>
                  </button>

                  <button
                    disabled={currentCardIndex === flashcards.length - 1}
                    onClick={() => {
                      setIsFlipped(false);
                      setTimeout(() => setCurrentCardIndex((i) => i + 1), 150);
                    }}
                    className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 disabled:opacity-20 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Reset Deck */}
                <button
                  onClick={handleGenerateFlashcards}
                  className="flex items-center gap-1 text-zinc-600 hover:text-indigo-400 transition text-[10px] font-mono"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Generate New Flashcards</span>
                </button>
              </div>
            ) : (
              <div className="text-center py-10 space-y-4">
                <BookOpen className="w-10 h-10 text-zinc-800 mx-auto" />
                <p className="text-xs text-zinc-500">Need active recall cards? Generate a deck below!</p>
                <button
                  onClick={handleGenerateFlashcards}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl text-xs transition"
                >
                  Generate Flashcard Deck
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
