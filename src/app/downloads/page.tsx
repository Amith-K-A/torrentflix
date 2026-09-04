"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Download, Play, CheckCircle2, AlertCircle, Pause, X, Trash2, Users, AlertTriangle, RotateCcw, Copy, Magnet, Check } from "lucide-react";
import { tmdbImg, cn } from "@/lib/utils";
import PlayerOverlay from "@/components/PlayerOverlay";
import { getProgress, progressKey } from "@/lib/store";

type DownloadStatus = {
  id: string;
  infoHash: string;
  magnet?: string;
  title: string;
  name?: string;
  posterPath?: string;
  progress: number;
  peers: number;
  downloadSpeed: number;
  downloaded: number;
  length: number;
  timeRemaining: number;
  ready: boolean;
  done: boolean;
  paused?: boolean;
  status?: string;
  fileIdx?: number;
  type?: "movie" | "tv";
  tmdbId?: number;
  imdbId?: string | null;
  season?: number;
  episode?: number;
  episodeName?: string;
};

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function formatTime(ms: number) {
  if (!ms || ms === Infinity) return "Calculating...";
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${seconds % 60}s`;
  return `${seconds}s`;
}

const DOWNLOADS_CACHE_KEY = "tf:downloads_cache";

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Hydrate from localStorage on client-side mount without SSR mismatch
  useEffect(() => {
    try {
      const cached = localStorage.getItem(DOWNLOADS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDownloads(parsed);
          setLoading(false);
        }
      }
    } catch {}
  }, []);
  const [confirmCancel, setConfirmCancel] = useState<{
    id: string;
    title: string;
    isDone: boolean;
  } | null>(null);
  const [activeVideo, setActiveVideo] = useState<DownloadStatus | null>(null);
  const [copiedDownloadId, setCopiedDownloadId] = useState<string | null>(null);

  const handleCopyMagnet = async (magnet?: string, id?: string) => {
    if (!magnet) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(magnet);
      } else {
        const el = document.createElement("textarea");
        el.value = magnet;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopiedDownloadId(id || "magnet");
      setTimeout(() => setCopiedDownloadId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAction = async (action: string, id: string) => {
    // Optimistic update
    if (action === "cancel") {
      setDownloads((prev) => {
        const next = prev.filter((d) => d.id !== id);
        try { localStorage.setItem(DOWNLOADS_CACHE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    } else if (action === "pause" || action === "resume") {
      setDownloads((prev) => {
        const next = prev.map((d) =>
          d.id === id
            ? { ...d, paused: action === "pause" }
            : d
        );
        try { localStorage.setItem(DOWNLOADS_CACHE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    }

    try {
      await fetch("/api/downloads/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleGlobalAction = async (action: "clear_all" | "clear_errors") => {
    if (action === "clear_all") {
      setDownloads([]);
      try { localStorage.removeItem(DOWNLOADS_CACHE_KEY); } catch {}
    } else if (action === "clear_errors") {
      setDownloads((prev) => {
        const next = prev.filter((d) => d.status !== "error");
        try { localStorage.setItem(DOWNLOADS_CACHE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    }

    try {
      await fetch("/api/downloads/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchDownloads = async () => {
      try {
        const res = await fetch("/api/downloads", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setDownloads(data);
            try {
              localStorage.setItem(DOWNLOADS_CACHE_KEY, JSON.stringify(data));
            } catch {}
          }
        }
      } catch (err) {
        console.error("Failed to fetch downloads", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchDownloads();
    const interval = setInterval(fetchDownloads, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const hasErrors = downloads.some((d) => d.status === "error");

  const playerTarget = useMemo(() => {
    if (!activeVideo) return null;
    return {
      type: activeVideo.type || "movie",
      tmdbId: activeVideo.tmdbId || 0,
      imdbId: activeVideo.imdbId,
      title: activeVideo.title,
      posterPath: activeVideo.posterPath,
      season: activeVideo.season,
      episode: activeVideo.episode,
      episodeName: activeVideo.episodeName,
    };
  }, [activeVideo]);

  const playerSource = useMemo(() => {
    if (!activeVideo) return null;
    return {
      id: activeVideo.infoHash,
      name: activeVideo.name || activeVideo.title,
      infoHash: activeVideo.infoHash,
      magnet: `magnet:?xt=urn:btih:${activeVideo.infoHash}`,
      quality: "unknown",
      seeds: activeVideo.peers,
      source: "downloads",
      fileIdx: activeVideo.fileIdx,
    };
  }, [activeVideo]);

  const startPosition = useMemo(() => {
    if (!playerTarget) return 0;
    return getProgress()[progressKey(playerTarget as any)]?.position ?? 0;
  }, [playerTarget]);

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex w-full items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Download className="text-brand" size={28} />
            <h1 className="text-3xl font-black tracking-tight">My Downloads</h1>
          </div>

          <div className="flex items-center gap-2">
            {hasErrors && (
              <button
                onClick={() => handleGlobalAction("clear_errors")}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-500/20"
              >
                Clear Errors
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-brand" />
          </div>
        ) : downloads.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-elevated/30 py-20 text-center">
            <Download size={48} className="text-white/20 mb-4" />
            <h2 className="text-xl font-bold mb-2">No active downloads</h2>
            <p className="text-muted max-w-md">
              Downloads you start will appear here and be saved directly to your computer's Downloads folder.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {downloads.map((d) => (
              <div
                key={d.id}
                className="flex flex-col md:flex-row gap-5 rounded-xl border border-white/10 bg-elevated/50 p-4 transition-colors hover:bg-elevated"
              >
                <div className="relative aspect-[2/3] w-20 md:w-24 shrink-0 overflow-hidden rounded-lg bg-black/40 shadow-md">
                  {d.posterPath ? (
                    <Image
                      src={tmdbImg(d.posterPath, "w200") || ""}
                      alt={d.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center bg-white/5 text-xs text-muted text-center p-1">
                      No Poster
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg leading-tight truncate">{d.title}</h3>

                      </div>
                      <div className="shrink-0 text-right">
                        {d.status === "error" ? (
                          <span className="flex items-center gap-1 text-sm font-semibold text-red-500">
                            <AlertCircle size={16} /> Error
                          </span>
                        ) : d.done ? (
                          <span className="flex items-center gap-1 text-sm font-semibold text-green-500">
                            <CheckCircle2 size={16} /> Complete
                          </span>
                        ) : d.paused ? (
                          <span className="text-sm font-semibold text-yellow-500">
                            Paused
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-brand tabular-nums">
                            {(d.progress * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {d.status !== "error" && (
                      <div className="mt-1.5">
                        {d.name && d.name !== d.title && (
                          <p className="text-xs text-muted mt-0.5 mb-2.5 truncate">{d.name}</p>
                        )}
                        {/* Progress Bar */}
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10 mb-2.5">
                          <div
                            className={cn(
                              "h-full transition-all duration-300 ease-out",
                              d.done ? "bg-green-500" : "bg-brand"
                            )}
                            style={{ width: `${Math.max(2, Math.min(100, d.progress * 100))}%` }}
                          />
                        </div>

                        {/* Stats Row */}
                        <div className="flex items-center gap-2 text-xs text-muted tabular-nums">
                          <span className="shrink-0">
                            {formatBytes(d.downloaded)} / {formatBytes(d.length)}
                          </span>
                          {!d.done && !d.paused && d.downloadSpeed > 0 && (
                            <>
                              <span className="text-white/20 shrink-0">•</span>
                              <span className="text-white/80 font-medium shrink-0">
                                {formatBytes(d.downloadSpeed)}/s
                              </span>
                            </>
                          )}
                          {!d.done && (
                            <>
                              <span className="text-white/20 shrink-0">•</span>
                              <span className="text-white/60 shrink-0">
                                <Users size={12} className="inline mr-1" /> {d.peers}
                              </span>
                            </>
                          )}
                          {!d.done && !d.paused && d.downloadSpeed > 0 && d.timeRemaining > 0 && (
                            <span className="ml-auto shrink-0">{formatTime(d.timeRemaining)} remaining</span>
                          )}
                          {d.done && (
                            <>
                              <span className="text-white/20 shrink-0">•</span>
                              <span className="text-white/60">Saved to Downloads/TorrentFlix</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 mt-auto pt-2">
                    {d.status === "error" && (
                      <button
                        onClick={() => handleAction("retry", d.id)}
                        className="flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand/80 active:scale-95 cursor-pointer"
                      >
                        <RotateCcw size={13} />
                        <span>Retry</span>
                      </button>
                    )}
                    {d.done && (
                      <button
                        onClick={() => setActiveVideo(d)}
                        className="flex items-center gap-1.5 rounded-md bg-white px-3.5 py-1.5 text-xs font-bold text-black shadow-sm transition hover:bg-white/90 active:scale-95 cursor-pointer"
                      >
                        <Play size={13} fill="currentColor" />
                        <span>Play</span>
                      </button>
                    )}
                    {!d.done && d.status !== "error" && (
                      <button
                        onClick={() => handleAction(d.paused ? "resume" : "pause", d.id)}
                        className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/90 shadow-sm transition hover:bg-white/10 hover:border-white/20 active:scale-95 cursor-pointer"
                      >
                        {d.paused ? <Play size={13} fill="currentColor" /> : <Pause size={13} fill="currentColor" />}
                        <span>{d.paused ? "Resume" : "Pause"}</span>
                      </button>
                    )}
                    {d.magnet && (
                      <>
                        <button
                          onClick={() => handleCopyMagnet(d.magnet, d.id)}
                          title="Copy magnet URL"
                          className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 shadow-sm transition hover:bg-white/10 hover:border-white/20 hover:text-white active:scale-95 cursor-pointer"
                        >
                          {copiedDownloadId === d.id ? (
                            <>
                              <Check size={13} className="text-emerald-400" />
                              <span className="text-emerald-400 font-semibold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <a
                          href={d.magnet}
                          title="Open / Download in external BitTorrent client"
                          className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 shadow-sm transition hover:bg-white/10 hover:border-white/20 hover:text-brand active:scale-95 cursor-pointer"
                        >
                          <Magnet size={13} className="text-brand" />
                          <span>Magnet</span>
                        </a>
                      </>
                    )}
                    <button
                      onClick={() =>
                        setConfirmCancel({
                          id: d.id,
                          title: d.title,
                          isDone: Boolean(d.done),
                        })
                      }
                      className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 shadow-sm transition hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 active:scale-95 cursor-pointer"
                    >
                      {d.done ? <Trash2 size={13} /> : <X size={13} />}
                      <span>{d.done ? "Delete" : "Cancel"}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setConfirmCancel(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-dim p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-red-500/10 p-3 text-red-500 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">
                  {confirmCancel.isDone ? "Delete Download?" : "Cancel Download?"}
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  Are you sure you want to {confirmCancel.isDone ? "delete" : "cancel"}{" "}
                  <span className="font-semibold text-white">
                    &ldquo;{confirmCancel.title}&rdquo;
                  </span>
                  ?{" "}
                  {confirmCancel.isDone
                    ? "This will remove the downloaded file from your disk."
                    : "You will lose all currently downloaded data for this item."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmCancel(null)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                {confirmCancel.isDone ? "Keep File" : "Keep Downloading"}
              </button>
              <button
                onClick={() => {
                  if (confirmCancel) handleAction("cancel", confirmCancel.id);
                  setConfirmCancel(null);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-95 shadow-md shadow-red-600/20"
              >
                {confirmCancel.isDone ? "Yes, Delete" : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Video Player Modal */}
      {activeVideo && playerTarget && playerSource && (
        <PlayerOverlay
          target={playerTarget as any}
          startPosition={startPosition}
          preselectedSource={playerSource}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </div>
  );
}
