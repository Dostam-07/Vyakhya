import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Sparkles, 
  Home, 
  Compass, 
  Library, 
  GraduationCap, 
  User as UserIcon, 
  Search, 
  Sun, 
  Moon, 
  Settings,
  Menu,
  X
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [localName, setLocalName] = useState<string | null>(null);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setLocalName(localStorage.getItem("vyakhya_username"));
    const handleStorage = () => {
      setLocalName(localStorage.getItem("vyakhya_username"));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const navItems = [
    { name: "Create", path: "/", icon: Home },
    { name: "Discover", path: "/discover", icon: Compass },
    { name: "Library", path: "/library", icon: Library },
    { name: "Learn", path: "/learn", icon: GraduationCap },
    { name: "Profile", path: "/profile", icon: UserIcon },
  ];

  const activeClass = (path: string) => {
    return location.pathname === path
      ? "bg-vyakhya-indigo/10 text-vyakhya-indigo dark:bg-vyakhya-indigo/20 dark:text-vyakhya-parchment font-semibold"
      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-100";
  };

  return (
    <div className="flex h-screen overflow-hidden bg-vyakhya-parchment dark:bg-vyakhya-ink text-zinc-900 dark:text-white transition-colors duration-300">
      
      {/* Desktop Left Rail */}
      <nav className="hidden lg:flex flex-col w-64 border-r border-zinc-200 dark:border-zinc-800/50 bg-white/50 dark:bg-vyakhya-ink/80 backdrop-blur-xl z-40 relative">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2 text-zinc-900 dark:text-white hover:opacity-90 transition select-none">
            <div className="bg-vyakhya-saffron rounded-lg p-1.5 shadow-md shadow-vyakhya-saffron/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight font-display">
              Vyakhya
            </span>
          </Link>
        </div>

        <div className="px-4 py-2 space-y-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 cursor-pointer ${activeClass(item.path)}`}
            >
              <item.icon className={`w-5 h-5 ${location.pathname === item.path ? 'text-vyakhya-saffron' : ''}`} />
              <span>{item.name}</span>
            </Link>
          ))}
        </div>

        {/* Bottom Actions Desktop */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/50 space-y-4">
          <div className="flex items-center gap-3 relative group">
            <button
              onClick={() => {
                const popup = document.getElementById("nickname-popup-desktop");
                if (popup) popup.classList.toggle("hidden");
              }}
              className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900/50 transition cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="text-left flex-1 overflow-hidden">
                <p className="text-xs font-medium text-zinc-500 truncate">Hi,</p>
                <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{localName || "Guest"}</p>
              </div>
            </button>

            {/* Nickname Editor Popup */}
            <div id="nickname-popup-desktop" className="hidden absolute bottom-full left-0 mb-2 w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-4 z-50">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">New Nickname</label>
              <form onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const input = form.elements.namedItem("nickname") as HTMLInputElement;
                const next = input.value.trim();
                if (next) {
                  localStorage.setItem("vyakhya_username", next);
                  setLocalName(next);
                  window.dispatchEvent(new Event("storage"));
                  document.getElementById("nickname-popup-desktop")?.classList.add("hidden");
                }
              }}>
                <input 
                  type="text" 
                  name="nickname" 
                  defaultValue={localName || ""} 
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-vyakhya-saffron"
                  required
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => document.getElementById("nickname-popup-desktop")?.classList.add("hidden")} className="px-3 py-1 text-xs">Cancel</button>
                  <button type="submit" className="px-3 py-1 bg-vyakhya-saffron text-white rounded-lg text-xs font-bold">Save</button>
                </div>
              </form>
            </div>
          </div>
          
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full p-2 px-4 rounded-xl text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-y-auto overflow-x-hidden">
        {/* Top Mobile Bar (only visible < lg) */}
        <div className="lg:hidden sticky top-0 z-30 bg-white/80 dark:bg-vyakhya-ink/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800/50 px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-vyakhya-saffron rounded-lg p-1 shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold tracking-tight font-display">Vyakhya</span>
          </Link>
          <div className="flex items-center gap-3">
             <button onClick={toggleTheme} className="p-2 text-zinc-500">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
             </button>
          </div>
        </div>

        {/* Global Command/Search (Desktop & Mobile) floating top center */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 hidden md:flex items-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur border border-zinc-200 dark:border-zinc-800 rounded-full px-4 py-2 shadow-sm shadow-zinc-200/20 w-96 max-w-full cursor-pointer hover:border-vyakhya-saffron transition">
          <Search className="w-4 h-4 text-zinc-400 mr-2" />
          <span className="text-sm text-zinc-400">Search topics, generations... (Cmd+K)</span>
        </div>

        {/* The Page Content */}
        <div className="flex-1 p-4 sm:p-6 md:p-8 pb-24 lg:pb-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 w-full bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 z-50 px-2 pb-safe pt-2">
        <div className="flex justify-around items-center">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
                location.pathname === item.path
                  ? "text-vyakhya-saffron"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <item.icon className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          ))}
        </div>
      </nav>
      
    </div>
  );
}
