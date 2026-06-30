import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Video,
  Podcast,
  Volume2,
  Clock,
  Zap,
  Users,
  RefreshCw,
  BookOpen,
  CheckCircle,
  HelpCircle,
  Activity,
  Award,
} from "lucide-react";

// Define TypeScript structures for our fetched payload
interface AnalyticsPayload {
  metrics: {
    totalCreations: number;
    totalViews: number;
    averageDurationSeconds: number;
    remainingQuota: number;
    quotaMax: number;
    activeUsers: number;
  };
  weeklyActivity: Array<{
    day: string;
    videos: number;
    podcasts: number;
  }>;
  formatBreakdown: Array<{
    name: string;
    value: number;
  }>;
  languageBreakdown: Array<{
    language: string;
    count: number;
  }>;
  styleDistribution: Array<{
    styleName: string;
    count: number;
  }>;
  voiceEngineUsage: Array<{
    engine: string;
    count: number;
  }>;
}

// Fetcher function
const fetchAnalyticsMetrics = async (): Promise<AnalyticsPayload> => {
  const response = await fetch("/api/analytics-metrics");
  if (!response.ok) {
    throw new Error("Failed to fetch analytics metrics from the endpoint.");
  }
  return response.json();
};

export default function AnalyticsDashboard() {
  // TanStack Query configuration
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery<AnalyticsPayload>({
    queryKey: ["analytics-metrics"],
    queryFn: fetchAnalyticsMetrics,
    staleTime: 30000, // 30 seconds cache stability before marking stale
    gcTime: 1000 * 60 * 5, // Keep garbage collection memory for 5 minutes
    retry: 2, // Automatic retry twice before failing
  });

  const COLORS = ["#6366f1", "#f59e0b", "#ec4899", "#10b981", "#8b5cf6"];

  return (
    <div className="w-full pb-16">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header Block with TanStack Query Status */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-6 select-none">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
                Active Integration
              </span>
              <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
                TanStack Query v5
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-100 mt-2">
              Analytics & Engine Performance
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1">
              Real-time monitor tracking Vyakhya pipeline status, media distributions, and Gemini API rate protection statistics.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            {dataUpdatedAt && (
              <span className="text-[10px] font-mono text-zinc-500">
                Synced: {new Date(dataUpdatedAt).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => refetch()}
              disabled={isLoading || isFetching}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 hover:text-white px-3.5 py-2 rounded-xl text-xs font-semibold font-mono transition select-none disabled:opacity-50"
              id="refetch-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-indigo-400" : ""}`} />
              <span>{isFetching ? "Syncing..." : "Sync Query"}</span>
            </button>
          </div>
        </div>

        {/* Query Engine State Indicator */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-zinc-900/10 border border-zinc-900 p-4 rounded-2xl select-none text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/10">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <p className="font-mono text-[10px] text-zinc-500 uppercase">Cache Lifecycle State</p>
              <p className="font-bold text-zinc-300">
                {isLoading ? "Fetching (Fresh)" : isFetching ? "Revalidating (Stale)" : "Fresh (Stale in 30s)"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-zinc-900 pt-3 md:pt-0 md:pl-4">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/10">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="font-mono text-[10px] text-zinc-500 uppercase">Network Overhead</p>
              <p className="font-bold text-emerald-400">0ms (Served from memory)</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-zinc-900 pt-3 md:pt-0 md:pl-4">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/10">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-mono text-[10px] text-zinc-500 uppercase">Rate-Limit Protection</p>
              <p className="font-bold text-amber-400">Browser TTS Safe-Mode</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-zinc-900 pt-3 md:pt-0 md:pl-4">
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/10">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="font-mono text-[10px] text-zinc-500 uppercase">Observer Client Channel</p>
              <p className="font-bold text-zinc-300">Isolated Sandbox Iframe</p>
            </div>
          </div>
        </div>

        {/* LOADING STATE - Skeleton Screen */}
        {isLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-6 h-32 animate-pulse space-y-3" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 bg-zinc-900/40 border border-zinc-900 rounded-2xl p-6 h-96 animate-pulse" />
              <div className="lg:col-span-4 bg-zinc-900/40 border border-zinc-900 rounded-2xl p-6 h-96 animate-pulse" />
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {isError && (
          <div className="bg-rose-950/10 border border-rose-900/30 rounded-2xl p-8 text-center space-y-4 max-w-xl mx-auto select-none">
            <div className="mx-auto w-12 h-12 bg-rose-500/15 text-rose-400 rounded-full flex items-center justify-center border border-rose-500/20">
              <HelpCircle className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100">Analytics Fetch Interrupted</h3>
              <p className="text-xs text-zinc-500 mt-2 font-mono leading-relaxed bg-zinc-950 p-3 rounded-lg border border-zinc-900/60">
                {error?.message || "An unexpected error occurred during API handshakes."}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-mono rounded-xl transition"
            >
              Retry API Query Connection
            </button>
          </div>
        )}

        {/* METRICS & VISUALIZATIONS SECTION */}
        {data && !isLoading && !isError && (
          <div className="space-y-8">
            
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Total Creations */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 shadow-xl flex flex-col justify-between select-none relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition">
                  <TrendingUp className="w-24 h-24 text-indigo-500" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">Total Creations</span>
                  <p className="text-2xl sm:text-3xl font-extrabold text-zinc-100 font-mono tracking-tight">
                    {data.metrics.totalCreations}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 mt-4 text-[10px] text-zinc-500 font-mono">
                  <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded">+12%</span>
                  <span>vs. last week</span>
                </div>
              </div>

              {/* Public Views */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 shadow-xl flex flex-col justify-between select-none relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition">
                  <Users className="w-24 h-24 text-indigo-500" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">Total Plays</span>
                  <p className="text-2xl sm:text-3xl font-extrabold text-zinc-100 font-mono tracking-tight">
                    {data.metrics.totalViews.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 mt-4 text-[10px] text-zinc-500 font-mono">
                  <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded">+48%</span>
                  <span>view momentum</span>
                </div>
              </div>

              {/* Avg Duration */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 shadow-xl flex flex-col justify-between select-none relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition">
                  <Clock className="w-24 h-24 text-amber-500" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">Avg Segment Duration</span>
                  <p className="text-2xl sm:text-3xl font-extrabold text-zinc-100 font-mono tracking-tight">
                    {data.metrics.averageDurationSeconds}s
                  </p>
                </div>
                <div className="flex items-center gap-1.5 mt-4 text-[10px] text-zinc-500 font-mono">
                  <span className="text-indigo-400 font-bold bg-indigo-500/10 px-1 rounded">Optimized</span>
                  <span>for retention</span>
                </div>
              </div>

              {/* Active Daily Quota */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 shadow-xl flex flex-col justify-between select-none relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition">
                  <Zap className="w-24 h-24 text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">Gemini Daily Quota</span>
                  <p className="text-2xl sm:text-3xl font-extrabold text-zinc-100 font-mono tracking-tight">
                    {data.metrics.remainingQuota}/{data.metrics.quotaMax}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 mt-4 text-[10px] text-zinc-500 font-mono">
                  <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full"
                      style={{ width: `${(data.metrics.remainingQuota / data.metrics.quotaMax) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Weekly Trend (Area Chart) */}
              <div className="lg:col-span-8 bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-2xl flex flex-col justify-between h-[420px]">
                <div className="mb-4">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-semibold">Activity Trend</span>
                  <h3 className="text-lg font-bold text-zinc-100">Weekly Generation Volume</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Explainer videos versus podcast format generations over the past week.</p>
                </div>
                <div className="flex-1 w-full min-h-0 text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.weeklyActivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVideos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorPodcasts" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#18181b" strokeDasharray="3 3" />
                      <XAxis dataKey="day" stroke="#52525b" />
                      <YAxis stroke="#52525b" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#09090b", borderColor: "#18181b", color: "#f4f4f5" }}
                        labelStyle={{ fontWeight: "bold" }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Area type="monotone" name="Explainer Videos" dataKey="videos" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorVideos)" />
                      <Area type="monotone" name="Podcast Dialogues" dataKey="podcasts" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorPodcasts)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Format Split (Pie Chart) */}
              <div className="lg:col-span-4 bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-2xl flex flex-col justify-between h-[420px]">
                <div className="mb-4">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-semibold">Format Distribution</span>
                  <h3 className="text-lg font-bold text-zinc-100">Relative Output Shares</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Ratio between visually animated and audio dialog designs.</p>
                </div>
                <div className="flex-1 w-full min-h-0 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.formatBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data.formatBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#09090b", borderColor: "#18181b", color: "#f4f4f5" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legend positioned inside panel overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                    <span className="text-2xl font-extrabold font-mono text-zinc-200">142</span>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold font-sans">Creations</span>
                  </div>
                </div>
                <div className="space-y-2 mt-4 text-xs font-mono">
                  <div className="flex justify-between items-center bg-zinc-900/40 p-2.5 rounded-xl border border-zinc-900">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" />
                      <span className="text-zinc-400 font-sans">Videos</span>
                    </span>
                    <span className="font-bold text-zinc-200">94 (66%)</span>
                  </div>
                  <div className="flex justify-between items-center bg-zinc-900/40 p-2.5 rounded-xl border border-zinc-900">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                      <span className="text-zinc-400 font-sans">Podcasts</span>
                    </span>
                    <span className="font-bold text-zinc-200">48 (34%)</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Narration Styles & Voice Engines breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Narration Style (Bar Chart) */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-2xl h-[360px] flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-semibold">Tonal Statistics</span>
                  <h3 className="text-lg font-bold text-zinc-100">Narration Style Choice Distribution</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Which tone configuration options builders choose most.</p>
                </div>
                <div className="flex-1 w-full min-h-0 text-xs mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.styleDistribution} layout="vertical" margin={{ top: 10, right: 10, left: 15, bottom: 5 }}>
                      <CartesianGrid stroke="#18181b" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" stroke="#52525b" />
                      <YAxis dataKey="styleName" type="category" stroke="#52525b" width={80} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#09090b", borderColor: "#18181b", color: "#f4f4f5" }}
                      />
                      <Bar dataKey="count" fill="#ec4899" radius={[0, 6, 6, 0]}>
                        {data.styleDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Rate-Limit Protection Stats */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-2xl h-[360px] flex flex-col justify-between select-none">
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-semibold">Limit Conservator</span>
                  <h3 className="text-lg font-bold text-zinc-100">Voice Synthesis Engine Selection</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Telemetry tracking free client-side voice vs. Gemini premium limits.</p>
                </div>
                <div className="space-y-5 flex-1 flex flex-col justify-center">
                  
                  {/* Browser Engine */}
                  <div className="space-y-2 bg-indigo-950/5 border border-indigo-900/10 p-4 rounded-xl">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-indigo-400">
                        <Zap className="w-4 h-4" />
                        <span>Browser Speech Synthesis (Unlimited)</span>
                      </span>
                      <span className="font-mono text-zinc-300">115 / 142 (81%)</span>
                    </div>
                    <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full" style={{ width: "81%" }} />
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-normal">
                      Bypasses external networks to speak directly on user device browser thread. ZERO rate limits.
                    </p>
                  </div>

                  {/* Gemini Premium API */}
                  <div className="space-y-2 bg-amber-950/5 border border-amber-900/10 p-4 rounded-xl">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-amber-500">
                        <Volume2 className="w-4 h-4" />
                        <span>Gemini AI Studio Studio Voice</span>
                      </span>
                      <span className="font-mono text-zinc-300">27 / 142 (19%)</span>
                    </div>
                    <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: "19%" }} />
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-normal">
                      Premium raw wave narration sent through Gemini 3.1 TTS. Subject to hourly project quotas.
                    </p>
                  </div>

                </div>
              </div>

            </div>

          </div>
        )}

        {/* EDUCATIONAL EXPLAINER ACCORDION (Providing an explainer for the data fetching and rendering process) */}
        <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2.5 select-none">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base sm:text-lg font-extrabold text-zinc-200 uppercase tracking-wider">
              Educational Explainer: TanStack Query & Rendering Lifecycle
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-sm">
            <div className="lg:col-span-7 space-y-4">
              <p className="text-zinc-400 leading-relaxed text-xs sm:text-sm">
                This dashboard uses **TanStack Query (React Query)** to handle data fetching, state management, and memory-caching seamlessly without forcing manual page refreshes.
              </p>

              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <CheckCircle className="w-4 h-4 text-indigo-400 mt-1 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300 uppercase font-mono">01. Declarative Query Keys</h4>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                      We register our fetch requests under the deterministic query key `["analytics-metrics"]`. If any other view demands this resource, TanStack Query immediately retrieves the existing memory copy instead of issuing duplicate HTTP requests.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <CheckCircle className="w-4 h-4 text-indigo-400 mt-1 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300 uppercase font-mono">02. State-Aware Revalidation (Stale While Revalidate)</h4>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                      With `staleTime: 30000` (30 seconds), client-side queries remain "Fresh". When they turn "Stale", subsequent mounts trigger a background refetch to guarantee data accuracy while continuing to show current cache snapshots immediately.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <CheckCircle className="w-4 h-4 text-indigo-400 mt-1 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300 uppercase font-mono">03. Responsive Vector Canvas Rendering</h4>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                      Recharts uses custom SVG paths that calculate layout parameters dynamically. Combined with Tailwind's flex/grid classes, vectors automatically adjust aspect-ratios without incurring layout reflow cycles.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-zinc-950 border border-zinc-900 rounded-xl p-5 space-y-4 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-zinc-300 uppercase font-mono mb-2 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>State Monitor Logging</span>
                </h4>
                
                <div className="font-mono text-[11px] text-zinc-400 space-y-2 bg-zinc-900/50 p-4 rounded-lg border border-zinc-900/80 leading-relaxed">
                  <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                    <span className="text-zinc-500">Query Status:</span>
                    <span className="text-emerald-400 font-bold">success</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                    <span className="text-zinc-500">Stale State:</span>
                    <span className="text-amber-500 font-bold">
                      {isFetching ? "Revalidating" : "Fresh"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                    <span className="text-zinc-500">Cache Lifetime (gc):</span>
                    <span className="text-indigo-400 font-bold">300,000ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Device Render Engine:</span>
                    <span className="text-purple-400 font-bold">SVG Canvas</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-zinc-600 leading-normal select-none">
                * Note: The cache is managed in an in-memory storage engine. Re-entering this tab leverages instant cache retrieval without network overhead.
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
