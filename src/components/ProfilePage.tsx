import React, { useState, useEffect } from "react";
import { User, Settings, Shield, Award } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";

export default function ProfilePage() {
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [localName, setLocalName] = useState("");

  useEffect(() => {
    setLocalName(localStorage.getItem("vyakhya_username") || "Guest");
  }, []);

  const handleSaveName = () => {
    if (localName.trim()) {
      localStorage.setItem("vyakhya_username", localName.trim());
      window.dispatchEvent(new Event("storage"));
      showToast("Profile updated successfully", "success");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-8 font-display">Account Settings</h1>
      
      <div className="space-y-8">
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="text-vyakhya-indigo" />
            <h2 className="text-lg font-semibold">Public Profile</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Display Name</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-vyakhya-saffron outline-none"
                />
                <button
                  onClick={handleSaveName}
                  className="bg-vyakhya-indigo hover:bg-indigo-600 text-white font-semibold px-6 py-2 rounded-xl text-sm transition"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="text-vyakhya-saffron" />
            <h2 className="text-lg font-semibold">Preferences</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-zinc-100 dark:border-zinc-800 rounded-xl">
              <div>
                <p className="font-semibold text-sm">Theme Mode</p>
                <p className="text-xs text-zinc-500 mt-1">Switch between light and dark aesthetics</p>
              </div>
              <button
                onClick={toggleTheme}
                className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-lg text-xs font-semibold"
              >
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
            </div>
            <div className="flex items-center justify-between p-4 border border-zinc-100 dark:border-zinc-800 rounded-xl">
              <div>
                <p className="font-semibold text-sm">Offline Caching</p>
                <p className="text-xs text-zinc-500 mt-1">Store generations locally</p>
              </div>
              <div className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-md text-xs font-bold">
                Active
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-between items-center text-xs text-zinc-400 px-2 pt-8">
          <p>Vyakhya Engine v5.0.0</p>
          <div className="flex gap-4">
            <button className="hover:text-zinc-600 dark:hover:text-zinc-300">Privacy Policy</button>
            <button className="hover:text-zinc-600 dark:hover:text-zinc-300">Terms of Service</button>
          </div>
        </div>
      </div>
    </div>
  );
}
