"use client";

/**
 * Fullscreen torrent player.
 *
 * Flow: open -> search sources (/api/torrents) -> auto-pick the best seeded
 * torrent -> start it server-side (/api/stream/start) -> point a <video> at
 * /api/stream with HTTP range seeking -> poll stats for peers/speed.
 * Quality can be switched mid-session; progress is saved to localStorage.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  Gauge,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Subtitles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  cn,
  formatTime,
  playabilityRank,
  qualityRank,
  parseSubtitles,
} from "@/lib/utils";
import { getProgress, progressKey, saveProgress } from "@/lib/store";
import type { PlayTarget, TorrentResult } from "@/lib/types";

type Phase = "sources" | "starting" | "playing" | "error";

interface Started {
  infoHash: string;
  fileIdx: number;
  fileName: string;
  fileSize: number;
  browserSafe: boolean;
}

interface Stats {
  progress: number;
  overallProgress?: number;
  peers: number;
  downloadSpeed: number;
  cachedRanges?: { start: number; end: number }[];
}


export default function PlayerOverlay({
  target,
  startPosition = 0,
  onClose,
}: {
  target: PlayTarget;
  startPosition?: number;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("sources");
  const [error, setError] = useState<string>("");
  const [sources, setSources] = useState<TorrentResult[]>([]);
  const [selected, setSelected] = useState<TorrentResult | null>(null);
  const [started, setStarted] = useState<Started | null>(null);
  const [stats, setStats] = useState<Stats>({ progress: 0, peers: 0, downloadSpeed: 0 });
  const [pickerOpen, setPickerOpen] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [bufferedAhead, setBufferedAhead] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
  const [subtitleLabel, setSubtitleLabel] = useState<string | null>(null);
  const [subtitlesLoading, setSubtitlesLoading] = useState(false);

  const bufferTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWaiting = useCallback(() => {
    if (bufferTimer.current) clearTimeout(bufferTimer.current);
    bufferTimer.current = setTimeout(() => {
      setBuffering(true);
    }, 200);
  }, []);

  const handlePlaying = useCallback(() => {
    if (bufferTimer.current) {
      clearTimeout(bufferTimer.current);
      bufferTimer.current = null;
    }
    setBuffering(false);
  }, []);

  const updateBuffered = useCallback((v: HTMLVideoElement) => {
    if (!v || !v.duration || v.buffered.length === 0) return;
    const cur = v.currentTime;
    let ahead = cur;
    for (let i = 0; i < v.buffered.length; i++) {
      const bStart = v.buffered.start(i);
      const bEnd = v.buffered.end(i);
      if (cur >= bStart && cur <= bEnd) {
        ahead = bEnd;
        break;
      } else if (bStart > cur && ahead === cur) {
        ahead = bEnd;
      }
    }
    setBufferedAhead(ahead);
  }, []);

  const loadSubtitles = useCallback(async (auto: boolean = false) => {
    if (!target.imdbId) return;
    setSubtitlesLoading(true);
    try {
      const cacheKey = `/subtitles/${target.imdbId}/${target.season ?? 0}/${target.episode ?? 0}.vtt`;
      const cache = await caches.open("subtitles-v4");
      
      let res = await cache.match(cacheKey);
      let vtt = "";
      
      if (res) {
        vtt = await res.text();
      } else {
        const url = target.type === "movie" 
          ? `https://opensubtitles-v3.strem.io/subtitles/movie/${target.imdbId}.json`
          : `https://opensubtitles-v3.strem.io/subtitles/series/${target.imdbId}:${target.season}:${target.episode}.json`;
        
        const apiRes = await fetch(url);
        const data = await apiRes.json();
        
        const eng = data.subtitles?.filter((s: any) => s.lang === "eng" || s.lang === "en");
        if (!eng || eng.length === 0) {
          if (!auto) alert("No English subtitles found.");
          setSubtitlesLoading(false);
          return;
        }
        
        const subRes = await fetch(eng[0].url);
        const text = await subRes.text();
        const isSrt = !eng[0].url.includes(".vtt");
        vtt = parseSubtitles(text, isSrt);
        
        await cache.put(cacheKey, new Response(vtt, { headers: { "Content-Type": "text/vtt" } }));
      }
      
      const blob = new Blob([vtt], { type: "text/vtt" });
      setSubtitleUrl(URL.createObjectURL(blob));
      setSubtitleLabel("English");
      if (!auto) localStorage.setItem("tf-subtitles", "true");
    } catch (e) {
      console.error("Failed to load subtitles", e);
    } finally {
      setSubtitlesLoading(false);
    }
  }, [target]);

  const toggleSubtitles = useCallback(() => {
    if (subtitleUrl) {
      setSubtitleUrl(null);
      setSubtitleLabel(null);
      localStorage.setItem("tf-subtitles", "false");
    } else {
      loadSubtitles();
    }
  }, [subtitleUrl, loadSubtitles]);

  // Auto-load subtitles if previously enabled
  useEffect(() => {
    if (localStorage.getItem("tf-subtitles") === "true") {
      loadSubtitles(true);
    }
  }, [loadSubtitles]);

  // autoplay was blocked by the browser and needs a real click to start
  const [needsTap, setNeedsTap] = useState(false);
  // autoplay only succeeded after muting — offer one-tap unmute
  const [autoplayMuted, setAutoplayMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekedToStart = useRef(false);
  const userPaused = useRef(false);
  const lastMousePos = useRef({ x: -1, y: -1 });

  const label =
    target.type === "tv"
      ? `${target.title} — S${String(target.season).padStart(2, "0")}E${String(
          target.episode
        ).padStart(2, "0")}${target.episodeName ? ` · ${target.episodeName}` : ""}`
      : target.title;

  /* ---------------- source discovery ---------------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          type: target.type,
          title: target.title,
          tmdbId: String(target.tmdbId),
        });
        if (target.imdbId) params.set("imdbId", target.imdbId);
        if (target.year) params.set("year", target.year);
        if (target.season) params.set("season", String(target.season));
        if (target.episode) params.set("episode", String(target.episode));

        const res = await fetch(`/api/torrents?${params}`);
        const data = await res.json();
        if (cancelled) return;
        const results: TorrentResult[] = data.results ?? [];
        if (!results.length) {
          setPhase("error");
          setError(
            "No torrents found for this title. Try another title or check your connection."
          );
          return;
        }
        setSources(results);
        // Try to restore previously selected torrent if it exists
        const savedHash = getProgress()[progressKey(target)]?.infoHash;
        let best = results.find(r => r.infoHash === savedHash);

        if (!best) {
          // best = seeded, browser-decodable (x264/mp4 over x265/mkv), healthy
          // seeders, prefer 1080p. TV sources skew HEVC/MKV which most
          // browsers can't decode, so playability outranks raw seeds.
          best = [...results].sort(
            (a, b) =>
              Number(b.seeds > 0) - Number(a.seeds > 0) ||
              Number(b.source === "yts") - Number(a.source === "yts") ||
              playabilityRank(a.name) - playabilityRank(b.name) ||
              b.seeds - a.seeds ||
              Math.abs(qualityRank(b.quality) - 3) - Math.abs(qualityRank(a.quality) - 3)
          )[0];
        }
        setSelected(best);
      } catch (e: any) {
        if (cancelled) return;
        setPhase("error");
        setError(e?.message ?? "Failed to search torrents");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  /* ---------------- start selected torrent ---------------- */

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setPhase("starting");
    setStarted(null);
    seekedToStart.current = false;
    (async () => {
      try {
        const res = await fetch("/api/stream/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            magnet: selected.magnet,
            fileIdx: selected.fileIdx,
            season: target.season,
            episode: target.episode,
            title: target.title,
            posterPath: target.posterPath,
            type: target.type,
            tmdbId: target.tmdbId,
            imdbId: target.imdbId,
            episodeName: target.episodeName,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to start torrent");
        setStarted(data);
        setPhase("playing");
      } catch (e: any) {
        if (cancelled) return;
        setPhase("error");
        setError(
          `${e?.message ?? "Could not start torrent"} — the swarm may have no seeders right now.`
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, target]);

  /* ---------------- stats polling ---------------- */

  useEffect(() => {
    if (!started) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/stream/status?infoHash=${started.infoHash}&fileIdx=${started.fileIdx}`);
        if (res.ok) {
          const s = await res.json();
          setStats({
            progress: s.progress ?? 0,
            overallProgress: s.overallProgress ?? 0,
            peers: s.peers ?? 0,
            downloadSpeed: s.downloadSpeed ?? 0,
            cachedRanges: s.cachedRanges,
          });
        }
      } catch {}
    }, 1500);
    return () => clearInterval(id);
  }, [started]);

  /* ---------------- progress persistence ---------------- */

  const persist = useCallback(
    (position: number, dur: number) => {
      if (!dur || Number.isNaN(dur)) return;
      saveProgress({
        key: progressKey(target),
        type: target.type,
        tmdbId: target.tmdbId,
        season: target.season,
        episode: target.episode,
        episodeName: target.episodeName,
        title: target.title,
        poster_path: target.posterPath ?? null,
        backdrop_path: null,
        position,
        duration: dur,
        infoHash: selected?.infoHash,
        quality: selected?.quality,
        updatedAt: Date.now(),
      });
    },
    [target, selected]
  );

  const close = useCallback(() => {
    const v = videoRef.current;
    if (v && v.duration) persist(v.currentTime, v.duration);
    onClose();
  }, [onClose, persist]);

  /* ---------------- keyboard + idle controls ---------------- */

  const nudgeControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (
        (e.nativeEvent.movementX === 0 || e.nativeEvent.movementX === undefined) &&
        (e.nativeEvent.movementY === 0 || e.nativeEvent.movementY === undefined)
      ) {
        return;
      }
      nudgeControls();
    },
    [nudgeControls]
  );

  // Show controls on mount, clean up timer on unmount
  useEffect(() => {
    nudgeControls();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [nudgeControls]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const v = videoRef.current;
      if (e.key === " " && v) {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "Escape") {
        if (pickerOpen) {
          setPickerOpen(false);
        } else {
          close();
        }
      } else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && v) {
        v.currentTime += e.key === "ArrowRight" ? 10 : -10;
      } else if (e.key.toLowerCase() === "m" && v) {
        v.muted = !v.muted;
        setMuted(v.muted);
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
      nudgeControls();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [close, nudgeControls, pickerOpen]);

  useEffect(() => {
    const onBeforeUnload = () => {
      const v = videoRef.current;
      if (v?.duration) persist(v.currentTime, v.duration);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [persist]);

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen().catch(() => {});
  }

  /**
   * Attempt playback, with fallbacks for browser autoplay policies.
   * The <video> mounts long after the user's click (torrent metadata can
   * take ~30s), so the autoPlay attribute alone is often rejected. If
   * unmuted play is blocked, retry muted (always allowed) and offer
   * one-tap unmute; if that also fails, show a tap-to-play button.
   */
  const tryPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || userPaused.current) return;
    v.play().then(
      () => setNeedsTap(false),
      (err: DOMException) => {
        if (err?.name !== "NotAllowedError") return; // AbortError etc. — retried on canplay/seeked
        v.muted = true;
        setMuted(true);
        setAutoplayMuted(true);
        v.play().then(
          () => setNeedsTap(false),
          () => setNeedsTap(true)
        );
      }
    );
  }, []);

  const unmute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    if (v.volume === 0) {
      v.volume = 1;
      setVolume(1);
    }
    setMuted(false);
    setAutoplayMuted(false);
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      userPaused.current = false;
      v.play().catch(() => setNeedsTap(true));
    } else {
      userPaused.current = true;
      v.pause();
    }
  }

  const seekTo = useCallback(
    (value: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = value;
      setCurrent(value);
      setBufferedAhead(value);
      updateBuffered(v);
    },
    [updateBuffered]
  );

  const streamUrl = useMemo(
    () =>
      started
        ? `/api/stream?infoHash=${started.infoHash}&fileIdx=${started.fileIdx}`
        : null,
    [started]
  );



  // Kick off playback whenever a new stream mounts (initial start or quality
  // switch) and show the spinner until first data arrives — torrent pieces
  // can take a while, and a silent black screen looks broken.
  useEffect(() => {
    if (!streamUrl) return;
    userPaused.current = false;
    setNeedsTap(false);
    setAutoplayMuted(false);
    setBuffering(true);
    tryPlay();
  }, [streamUrl, tryPlay]);

  const displayTime = isDragging ? dragValue : current;
  const pct = duration > 0 ? (displayTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (bufferedAhead / duration) * 100 : 0;
  const cachedPct = Math.max(pct, bufferedPct);

  /* ---------------- render ---------------- */

  return (
    <div
      ref={containerRef}
      onMouseMove={nudgeControls}
      onClick={nudgeControls}
      className="fixed inset-0 z-50 flex select-none items-center justify-center overflow-hidden bg-black"
    >
      {/* video element */}
      {streamUrl && (
        <video
          ref={videoRef}
          key={streamUrl}
          src={streamUrl}
          autoPlay
          playsInline
          crossOrigin="anonymous"
          className="h-full w-full object-contain"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
            nudgeControls();
          }}
          onPlay={() => {
            setPlaying(true);
            setNeedsTap(false);
          }}
          onPause={() => setPlaying(false)}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onCanPlay={(e) => {
            handlePlaying();
            updateBuffered(e.currentTarget);
            if (videoRef.current?.paused) tryPlay();
          }}
          onSeeked={(e) => {
            handlePlaying();
            updateBuffered(e.currentTarget);
            if (videoRef.current?.paused) tryPlay();
          }}
          onProgress={(e) => updateBuffered(e.currentTarget)}
          onError={() => {
            const ext = started?.fileName.split(".").pop()?.toUpperCase();
            setPhase("error");
            setError(
              started && !started.browserSafe
                ? `This source is ${ext ?? "an unsupported format"} and your browser can't decode it. Try another quality.`
                : "The video failed to load — the source may be dead. Try another quality."
            );
          }}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setDuration(v.duration);
            v.volume = volume;
            updateBuffered(v);
            if (startPosition > 5 && startPosition < v.duration - 10 && !seekedToStart.current) {
              seekedToStart.current = true;
              v.currentTime = startPosition;
            }
            if (v.textTracks && v.textTracks.length > 0) {
              for (let i = 0; i < v.textTracks.length; i++) {
                v.textTracks[i].mode = "showing";
              }
            }
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (!isDragging) setCurrent(v.currentTime);
            updateBuffered(v);
            if (Math.floor(v.currentTime) % 5 === 0) persist(v.currentTime, v.duration);
          }}
          onEnded={close}
        >
          {subtitleUrl && (
            <track
              kind="subtitles"
              src={subtitleUrl}
              srcLang="en"
              label={subtitleLabel ?? "Subtitles"}
              default
            />
          )}
        </video>
      )}

      {/* tap to start — shown when the browser blocks even muted autoplay */}
      {needsTap && phase === "playing" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              userPaused.current = false;
              tryPlay();
              nudgeControls();
            }}
            className="pointer-events-auto flex flex-col items-center gap-3"
            aria-label="Start playback"
          >
            <span className="grid h-20 w-20 place-items-center rounded-full bg-white text-black shadow-2xl transition hover:scale-105">
              <Play size={34} fill="currentColor" className="ml-1" />
            </span>
            <span className="text-sm font-semibold text-white/90">Click to start playback</span>
          </button>
        </div>
      )}

      {/* one-tap unmute — autoplay was only allowed with sound off */}
      {autoplayMuted && !needsTap && phase === "playing" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            unmute();
            nudgeControls();
          }}
          className="absolute bottom-24 left-1/2 z-[5] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black shadow-lg transition hover:bg-white/85"
        >
          <VolumeX size={16} /> Tap to unmute
        </button>
      )}

      {/* loading / error states */}
      {phase !== "playing" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="pointer-events-auto flex max-w-md flex-col items-center gap-4 text-center">
            {phase === "sources" && (
              <>
                <Loader2 size={40} className="animate-spin text-brand" />
                <p className="text-sm text-muted">Searching torrent sources for…</p>
                <p className="font-semibold">{label}</p>
              </>
            )}
            {phase === "starting" && (
              <>
                <Loader2 size={40} className="animate-spin text-brand" />
                <p className="text-sm text-muted">
                  Connecting to swarm — grabbing metadata from{" "}
                  {selected?.seeds ?? 0} seeders
                </p>
                <p className="max-w-sm truncate text-xs text-muted/70">{selected?.name}</p>
              </>
            )}
            {phase === "error" && (
              <>
                <p className="text-lg font-semibold">Playback failed</p>
                <p className="text-sm text-muted">{error}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={() => setSelected({ ...selected! })}
                    className="flex items-center gap-2 rounded bg-white px-4 py-2 text-sm font-semibold text-black"
                  >
                    <RotateCcw size={15} /> Retry
                  </button>
                  {sources.length > 0 && (
                    <button
                      onClick={() => {
                        setPhase("playing");
                        setPickerOpen(true);
                      }}
                      className="rounded border border-white/40 px-4 py-2 text-sm font-semibold hover:border-brand hover:text-brand"
                    >
                      Switch source
                    </button>
                  )}
                  <button
                    onClick={close}
                    className="rounded bg-white/20 px-4 py-2 text-sm font-semibold"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {buffering && phase === "playing" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 size={44} className="animate-spin text-brand" />
        </div>
      )}

      {/* top bar */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/80 to-transparent p-4 transition-opacity",
          controlsVisible ? "opacity-100" : "opacity-0"
        )}
      >
        <button
          onClick={close}
          className="flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white"
        >
          <ArrowLeft size={22} /> Back to browse
        </button>
        <div className="text-right">
          <p className="max-w-[60vw] truncate text-sm font-semibold md:text-base">{label}</p>
          <p className="flex items-center justify-end gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Download size={11} />
              {(stats.downloadSpeed / 1_048_576).toFixed(1)} MB/s
            </span>
            <span className="flex items-center gap-1">
              <Gauge size={11} />
              {stats.peers} peers
            </span>
            <span className="flex items-center gap-1">
              <Download size={11} />
              {Math.round(stats.progress * 100)}% cached
            </span>
          </p>
        </div>
      </div>

      {/* quality picker dropdown */}
      {pickerOpen && (
        <div className="absolute inset-0 z-10 bg-black/80" onClick={() => setPickerOpen(false)}>
          <div
            className="mx-auto mt-24 w-[min(92vw,540px)] rounded-lg border border-white/10 bg-elevated p-4 tf-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Switch source</h3>
              <button onClick={() => setPickerOpen(false)} className="text-muted hover:text-white">
                <ChevronDown size={18} />
              </button>
            </div>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto">
              {sources.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    if (s.id !== selected?.id) {
                      const v = videoRef.current;
                      if (v?.duration) persist(v.currentTime, v.duration);
                      setSelected(s);
                    }
                    setPickerOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded px-3 py-2.5 text-left text-sm hover:bg-elevated-hover",
                    s.id === selected?.id && "bg-elevated-hover"
                  )}
                >
                  <span className="w-14 shrink-0 text-xs font-bold text-brand">
                    {s.quality}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {s.size ? `${s.size} · ` : ""}👤 {s.seeds}
                  </span>
                  {s.id === selected?.id && <Check size={14} className="shrink-0 text-brand" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* bottom controls */}      {/* bottom controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-4 pt-16 transition-opacity",
          controlsVisible ? "opacity-100" : "opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="w-12 text-right tabular-nums">{formatTime(displayTime)}</span>
          <div className="group relative flex flex-1 items-center h-6 cursor-pointer">
            {/* Base track bar */}
            <div className="absolute inset-x-0 h-1 rounded-full bg-white/20 group-hover:h-1.5 transition-all overflow-hidden pointer-events-none">
              {/* Torrent cached pieces ranges */}
              {stats.cachedRanges && stats.cachedRanges.length > 0 ? (
                stats.cachedRanges.map((r, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 bg-white/50 rounded-full"
                    style={{
                      left: `${r.start * 100}%`,
                      width: `${Math.max(0.4, (r.end - r.start) * 100)}%`,
                    }}
                  />
                ))
              ) : (
                <div
                  className="absolute top-0 bottom-0 bg-white/40 rounded-full"
                  style={{
                    left: 0,
                    width: `${stats.progress * 100}%`,
                  }}
                />
              )}

              {/* Native HTML5 decode buffer ahead (if any) */}
              {bufferedAhead > 0 && duration > 0 && (
                <div
                  className="absolute top-0 bottom-0 bg-white/30"
                  style={{
                    left: `${(current / duration) * 100}%`,
                    width: `${Math.max(0, ((bufferedAhead - current) / duration) * 100)}%`,
                  }}
                />
              )}

              {/* Played progress (Red bar) */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-brand rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Invisible native range slider over the top for scrubbing and clicking */}
            <input
              type="range"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              min={0}
              max={duration || 0}
              step={1}
              value={displayTime}
              onPointerDown={() => setIsDragging(true)}
              onChange={(e) => {
                const val = Number(e.target.value);
                setDragValue(val);
                if (!isDragging) setIsDragging(true);
              }}
              onPointerUp={(e) => {
                setIsDragging(false);
                seekTo(Number((e.target as HTMLInputElement).value));
              }}
              onKeyUp={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  setIsDragging(false);
                  seekTo(Number((e.target as HTMLInputElement).value));
                }
              }}
              aria-label="Seek"
            />

            {/* Red scrubber thumb */}
            <div
              className="pointer-events-none absolute h-3.5 w-3.5 rounded-full bg-brand shadow transition-transform group-hover:scale-125 z-0"
              style={{
                left: `calc(${pct}% - 7px)`,
              }}
            />
          </div>
          <span className="w-12 tabular-nums">{formatTime(duration)}</span>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="hover:text-brand">
            {playing ? <Pause size={26} /> : <Play size={26} fill="currentColor" />}
          </button>

          <div className="group flex items-center gap-2">
            <button
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                v.muted = !v.muted;
                setMuted(v.muted);
                if (!v.muted) setAutoplayMuted(false);
              }}
              aria-label="Mute"
              className="hover:text-brand"
            >
              {muted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const val = Number(e.target.value);
                setVolume(val);
                setMuted(val === 0);
                if (videoRef.current) {
                  videoRef.current.volume = val;
                  videoRef.current.muted = val === 0;
                }
              }}
              className="tf-seek w-0 opacity-0 transition-all group-hover:w-20 group-hover:opacity-100"
              style={{ ["--tf-progress" as any]: `${(muted ? 0 : volume) * 100}%` }}
              aria-label="Volume"
            />
          </div>

          <p className="mx-auto hidden max-w-[30vw] truncate text-sm font-semibold text-white/80 md:block">
            {label}
          </p>

          <div className="ml-auto flex items-center gap-4 md:ml-0">
            <button
              onClick={toggleSubtitles}
              title={subtitleUrl ? "Disable Subtitles" : "Search & Load Subtitles"}
              className={cn("hover:text-brand", subtitleUrl ? "text-brand" : "", subtitlesLoading && "animate-pulse")}
            >
              <Subtitles size={22} />
            </button>
            {subtitleLabel && (
              <span className="max-w-[120px] truncate text-xs text-muted" title={subtitleLabel}>
                {subtitleLabel}
              </span>
            )}
            <button
              onClick={() => setPickerOpen(true)}
              className="rounded border border-white/30 px-2.5 py-1 text-xs font-semibold hover:border-brand hover:text-brand"
              title="Switch quality / source"
            >
              {selected?.quality?.toUpperCase() ?? "AUTO"}
            </button>
            <button onClick={toggleFullscreen} aria-label="Fullscreen" className="hover:text-brand">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
