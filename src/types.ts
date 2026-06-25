export type SceneType =
  | "title_card"
  | "concept_split"
  | "bullet_reveal"
  | "analogy_card"
  | "data_stat"
  | "timeline"
  | "quote_card"
  | "summary_card";

export interface Scene {
  id: string;
  type: SceneType;
  headline: string;
  narration: string;
  visual_instruction: string;
  image_description?: string;
  duration_seconds: number;
  bg_color: string;
  accent_color: string;
  // Optional scene-specific fields
  left_label?: string;
  right_label?: string;
  bullets?: string[];
  analogy_text?: string;
  stat_value?: string;
  stat_label?: string;
  steps?: string[];
  quote_text?: string;
  quote_attribution?: string;
  // Runtime values
  audioUrl?: string; // Generated base64 audio URL
  imageUrl?: string; // Generated base64 / URL thumbnail background image (F-06)
  videoUrl?: string; // Stored Veo video URL / stream path (F-01)
  transition_type?: string; // Animated transitions (fade, slide-left, slide-right, zoom-in)
}

export interface Explainer {
  id: string;
  title: string;
  topic: string;
  creatorId: string;
  creatorEmail: string;
  creatorName: string;
  format: "video" | "podcast";
  language: string;
  style: string;
  length: string;
  status: "processing" | "complete" | "error";
  videoUrl?: string; // Stored video (WebM/MP4) blob or URL
  thumbnailUrl?: string;
  audioUrl?: string; // Stored audio URL (for podcast)
  soundtrackUrl?: string; // Generated base64 soundtrack from Lyria (F-02)
  duration: number;
  scenes?: Scene[]; // Explainer script scenes
  turns?: PodcastTurn[]; // Podcast dialogues
  isPublic: boolean;
  tags: string[];
  views: number;
  saves: number;
  createdAt: number;
}

export interface PodcastTurn {
  speaker: "host" | "guest";
  text: string;
  audioUrl?: string; // Generated base64 audio URL
}

export interface GenerationJob {
  id: string;
  explainerId: string;
  userId: string;
  status: "queued" | "scripting" | "narrating" | "complete" | "error";
  progress: number; // 0-100
  format: "video" | "podcast";
  errorMessage?: string;
}

export const LANGUAGES = [
  { code: "en-IN", name: "English (India)", voiceHost: "Kore", voiceGuest: "Puck" },
  { code: "hi-IN", name: "Hindi (हिन्दी)", voiceHost: "Fenrir", voiceGuest: "Charon" },
  { code: "ta-IN", name: "Tamil (தமிழ்)", voiceHost: "Kore", voiceGuest: "Zephyr" },
  { code: "te-IN", name: "Telugu (తెలుగు)", voiceHost: "Zephyr", voiceGuest: "Puck" },
  { code: "bn-IN", name: "Bengali (বাংলা)", voiceHost: "Charon", voiceGuest: "Fenrir" },
  { code: "mr-IN", name: "Marathi (मराठी)", voiceHost: "Kore", voiceGuest: "Charon" },
  { code: "ml-IN", name: "Malayalam (മലയാളം)", voiceHost: "Zephyr", voiceGuest: "Kore" },
  { code: "gu-IN", name: "Gujarati (ગુજરાતી)", voiceHost: "Charon", voiceGuest: "Puck" },
];

export const STYLES = [
  { id: "simple", name: "Simple & Friendly", description: "Plain english, intuitive comparisons" },
  { id: "academic", name: "Deep Academic", description: "Rich, precise scientific explanation" },
  { id: "storytelling", name: "Metaphorical Story", description: "Relatable narratives & analogies" },
  { id: "news", name: "Breaking News Report", description: "Objective, fact-driven bulletin format" },
];

export const LENGTHS = [
  { id: "short", name: "Short (~60s)", desc: "Quick overview, 5-8 scenes" },
  { id: "medium", name: "Medium (~3m)", desc: "Core concepts, 9-14 scenes" },
  { id: "deep", name: "Deep Dive (~5m+)", desc: "Full breakdown, 15+ scenes" },
];
