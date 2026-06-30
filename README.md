# 🎙️ Vyakhya (व्याख्या)

> **"Transforming complex concepts into localized, engaging visual storyboard animations & dual-speaker podcasts in 8+ Indian regional languages — powered by Google Gemini, Veo, and Lyria."**

---

## 🌟 Introduction

**Vyakhya** (meaning *Explanation* or *Exposition* in Sanskrit) is an advanced AI-powered multilingual educational platform crafted specifically for class 6-12 Indian students and educators. Our mission is to democratize high-quality, conceptual EdTech by converting plain text topics, school documents, textbook PDFs, slides, and websites into interactive visual presentations or dual-speaker podcasts in regional Indian tongues (Hindi, Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati, and English).

With built-in quizzes, micro-flashcards, contextual doubt-solving, and a live **Gemini Live WebSocket Voice Tutor**, Vyakhya turns passive learning into an interactive, immersive, and accessible playground.

---

## 🚀 Key Capabilities

### 🎥 1. Multilingual Visual Storyboard Explainers
*   **Prompt-to-Video Storyboards:** Type any complex topic (e.g., *"How Photosynthesis works in plants"*), or upload documents (PDF, DOCX, PPTX), images, or web URLs.
*   **8 Regional Indian Languages:** Fully supports high-quality text, script generation, and speech generation in Hindi, Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati, and English.
*   **Dual-Speaker Podcasts:** Converts dull textbook chapters into an engaging talk-show or interactive dialogue between two friendly AI hosts.

### 🎭 2. Interactive Canvas-Based Studio Player
*   **Interactive Real-Time Rendering:** Watch dynamically synchronized audio narration, custom illustrations, highlights, and bullet points on a high-performance HTML5 Canvas.
*   **Animated Slide Transitions:** Premium visual cuts including **Fade Cross, Slide Left, Slide Right, and Zoom In** for visual continuity.
*   **Smart Karaoke Subtitles:** On-canvas, highly synchronized subtitle banners with word-by-word karaoke-style highlighting to boost multi-sensory comprehension.
*   **PowerPoint Export:** Export your storyboard narrations and scenes directly into formatted `.pptx` presentations using customizable master themes.
*   **Offline Video Export & SRT Downloader:** Record and export storyboard render tracks directly as `.webm` / `.mp4` video files with companion `.srt` closed-caption track sheets.

### 🧠 3. Built-In Personalized Study Hub
*   **AI Quizzes & Study Games:** Instant, scene-synchronized multiple-choice quizzes designed to test conceptual understanding with step-by-step logic explanations.
*   **Auto-Generated Flashcards:** Memorize tough terms, complex scientific definitions, or historical dates using beautiful, interactive digital flashcards.
*   **AI Doubt Desk:** Got stuck? Enter your doubts during playback to get context-aware, easy-to-understand explanations referencing the exact scene timeline.
*   **Live Voice Tutor (Gemini Live):** Open a real-time, ultra-low-latency voice conversation with a smart mentor to talk through your homework, mock viva, or exams.

---

## 🛠️ The Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons, Framer Motion |
| **Backend** | Node.js + Express, ESM/CJS Bundling with Esbuild, File parsing (Mammoth, Officeparser, PDF-Parse) |
| **Core AI Orchestration** | `@google/genai` (TypeScript/Node.js SDK) |
| **LLMs / Models** | Google Gemini 3.1 Flash-Lite, Gemini 2.5 Flash, Gemini 3.1 Pro |
| **Voice & Live AI** | Gemini Low-latency Audio Modalities, Gemini Live WebSockets |
| **Video & Images** | Pollinations AI (Flux/SDXL for background templates), Veo 3.1 Live Integration hooks |
| **Database & Auth** | Firebase Auth & Google Firebase Cloud Firestore |

---

## 📂 Project Architecture

```
├── /server.ts                      # Full-stack custom Express + Vite hybrid Node server
├── /firebase-blueprint.json        # Database blueprints
├── /firestore.rules                # Hardened, authenticated Firestore database rules
├── /tsconfig.json                  # Strict TypeScript configuration
├── /src
│   ├── /components
│   │   ├── CanvasRenderer.tsx      # Core HTML5 Canvas animator, karaoke subtitle generator, customizer
│   │   ├── WatchPage.tsx           # Primary viewer page housing study suite controls
│   │   ├── CreationForm.tsx        # Video / Podcast prompt setup & PPTX/PDF document parsing forms
│   │   ├── LibraryPage.tsx         # User's created explainer collection
│   │   ├── ErrorBoundary.tsx       # Safety boundary to prevent white-screens on UI runtime faults
│   │   └── ...
│   ├── App.tsx                     # Main React route setup & controller
│   ├── main.tsx                    # React client entrypoint
│   ├── types.ts                    # Global TypeScript interfaces for Explainer, Scene, Quiz, and Users
│   └── index.css                   # Global CSS imports including tailwind base structures
```

---

## ⚡ Setup & Local Development

### 1. Prerequisites
Ensure you have Node.js (v18+) and npm installed locally.

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory (using `.env.example` as a template):
```env
GEMINI_API_KEY="your_google_gemini_api_key"
APP_URL="http://localhost:3000"
```

### 4. Running Dev Environment
Start the development server (runs full-stack Node backend which proxies Vite client bundle):
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application in your browser.

---

## 🔒 Hardened Production Security Rules
The database architecture has been configured with high-grade, ownership-scoped security protocols to safeguard user profiles and creative works. Below is a snippet of our robust Firestore access setup:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /explainers/{explainerId} {
      allow read: if true;
      allow create: if request.auth != null && request.resource.data.creatorId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.creatorId == request.auth.uid;
    }
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 💎 Features Checklist & Roadmap Implementation
We've successfully executed our **Phase 1 Strategy**, optimizing existing stability and introducing highly requested features:
*   [x] **PowerPoint Export:** Direct generation of `.pptx` slide decks from storyboard scenes.
*   [x] **Styling & Theming:** Implemented "Space Grotesk" typography and high-contrast, professional "Ink" color palette for a refined, modern UI.
*   [x] **Robust File Parser Compatibility:** Seamlessly parse `.docx`, `.pdf`, and `.pptx` (PowerPoint) slide deck context directly on the Node.js backend.
*   [x] **Smart Canvas Captions:** Styled bottom overlays with real-time text parsing that keeps captions beautifully highlighted alongside runtime audio.
*   [x] **Dynamic Storyboard Customizer:** Real-time controls allowing creators to adjust scene headlines, scripts, background hex codes, accent colors, and custom transitions on-the-fly.
*   [x] **Polished Transition Effects:** Built smooth transition routines directly into the canvas loop logic (Fade, Left/Right slide animations, Zoom-ins).
*   [x] **Universal Media Recorder Fallback:** Bulletproof client-side export fallback mechanism resolving older Apple Safari and mobile device encoding crashes.
*   [x] **Zero White-Screens:** Wrapped the main execution tree inside a React error boundary catching state mutations cleanly.

---

## 🤝 Contributing
Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**. 

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---


*Made with 💖 for classrooms across India by Dostam*
