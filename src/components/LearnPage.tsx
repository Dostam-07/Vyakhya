import React from "react";
import { GraduationCap, Sparkles } from "lucide-react";

export default function LearnPage() {
  return (
    <div className="w-full flex flex-col items-center justify-center py-20 text-center select-none">
      <div className="bg-vyakhya-indigo/10 text-vyakhya-indigo p-4 rounded-full mb-6">
        <GraduationCap className="w-12 h-12" />
      </div>
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 font-display">
        Vyakhya Academy
      </h1>
      <p className="text-zinc-500 max-w-md mx-auto leading-relaxed">
        Coming soon! Learn how to craft better prompts, understand AI visual generation, and master storytelling pacing.
      </p>
      <button className="mt-8 px-6 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full font-semibold cursor-not-allowed opacity-70 flex items-center gap-2">
        <Sparkles className="w-4 h-4" /> Waitlist Joined
      </button>
    </div>
  );
}
