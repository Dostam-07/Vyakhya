import React, { useState } from "react";
import { Sparkles, ArrowRight, BookOpen } from "lucide-react";

interface NameModalProps {
  onSave: (name: string) => void;
}

export default function NameModal({ onSave }: NameModalProps) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-zinc-950/90 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-600/10 rounded-full blur-2xl" />

        <div className="text-center space-y-3 relative z-10">
          <div className="mx-auto bg-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-6 h-6 text-indigo-100 fill-indigo-200" />
          </div>
          <h2 className="text-2xl font-extrabold text-zinc-100 tracking-tight">
            Welcome to Vyakhya<span className="text-indigo-500">.ai</span>
          </h2>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
            Vyakhya parses dense topics, generates scripts, and compiles animations. Let's customize your learning experience!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="user-name-input" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              What should we call you?
            </label>
            <input
              id="user-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dostam"
              maxLength={30}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 text-zinc-100 px-4 py-3 rounded-xl text-sm focus:outline-none transition font-medium"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition shadow-lg shadow-indigo-600/15"
          >
            <span>Start Learning</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-[10px] text-zinc-600 font-mono relative z-10">
          No sign-ups or cards required. All workspace data is saved locally on your device.
        </div>
      </div>
    </div>
  );
}
