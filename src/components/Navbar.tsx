import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PlayCircle, Globe, BookOpen, User as UserIcon, Edit2, Sparkles, Moon, Sun } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export default function Navbar() {
  const [localName, setLocalName] = useState<string | null>(null);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setLocalName(localStorage.getItem("vyakhya_username"));
    const handleStorage = () => {
      setLocalName(localStorage.getItem("vyakhya_username"));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const activeClass = (path: string) => {
    return location.pathname === path
      ? "text-indigo-400 bg-zinc-900 border-b-2 border-indigo-500 font-semibold"
      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50";
  };

  return (
    <nav className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Name together link to home-screen */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 text-white hover:opacity-90 transition select-none">
              <div className="bg-indigo-600 rounded-lg p-1.5 shadow-indigo-500/20 shadow-md">
                <Sparkles className="w-6 h-6 text-indigo-100 fill-indigo-200" />
              </div>
              <span className="text-xl font-bold tracking-tight">
                Vyakhya<span className="text-indigo-500 font-normal font-mono">.ai</span>
              </span>
              {localName && (
                <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 ml-2 hidden sm:inline-block">
                  {localName}
                </span>
              )}
            </Link>

            {/* Navigation Tabs */}
            <div className="hidden md:flex items-center gap-2">
              <Link
                to="/"
                className={`px-3.5 py-2 rounded-lg text-sm transition-all duration-200 ${activeClass("/")}`}
              >
                Create
              </Link>
              <Link
                to="/discover"
                className={`px-3.5 py-2 rounded-lg text-sm transition-all duration-200 ${activeClass("/discover")}`}
              >
                Discover Feed
              </Link>
              <Link
                to="/library"
                className={`px-3.5 py-2 rounded-lg text-sm transition-all duration-200 ${activeClass("/library")}`}
              >
                My Library
              </Link>
              <Link
                to="/analytics"
                className={`px-3.5 py-2 rounded-lg text-sm transition-all duration-200 ${activeClass("/analytics")}`}
              >
                Analytics
              </Link>
            </div>
          </div>

          {/* Right actions: user profile edit */}
          <div className="flex items-center gap-4">
            <button
               onClick={toggleTheme}
               className="p-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-zinc-100 transition"
               title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
             >
               {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
             </button>
            {localName ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-xs text-zinc-400 font-medium select-none">
                  Hi, <span className="text-zinc-200 font-bold">{localName}</span>
                </span>
                <button
                  onClick={() => {
                    const next = prompt("Enter your new nickname:", localName);
                    if (next && next.trim()) {
                      localStorage.setItem("vyakhya_username", next.trim());
                      setLocalName(next.trim());
                      // trigger custom storage event for other components
                      window.dispatchEvent(new Event("storage"));
                    }
                  }}
                  className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium text-xs px-3 py-1.5 rounded-lg transition-all"
                  title="Change nickname"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Change Name</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
