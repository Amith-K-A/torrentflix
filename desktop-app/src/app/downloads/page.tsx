"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, Play, CheckCircle2, AlertCircle, Copy, Magnet, Check } from "lucide-react";
import { tmdbImg, cn } from "@/lib/utils";

type DownloadStatus = {
  infoHash: string;
  magnet?: string;
  title: string;
  name?: string;
  posterPath?: string;
  progress: number;
  downloadSpeed: number;
  downloaded: number;
  length: number;
  timeRemaining: number;
  ready: boolean;
  done: boolean;
  status?: string;
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

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadStatus[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    let mounted = true;
    const fetchDownloads = async () => {
      try {
        const res = await fetch("/api/downloads");
        if (res.ok) {
          const data = await res.json();
          if (mounted) setDownloads(data);
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

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-3 mb-8">
          <Download className="text-brand" size={28} />
          <h1 className="text-3xl font-black tracking-tight">My Downloads</h1>
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
                key={d.infoHash}
                className="flex flex-col md:flex-row gap-5 rounded-xl border border-white/10 bg-elevated/50 p-4 transition-colors hover:bg-elevated"
              >
                <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-black md:h-32 md:w-20">
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

                <div className="flex flex-1 flex-col justify-center min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="font-bold text-lg line-clamp-1">{d.title}</h3>
                      {d.name && d.name !== d.title && (
                        <p className="text-xs text-muted line-clamp-1">{d.name}</p>
                      )}
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
                      ) : (
                        <span className="text-sm font-semibold text-brand">
                          {(d.progress * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {!d.done && d.status !== "error" && (
                    <>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-black/50 mb-3">
                        <div
                          className="h-full bg-brand transition-all duration-500 ease-out"
                          style={{ width: `${Math.max(2, d.progress * 100)}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                        <div className="flex gap-4">
                          <span>
                            {formatBytes(d.downloaded)} / {formatBytes(d.length)}
                          </span>
                          {d.downloadSpeed > 0 && (
                            <span className="text-white/80">
                              {formatBytes(d.downloadSpeed)}/s
                            </span>
                          )}
                        </div>
                        {d.downloadSpeed > 0 && d.timeRemaining > 0 && (
                          <span>{formatTime(d.timeRemaining)} remaining</span>
                        )}
                      </div>
                    </>
                  )}
                  
                  {d.done && (
                    <p className="text-xs text-muted mt-2">
                      Saved to Downloads/TorrentFlix
                    </p>
                  )}

                  {d.magnet && (
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => handleCopyMagnet(d.magnet, d.infoHash)}
                        title="Copy magnet link"
                        className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 shadow-sm transition hover:bg-white/10 hover:border-white/20 hover:text-white active:scale-95 cursor-pointer"
                      >
                        {copiedDownloadId === d.infoHash ? (
                          <>
                            <Check size={13} className="text-emerald-400" />
                            <span className="text-emerald-400 font-semibold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Copy Magnet</span>
                          </>
                        )}
                      </button>
                      <a
                        href={d.magnet}
                        title="Open in external BitTorrent client"
                        className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 shadow-sm transition hover:bg-white/10 hover:border-white/20 hover:text-brand active:scale-95 cursor-pointer"
                      >
                        <Magnet size={13} className="text-brand" />
                        <span>Magnet</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
