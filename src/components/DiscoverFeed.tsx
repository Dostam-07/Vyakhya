import React, { useState, useEffect, useMemo } from "react";
import { Explainer } from "../types";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { Search, Compass, Clock, ThumbsUp, Sparkles, AlertCircle, PlayCircle, Podcast, Eye, Bookmark, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DiscoverFeedProps {
  onSelect?: (explainer: Explainer) => void;
}

export default function DiscoverFeed({ onSelect }: DiscoverFeedProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"recent" | "trending" | "saved">("recent");
  const [explainers, setExplainers] = useState<Explainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [trendingTopics, setTrendingTopics] = useState<any[]>([]);
  const [semanticResults, setSemanticResults] = useState<any[] | null>(null);

  // Load from firestore
  const fetchExplainers = async () => {
    setIsLoading(true);
    try {
      // Avoid composite index requirement by only sorting, then filtering in memory if needed
      const q = query(
        collection(db, "explainers"),
        orderBy("createdAt", "desc"),
        limit(30)
      );
      const snapshot = await getDocs(q);
      console.log("DiscoverFeed: Snapshot size", snapshot.size);
      const items: Explainer[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Explainer;
        if (data.isPublic !== false) {
          items.push({ id: doc.id, ...data });
        }
      });

      // Merge from localStorage for robust fallback and local edits
      const localGenerations: Explainer[] = JSON.parse(localStorage.getItem("vyakhya_generations") || "[]");
      const localMap = new Map(localGenerations.map(g => [g.id, g]));

      // Add any local generations that are public but not in Firestore yet
      localGenerations.forEach((localExp) => {
         if (localExp.isPublic !== false && !items.some(item => item.id === localExp.id)) {
            items.push(localExp);
         }
      });

      // Optional: Check if we have deleted items from localStorage tracking
      const deletedIds = JSON.parse(localStorage.getItem("vyakhya_deleted_ids") || "[]");
      const validItems = items.filter(item => !deletedIds.includes(item.id));

      console.log("DiscoverFeed: Valid Items", validItems);
      setExplainers(validItems);
    } catch (error) {
      console.error("Firestore fetch error:", error);
      setExplainers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExplainers();
  }, [sortBy]);

  // F-07: Fetch grounded trending topics dynamically
  useEffect(() => {
    const fetchTrends = async () => {
      try {
        const res = await fetch(`/api/trending-topics?domain=${selectedTag || "Science"}`);
        if (res.ok) {
          const data = await res.json();
          setTrendingTopics(data || []);
        }
      } catch (err) {
        console.error("Trends fetch failed:", err);
      }
    };
    fetchTrends();
  }, [selectedTag]);

  // F-04: Debounce semantic vector search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSemanticResults(null);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch("/api/semantic-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery }),
        });
        if (res.ok) {
          const data = await res.json();
          setSemanticResults(data.results || []);
        }
      } catch (err) {
        console.warn("Semantic search failed:", err);
      }
    }, 450);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Client and vector ranked filtering
  const filteredExplainers = explainers.filter((exp) => {
    const matchesTag = !selectedTag || exp.tags.includes(selectedTag);
    if (semanticResults !== null) {
      // Filter to explainers matching embedding scores
      return matchesTag && semanticResults.some((r) => r.explainerId === exp.id);
    }
    const matchesSearch =
      exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.topic.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && matchesTag;
  });

  // Sort by semantic similarity if active
  if (semanticResults !== null) {
    filteredExplainers.sort((a, b) => {
      const scoreA = semanticResults.find((r) => r.explainerId === a.id)?.similarity || 0;
      const scoreB = semanticResults.find((r) => r.explainerId === b.id)?.similarity || 0;
      return scoreB - scoreA;
    });
  }

  const dynamicTags = useMemo(() => {
    const tagsMap: Record<string, number> = {};
    explainers.forEach((ex) => {
      if (ex.tags && Array.isArray(ex.tags)) {
        ex.tags.forEach(t => {
          tagsMap[t] = (tagsMap[t] || 0) + 1;
        });
      }
    });
    // Sort by count descending, keep top 10
    return Object.entries(tagsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
  }, [explainers]);

  return (
    <div className="w-full space-y-6">
      {/* Search and Filters panel */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-2xl p-4 sm:px-6 shadow-sm dark:shadow-md transition-colors duration-300">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Semantic keyword or topic search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none transition"
          />
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setSortBy("recent")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold select-none border transition cursor-pointer ${
              sortBy === "recent"
                ? "bg-indigo-50 dark:bg-indigo-600/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
                : "bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Latest</span>
          </button>
          <button
            onClick={() => setSortBy("trending")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold select-none border transition cursor-pointer ${
              sortBy === "trending"
                ? "bg-indigo-50 dark:bg-indigo-600/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
                : "bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Trending</span>
          </button>
          <button
            onClick={() => setSortBy("saved")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold select-none border transition cursor-pointer ${
              sortBy === "saved"
                ? "bg-indigo-50 dark:bg-indigo-600/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
                : "bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Most Saved</span>
          </button>
        </div>
      </div>

      {/* Tags Cloud */}
      <div className="flex flex-wrap items-center gap-2 select-none">
        <button
          onClick={() => setSelectedTag(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
            selectedTag === null
              ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
              : "bg-zinc-50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-900 text-zinc-550 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          All Topics
        </button>
        {dynamicTags.map(({ tag, count }) => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
              selectedTag === tag
                ? "bg-vyakhya-indigo/10 border-vyakhya-indigo/30 text-vyakhya-indigo dark:bg-vyakhya-indigo/20 dark:border-vyakhya-indigo/50 dark:text-vyakhya-parchment"
                : "bg-zinc-50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-900 text-zinc-500 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <span>{tag}</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${selectedTag === tag ? 'bg-vyakhya-indigo/20 text-vyakhya-indigo dark:text-vyakhya-parchment' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* F-07 Grounded Real-world Trends shelf */}
      {trendingTopics.length > 0 && (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-2xl p-5 sm:p-6 mb-2 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4 select-none">
            <div className="bg-indigo-600/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 p-1.5 rounded-lg">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Google Grounded Real-world Trends</span>
                <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-mono uppercase">Live via Search</span>
              </h4>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Popular regional and national curriculum concepts trending now. Click any to create instantly!</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trendingTopics.slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                onClick={() => {
                  navigate("/", { state: { topic: item.topic, length: item.length || "short" } });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="bg-zinc-50 dark:bg-zinc-900/30 hover:bg-zinc-100 dark:hover:bg-zinc-900/85 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/30 p-4 rounded-xl cursor-pointer transition duration-200 group flex flex-col justify-between shadow-sm hover:shadow"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-1">{item.topic}</span>
                    <span className="bg-indigo-500/10 border border-indigo-500/20 text-[9px] text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-mono uppercase font-bold">{item.length || "short"}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">{item.hook}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(item.tags || []).map((tag: string) => (
                    <span key={tag} className="bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800/60 text-[9px] px-1.5 py-0.5 rounded font-mono">#{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid of cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-2xl h-80 animate-pulse flex flex-col justify-end p-5">
              <div className="w-20 bg-zinc-200 dark:bg-zinc-800 h-4 rounded mb-2" />
              <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-6 rounded mb-2" />
              <div className="w-2/3 bg-zinc-200 dark:bg-zinc-800 h-5 rounded" />
            </div>
          ))}
        </div>
      ) : explainers.length === 0 ? (
        <div id="honest_empty_feed" className="flex flex-col items-center justify-center p-16 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-3xl text-center space-y-4 max-w-xl mx-auto shadow-xl dark:shadow-2xl transition-colors duration-300">
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 rounded-full animate-bounce inline-block">
            <Compass className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">No public explainers yet</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
            Be the first to create one! Use Vyakhya v2.0 to translate complex ideas into cinematic videos or dual-speaker podcasts.
          </p>
          <button
            onClick={() => navigate("/")}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-6 py-2.5 rounded-xl text-sm transition active:scale-95 cursor-pointer shadow-lg shadow-indigo-500/20"
          >
            Go to Creation Studio
          </button>
        </div>
      ) : filteredExplainers.length === 0 ? (
        <div id="search_empty_feed" className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-2xl text-center text-zinc-500 dark:text-zinc-400 shadow-sm">
          <AlertCircle className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mb-2" />
          <p className="font-semibold text-sm">No explainers match your search keywords</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Try other tags or adjust search query</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExplainers.map((exp) => (
            <div
              key={exp.id}
              onClick={() => {
                if (onSelect) onSelect(exp);
                else navigate(`/watch/${exp.id}`);
              }}
              className="group flex flex-col bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 hover:border-indigo-500/40 hover:-translate-y-1 rounded-2xl overflow-hidden cursor-pointer shadow-md dark:shadow-glow transition-all duration-300 select-none"
            >
              {/* Media Card Preview */}
              <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-900 flex items-center justify-center">
                {/* Simulated first-frame wallpaper */}
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-60 filter saturate-[0.8]"
                  style={{
                    backgroundImage: `url(${
                      exp.format === "video"
                        ? "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80"
                        : "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=600&q=80"
                    })`,
                  }}
                />

                {/* Cover Frame Glow Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-90" />

                <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                  <span className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 text-[10px] font-bold px-2.5 py-1 rounded-md text-zinc-300 font-mono">
                    {exp.language.split("-")[0].toUpperCase()}
                  </span>
                  <span className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 text-[10px] font-bold px-2.5 py-1 rounded-md text-zinc-300 font-mono capitalize">
                    {exp.style}
                  </span>
                </div>

                <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-[10px] font-semibold text-zinc-300 px-2 py-0.5 rounded font-mono z-10">
                  {exp.duration}s
                </div>

                {/* Animated launcher icons */}
                <div className="z-10 group-hover:scale-110 transition duration-300">
                  {exp.format === "video" ? (
                    <PlayCircle className="w-12 h-12 text-indigo-500 fill-zinc-950/40" />
                  ) : (
                    <Podcast className="w-12 h-12 text-amber-500 fill-zinc-950/40" />
                  )}
                </div>
              </div>

              {/* Title & Metadata */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-1">
                    {exp.title}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1.5 leading-relaxed">
                    {exp.topic}
                  </p>
                </div>

                {/* Footer values */}
                <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-900/80 mt-4 pt-3.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <img
                      src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=40&h=40&q=80"
                      alt="Creator avatar"
                      className="w-5 h-5 rounded-full"
                    />
                    <span className="font-medium text-zinc-500 dark:text-zinc-400">{exp.creatorName || "Anonymous"}</span>
                  </div>

                  <div className="flex items-center gap-2.5 font-mono text-zinc-400 dark:text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {exp.views}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bookmark className="w-3.5 h-3.5" />
                      {exp.saves}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Beautiful curation list representing default seed explainers (now empty for honesty)
export const SEED_EXPLAINERS: Explainer[] = [];
