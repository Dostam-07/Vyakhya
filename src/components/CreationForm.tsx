import React, { useState } from "react";
import { LANGUAGES, STYLES, LENGTHS } from "../types";
import { Sparkles, FileText, Link as LinkIcon, HelpCircle, FileUp, Settings, Podcast, Video, Volume2, Zap, Image as ImageIcon } from "lucide-react";
import { useToast } from "../contexts/ToastContext";

interface CreationFormProps {
  onSubmit: (formData: {
    topic: string;
    language: string;
    style: string;
    length: string;
    format: "video" | "podcast";
    documentText: string;
    url: string;
    voiceEngine: "gemini" | "browser";
    voicePreference: "male" | "female";
    imageBase64?: string;
    mimeType?: string;
  }) => void;
  isLoading: boolean;
  initialTopic?: string;
  initialLength?: string;
}

export default function CreationForm({ onSubmit, isLoading, initialTopic = "", initialLength = "short" }: CreationFormProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [activeTab, setActiveTab] = useState<"topic" | "document" | "url" | "image">("topic");
  const [topic, setTopic] = useState(initialTopic);
  const [documentText, setDocumentText] = useState("");
  const [url, setUrl] = useState("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [mimeType, setMimeType] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string>("");
  
  const [language, setLanguage] = useState<string>(() => {
    return localStorage.getItem("vyakhya_language") || "en-IN";
  });
  const [style, setStyle] = useState("simple");
  const [length, setLength] = useState(initialLength);
  const [format, setFormat] = useState<"video" | "podcast">("video");
  const [voiceEngine, setVoiceEngine] = useState<"gemini" | "browser">(() => {
    return (localStorage.getItem("vyakhya_voice_engine") as "gemini" | "browser") || "gemini";
  });
  const [voicePreference, setVoicePreference] = useState<"male" | "female">(() => {
    return (localStorage.getItem("vyakhya_voice_preference") as "male" | "female") || "female";
  });

  React.useEffect(() => {
    localStorage.setItem("vyakhya_language", language);
  }, [language]);

  React.useEffect(() => {
    localStorage.setItem("vyakhya_voice_engine", voiceEngine);
  }, [voiceEngine]);

  React.useEffect(() => {
    localStorage.setItem("vyakhya_voice_preference", voicePreference);
  }, [voicePreference]);

  React.useEffect(() => {
    if (initialTopic) setTopic(initialTopic);
    if (initialLength) setLength(initialLength);
  }, [initialTopic, initialLength]);

  const handlePreviewVoice = () => {
    try {
      const isHindi = language.startsWith("hi");
      const utteranceText = isHindi
        ? "नमस्ते! यह व्याख्या की चुनी हुई आवाज़ का पूर्वावलोकन है।" 
        : "Hello! This is a preview of the selected voice on Vyakhya.";
      
      const synth = window.speechSynthesis;
      if (!synth) {
        showToast("Speech synthesis is not supported on this browser.", "error");
        return;
      }
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(utteranceText);
      utterance.lang = language;
      const voices = synth.getVoices();
      const isMale = voicePreference === "male";
      const matchingVoice = voices.find(v => {
        const l = v.lang.toLowerCase();
        const targetL = language.toLowerCase();
        return l.includes(targetL) || l.includes(targetL.split("-")[0]);
      });
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }
      utterance.pitch = isMale ? 0.85 : 1.25;
      utterance.rate = 1.0;
      synth.speak(utterance);
    } catch (err) {
      console.error("Preview voice failed:", err);
    }
  };

  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await handleFileLoad(file);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await handleFileLoad(file);
    }
  };

  const handleFileLoad = async (file: File) => {
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/parse-document", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Failed to parse document");
      
      const data = await response.json();
      setDocumentText(data.text);
      // Pre-fill topic with file name to give context
      if (!topic) {
        setTopic(`Detailed summary of ${file.name}`);
      }
    } catch (err) {
      console.error("Error reading file:", err);
    }
  };

  const handleImageInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await handleImageLoad(file);
    }
  };

  const handleImageLoad = async (file: File) => {
    setFileName(file.name);
    setMimeType(file.type);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = (event.target?.result as string).split(",")[1];
        setImageBase64(base64String);
        setImagePreview(event.target?.result as string);
        if (!topic) {
          setTopic(`Explainer of ${file.name}`);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error reading image file:", err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (activeTab === "topic" && !topic.trim()) return;
    if (activeTab === "document" && !documentText.trim()) return;
    if (activeTab === "url" && !url.trim()) return;
    if (activeTab === "image" && !imageBase64) {
      showToast("Please upload a textbook diagram or image page!", "error");
      return;
    }

    if (step === 1) {
      setStep(2);
      return;
    }

    onSubmit({
      topic: activeTab === "topic" ? topic : topic || `Explainer of ${fileName || "Uploaded content"}`,
      language,
      style,
      length,
      format,
      documentText: activeTab === "document" ? documentText : "",
      url: activeTab === "url" ? url : "",
      voiceEngine,
      voicePreference,
      imageBase64: activeTab === "image" ? imageBase64 : undefined,
      mimeType: activeTab === "image" ? mimeType : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 sm:p-8 shadow-xl dark:shadow-2xl w-full transition-colors duration-300">
      {/* Title */}
      <div className="flex items-center gap-3 mb-6 select-none">
        <div className="bg-indigo-600/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 p-2 rounded-xl">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">Creation Studio</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Transform complex ideas into narrated formats instantly</p>
        </div>
      </div>

      {/* STEP INDICATOR */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`h-1.5 flex-1 rounded-full ${step === 1 ? 'bg-vyakhya-saffron' : 'bg-zinc-200 dark:bg-zinc-800'}`}></div>
        <div className={`h-1.5 flex-1 rounded-full ${step === 2 ? 'bg-vyakhya-saffron' : 'bg-zinc-200 dark:bg-zinc-800'}`}></div>
      </div>

      {step === 1 && (
        <>
          {/* Input Mode Navigation Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-xl mb-6 border border-zinc-200 dark:border-zinc-900 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("topic")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === "topic"
                  ? "bg-white dark:bg-zinc-800 text-vyakhya-saffron dark:text-vyakhya-saffron border border-zinc-200 dark:border-zinc-700/50 shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Topic Input</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("document")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === "document"
                  ? "bg-white dark:bg-zinc-800 text-vyakhya-saffron dark:text-vyakhya-saffron border border-zinc-200 dark:border-zinc-700/50 shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Doc Upload</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("url")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === "url"
                  ? "bg-white dark:bg-zinc-800 text-vyakhya-saffron dark:text-vyakhya-saffron border border-zinc-200 dark:border-zinc-700/50 shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>URL Link</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("image")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === "image"
                  ? "bg-white dark:bg-zinc-800 text-vyakhya-saffron dark:text-vyakhya-saffron border border-zinc-200 dark:border-zinc-700/50 shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Textbook Page</span>
            </button>
          </div>

          {/* Mode-Specific Inputs */}
          <div className="space-y-4 mb-6">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mb-2">
              {["Inflation vs Deflation", "How does a CPU work", "The history of the Silk Road", "What are black holes"].map(trend => (
                <button
                  key={trend}
                  type="button"
                  onClick={() => { setActiveTab("topic"); setTopic(trend); }}
                  className="whitespace-nowrap px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-vyakhya-saffron hover:text-white transition cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 inline-block mr-1 opacity-50" />
                  {trend}
                </button>
              ))}
            </div>
        {activeTab === "topic" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="topic" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              What do you want explained?
            </label>
            <textarea
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. How does compound interest multiply wealth, or How does photosynthesis convert light into glucose?"
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none min-h-[100px] resize-y transition"
              required
            />
          </div>
        )}

        {activeTab === "document" && (
          <div className="space-y-4">
            {/* Drag & Drop */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center ${
                dragActive
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20"
                  : fileName
                  ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/5"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40"
              }`}
            >
              <input
                type="file"
                id="file-upload"
                onChange={handleFileInput}
                accept=".txt,.md,.json,.csv,.docx,.pdf,.pptx"
                className="hidden"
              />
              <FileUp className={`w-8 h-8 mb-2 ${fileName ? "text-emerald-500" : "text-zinc-400 dark:text-zinc-500 animate-pulse"}`} />
              <label htmlFor="file-upload" className="cursor-pointer text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
                {fileName ? `File: ${fileName}` : "Drag & drop a text file, or browse files"}
              </label>
              <p className="text-[10px] text-zinc-500 mt-1">Supports plain text .txt, .md, .json, .csv files up to 20MB</p>
            </div>

            {/* Manual paste backup */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="documentText" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Or paste document text content manually
              </label>
              <textarea
                id="documentText"
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                placeholder="Paste curriculum notes, chapter PDFs contents, study sheets, or meeting transcripts directly here..."
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none min-h-[100px] resize-y transition"
              />
            </div>
          </div>
        )}

        {activeTab === "url" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="url" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Paste Article or Webpage Link
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="e.g. https://en.wikipedia.org/wiki/Quantum_entanglement"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none transition"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="url-topic" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Focus Guidance (Optional)
              </label>
              <input
                type="text"
                id="url-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What specific angles should we highlight from this webpage?"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none transition"
              />
            </div>
          </div>
        )}

        {activeTab === "image" && (
          <div className="space-y-4">
            <div className="relative border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40">
              <input
                type="file"
                id="image-upload"
                onChange={handleImageInput}
                accept="image/*"
                className="hidden"
              />
              {imagePreview ? (
                <div className="mb-3 flex flex-col items-center gap-2">
                  <img src={imagePreview} alt="Textbook preview" className="max-h-32 rounded-lg border border-zinc-250 dark:border-zinc-800" />
                  <span className="text-xs text-emerald-500 font-semibold">{fileName}</span>
                </div>
              ) : (
                <ImageIcon className="w-8 h-8 mb-2 text-zinc-400 dark:text-zinc-500 animate-pulse" />
              )}
              <label htmlFor="image-upload" className="cursor-pointer text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-550 dark:hover:text-indigo-300">
                {imagePreview ? "Change image" : "Upload textbook page or diagram"}
              </label>
              <p className="text-[10px] text-zinc-500 mt-1">Supports JPG, PNG, WebP pages, science diagrams, math equations, or sketches</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="image-focus" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Focus Guidance or Custom Topic (Optional)
              </label>
              <input
                type="text"
                id="image-focus"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Focus on explaining the Krebs cycle diagram from class 10 biology"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none transition"
              />
            </div>
          </div>
        )}
      </div>
      </>
    )}

    {step === 2 && (
      <>
          {/* Format Selection (Explainer Video vs. Podcast) */}
          <div className="flex flex-col gap-2 mb-6">
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Settings className="w-3.5 h-3.5" />
              <span>Output Format Selection</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFormat("video")}
            className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition select-none cursor-pointer ${
              format === "video"
                ? "bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-600 dark:border-indigo-500/80 text-zinc-900 dark:text-white"
                : "bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            <div className={`p-2 rounded-lg ${format === "video" ? "bg-indigo-100 dark:bg-indigo-600 text-indigo-700 dark:text-indigo-100" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"}`}>
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Explainer Video</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">Rich narrated graphics with 8 layout designs</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFormat("podcast")}
            className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition select-none cursor-pointer ${
              format === "podcast"
                ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-600 dark:border-amber-500/80 text-zinc-900 dark:text-white"
                : "bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            <div className={`p-2 rounded-lg ${format === "podcast" ? "bg-amber-100 dark:bg-amber-600 text-amber-700 dark:text-amber-100" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"}`}>
              <Podcast className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Podcast Dialogue</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">Dual-voice host vs. expert conversation</div>
            </div>
          </button>
        </div>
      </div>

      {/* Voice Synthesis Engine Selector */}
      <div className="flex flex-col gap-2 mb-6">
        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5" />
          <span>Voice Synthesis Engine (Rate-Limit Protection)</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setVoiceEngine("browser")}
            className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition select-none cursor-pointer ${
              voiceEngine === "browser"
                ? "bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-600 dark:border-indigo-500/80 text-zinc-900 dark:text-white"
                : "bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            <div className={`p-2 rounded-lg ${voiceEngine === "browser" ? "bg-indigo-100 dark:bg-indigo-600 text-indigo-700 dark:text-indigo-100" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"}`}>
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                <span>Browser Speech Engine</span>
                <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full uppercase font-mono font-bold font-sans">Free & Unlimited</span>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">Instant voice, 100% rate-limit proof. Bypasses Gemini limits!</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setVoiceEngine("gemini")}
            className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition select-none cursor-pointer ${
              voiceEngine === "gemini"
                ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-600 dark:border-amber-500/80 text-zinc-900 dark:text-white"
                : "bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            <div className={`p-2 rounded-lg ${voiceEngine === "gemini" ? "bg-amber-100 dark:bg-amber-600 text-amber-700 dark:text-amber-100" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"}`}>
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                <span>Gemini AI Voice</span>
                <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full uppercase font-mono font-bold font-sans">Subject to Quotas</span>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">Premium hyper-realistic studio voice. Subject to 429 quota.</div>
            </div>
          </button>
        </div>

        {voiceEngine === "browser" && (
          <div className="text-amber-600 dark:text-amber-400 text-xs mt-2 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg font-medium leading-normal flex items-start gap-1.5">
            <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Lower quality, depends on your device's installed voices. Real gender selection may not sound distinct on some operating systems.</span>
          </div>
        )}
      </div>
      
      {/* Voice Preference */}
      <div className="flex flex-col gap-2 mb-6">
        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <span>Voice Preference</span>
        </label>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/40 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="radio" name="voice" value="female" className="text-indigo-600 focus:ring-indigo-500 cursor-pointer" checked={voicePreference === 'female'} onChange={() => setVoicePreference('female')} />
              <span className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">Female</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="radio" name="voice" value="male" className="text-indigo-600 focus:ring-indigo-500 cursor-pointer" checked={voicePreference === 'male'} onChange={() => setVoicePreference('male')} />
              <span className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">Male</span>
            </label>
          </div>
          <button
            type="button"
            onClick={handlePreviewVoice}
            className="flex items-center justify-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-800 transition active:scale-95 cursor-pointer self-start sm:self-auto"
          >
            <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>🔊 Preview Voice</span>
          </button>
        </div>
      </div>

      {/* Grid Settings Layout: Style, Length, Language */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Language Selection */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="language" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
            Language & Accent
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none transition cursor-pointer font-medium"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Explainer Style */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="style" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
            Narration Tone / Style
          </label>
          <select
            id="style"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none transition cursor-pointer"
          >
            {STYLES.map((st) => (
              <option key={st.id} value={st.id} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
                {st.name}
              </option>
            ))}
          </select>
        </div>

        {/* Length / Duration */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="length" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
            Length Duration
          </label>
          <select
            id="length"
            value={length}
            onChange={(e) => setLength(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none transition cursor-pointer"
          >
            {LENGTHS.map((len) => (
              <option key={len.id} value={len.id} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
                {len.name}
              </option>
            ))}
          </select>
        </div>
          </div>
        </>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center gap-3">
        {step === 2 && (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold py-3.5 px-6 rounded-xl transition cursor-pointer"
          >
            Back
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2.5 bg-vyakhya-indigo hover:bg-indigo-600 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed select-none transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer text-sm sm:text-base"
        >
          {step === 1 ? (
            <span>Next Step</span>
          ) : (
            <>
              <Sparkles className="w-5 h-5 fill-white animate-pulse" />
              <span>{isLoading ? "Generating Script & Media..." : `Generate Vyakhya ${format === "video" ? "Video" : "Podcast"}`}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
