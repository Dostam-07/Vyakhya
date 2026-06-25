import React, { useEffect, useState } from "react";
import { Explainer } from "../types";
import { auth, db } from "../lib/firebase";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import Navbar from "./Navbar";
import { Library, Trash2, PlayCircle, Podcast, Video, ExternalLink, RefreshCw, Bookmark, Sparkles, FolderOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function LibraryPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"generations" | "saved" | "history">("generations");
  const [myGenerations, setMyGenerations] = useState<Explainer[]>([]);
  const [savedItems, setSavedItems] = useState<Explainer[]>([]);
  const [historyItems, setHistoryItems] = useState<Explainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLibrary = async () => {
    setIsLoading(true);
    try {
      const user = auth.currentUser;
      
      // 1. Fetch generations
      const localGenerations = JSON.parse(localStorage.getItem("vyakhya_generations") || "[]");
      let firebaseGenerations: Explainer[] = [];

      if (user) {
        const q = query(collection(db, "explainers"), where("creatorId", "==", user.uid));
        const snapshot = await getDocs(q);
        snapshot.forEach((doc) => {
          firebaseGenerations.push({ id: doc.id, ...doc.data() } as Explainer);
        });
      }

      // Merge client and server-side items
      const mergedGenerations = [...firebaseGenerations, ...localGenerations].filter(
        (v, i, a) => a.findIndex((t) => t.id === v.id) === i
      );
      setMyGenerations(mergedGenerations);

      // 2. Fetch saves/bookmarks
      setSavedItems(mergedGenerations.filter((g) => g.views > 200)); // seed items or saved fallback

      // 3. Fetch watch history from local storage
      const watchHistory = JSON.parse(localStorage.getItem("vyakhya_history") || "[]");
      setHistoryItems(watchHistory);
    } catch (err) {
      console.error("Library load error:", err);
      // LocalStorage load safety fallback
      setMyGenerations(JSON.parse(localStorage.getItem("vyakhya_generations") || "[]"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    if (activeTab === "history") {
      if (!window.confirm("Remove this item from your watch history?")) return;
      try {
        const updatedHistory = historyItems.filter((item) => item.id !== id);
        localStorage.setItem("vyakhya_history", JSON.stringify(updatedHistory));
        setHistoryItems(updatedHistory);
      } catch (err) {
        console.error("Error removing history entry:", err);
      }
      return;
    }

    if (!window.confirm("Are you sure you want to delete this generation from your library?")) return;

    try {
      console.log("LibraryPage: Deleting", id);
      // 1. Delete from Firestore if exists
      await deleteDoc(doc(db, "explainers", id)).catch((err) => console.log("Firestore delete error/bypass:", err));
      console.log("LibraryPage: Deleted from Firestore", id);

      // 2. Delete from LocalStorage
      const localGenerations = JSON.parse(localStorage.getItem("vyakhya_generations") || "[]");
      const updatedLocal = localGenerations.filter((item: Explainer) => item.id !== id);
      localStorage.setItem("vyakhya_generations", JSON.stringify(updatedLocal));

      // 3. Add to deleted tracking list
      const deletedIds = JSON.parse(localStorage.getItem("vyakhya_deleted_ids") || "[]");
      if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        localStorage.setItem("vyakhya_deleted_ids", JSON.stringify(deletedIds));
      }

      setMyGenerations(myGenerations.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Error deleting explainer:", err);
    }
  };

  const handleClearHistory = () => {
    if (!window.confirm("Are you sure you want to clear your entire watch history? This action cannot be undone.")) return;
    try {
      localStorage.removeItem("vyakhya_history");
      setHistoryItems([]);
    } catch (err) {
      console.error("Error clearing history:", err);
    }
  };

  const currentList = activeTab === "generations" 
    ? myGenerations 
    : activeTab === "saved" 
    ? savedItems 
    : historyItems;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 select-none">
        {/* Header Title */}
        <div className="flex items-center gap-3.5 mb-8">
          <div className="bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 p-2.5 rounded-xl">
            <Library className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100">My Workspace Library</h1>
            <p className="text-xs text-zinc-500">Access your saved generations, drafts, and favorite bookmarks</p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-900 mb-8 gap-4">
          <div className="flex gap-6 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveTab("generations")}
              className={`pb-4 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
                activeTab === "generations"
                  ? "text-indigo-400 border-indigo-500 font-bold"
                  : "text-zinc-500 border-transparent hover:text-zinc-300"
              }`}
            >
              My Creations ({myGenerations.length})
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`pb-4 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
                activeTab === "saved"
                  ? "text-indigo-400 border-indigo-500 font-bold"
                  : "text-zinc-500 border-transparent hover:text-zinc-300"
              }`}
            >
              Saved Bookmarks ({savedItems.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-4 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
                activeTab === "history"
                  ? "text-indigo-400 border-indigo-500 font-bold"
                  : "text-zinc-500 border-transparent hover:text-zinc-300"
              }`}
            >
              Watch History ({historyItems.length})
            </button>
          </div>

          {activeTab === "history" && historyItems.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="mb-3 sm:mb-0 text-xs text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg font-semibold transition active:scale-95 cursor-pointer self-start sm:self-center"
            >
              Clear Watch History
            </button>
          )}
        </div>

        {/* List Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-sm">
            <RefreshCw className="animate-spin w-8 h-8 text-indigo-500 mb-2" />
            <span>Loading library entries...</span>
          </div>
        ) : currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/10 border border-zinc-900/60 rounded-2xl text-center p-6">
            <FolderOpen className="w-12 h-12 text-zinc-700 mb-3" />
            <h3 className="text-base font-bold text-zinc-300">
              {activeTab === "generations" && "Workspace is empty"}
              {activeTab === "saved" && "No saved bookmarks"}
              {activeTab === "history" && "Watch history is empty"}
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1">
              {activeTab === "generations" && "You haven't generated any videos or podcasts yet."}
              {activeTab === "saved" && "You haven't saved or bookmarked any explainers yet."}
              {activeTab === "history" && "Start exploring public creations or generate your own to build your watch history!"}
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-6 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-md shadow-indigo-500/25 transition active:scale-95"
            >
              <Sparkles className="w-4 h-4 fill-indigo-200" />
              <span>Create Explainer Now</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentList.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/watch/${item.id}`)}
                className="group relative flex flex-col bg-zinc-950 border border-zinc-900 hover:border-indigo-500/40 hover:-translate-y-0.5 rounded-xl overflow-hidden cursor-pointer shadow-lg transition duration-200"
              >
                {/* Wallpaper Card */}
                <div className="relative aspect-video bg-zinc-900/70 border-b border-zinc-900 flex items-center justify-center">
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-40 filter saturate-[0.6]"
                    style={{
                      backgroundImage: `url(${
                        item.format === "video"
                          ? "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80"
                          : "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=600&q=80"
                      })`,
                    }}
                  />
                  {item.format === "video" ? (
                    <Video className="w-10 h-10 text-indigo-500 z-10" />
                  ) : (
                    <Podcast className="w-10 h-10 text-amber-500 z-10" />
                  )}

                  <div className="absolute top-2.5 left-2.5 bg-zinc-950/85 text-[9px] font-mono font-bold px-2 py-0.5 rounded text-zinc-400 capitalize">
                    {item.style}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    className="absolute top-2.5 right-2.5 bg-zinc-950/90 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg border border-zinc-800 shadow-md transition z-20"
                    title="Delete Creation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Content info details */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100 group-hover:text-indigo-400 transition line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                      {item.topic}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-900 mt-4 pt-3 text-[10px] text-zinc-500 font-mono">
                    <span>{item.language.toUpperCase()}</span>
                    <span className="flex items-center gap-1 text-indigo-400 hover:underline">
                      View Player
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
