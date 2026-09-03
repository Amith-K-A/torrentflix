"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleHelp, Play, Plus, Star, Download, X, Copy, Magnet, Loader2 } from "lucide-react";
import { cn, tmdbImg, playabilityRank, qualityRank } from "@/lib/utils";
import type { EpisodeItem, MediaItem, PlayTarget, TorrentResult } from "@/lib/types";
import type { MediaDetails } from "@/lib/tmdb";
import { useWatchedEpisodes, useWatchlist, useProgressList } from "@/hooks/useStore";
import { getProgress, progressKey } from "@/lib/store";
import PlayerOverlay from "./PlayerOverlay";
import SeasonTabs from "./SeasonTabs";

const CircularProgress = ({ progress }: { progress: number }) => {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress * circumference);
  
  return (
    <div title={`Downloading ${Math.round(progress * 100)}%`} className="relative flex items-center justify-center shrink-0 min-w-[28px] h-[28px]">
      <svg className="absolute inset-0 w-full h-full -rotate-90">
        <circle
          cx="14"
          cy="14"
          r={radius}
          className="stroke-gray-700"
          strokeWidth="2.5"
          fill="none"
        />
        <circle
          cx="14"
          cy="14"
          r={radius}
          className="stroke-red-500 transition-all duration-300 ease-out"
          strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[9px] font-bold tracking-tighter text-white relative z-10">
        {Math.round(progress * 100)}%
      </span>
    </div>
  );
};

export default function WatchView({ details }: { details: MediaDetails }) {
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(details.type === "tv");
  const [season, setSeason] = useState(1);
  const [target, setTarget] = useState<PlayTarget | null>(null);
  const [startPosition, setStartPosition] = useState(0);
  const [showOverview, setShowOverview] = useState<Record<number, boolean>>({});
  const [mounted, setMounted] = useState(false);

  const { has, toggle } = useWatchlist();
  const progresses = useProgressList();
  const router = useRouter();
  const [downloadingTarget, setDownloadingTarget] = useState<string | null>(null);
  const [downloadModalTarget, setDownloadModalTarget] = useState<PlayTarget | null>(null);
  const [downloadSources, setDownloadSources] = useState<TorrentResult[] | null>(null);
  const [activeDownloads, setActiveDownloads] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [sourcesCache] = useState<Record<string, TorrentResult[]>>({});
  const [quickLoading, setQuickLoading] = useState<string | null>(null);

  async function handleCopyMagnet(magnet: string, id: string) {
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
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      console.error("Failed to copy magnet:", err);
    }
  }

  async function fetchBestTorrent(t: PlayTarget): Promise<TorrentResult | null> {
    const key = t.type === "tv" ? `S${t.season}E${t.episode}` : "movie";
    if (sourcesCache[key]?.length) {
      return sourcesCache[key][0];
    }

    const params = new URLSearchParams({
      type: t.type,
      title: t.title,
      tmdbId: String(t.tmdbId),
    });
    if (t.imdbId) params.set("imdbId", t.imdbId);
    if (t.year) params.set("year", t.year);
    if (t.season) params.set("season", String(t.season));
    if (t.episode) params.set("episode", String(t.episode));

    const res = await fetch(`/api/torrents?${params}`);
    const data = await res.json();
    const results: TorrentResult[] = data.results ?? [];
    if (!results.length) return null;

    const sorted = [...results].sort(
      (a, b) =>
        Number(b.seeds > 0) - Number(a.seeds > 0) ||
        Number(b.source === "yts") - Number(a.source === "yts") ||
        playabilityRank(a.name) - playabilityRank(b.name) ||
        b.seeds - a.seeds ||
        Math.abs(qualityRank(b.quality) - 3) - Math.abs(qualityRank(a.quality) - 3)
    );
    sourcesCache[key] = sorted;
    return sorted[0];
  }

  async function handleQuickCopyMagnet(t: PlayTarget, actionId: string) {
    setQuickLoading(actionId);
    try {
      const best = await fetchBestTorrent(t);
      if (!best?.magnet) {
        alert("No magnet link found for this title.");
        return;
      }
      await handleCopyMagnet(best.magnet, actionId);
    } catch (err) {
      alert("Failed to find magnet link.");
    } finally {
      setQuickLoading(null);
    }
  }

  async function handleQuickDownloadMagnet(t: PlayTarget, actionId: string) {
    setQuickLoading(actionId);
    try {
      const best = await fetchBestTorrent(t);
      if (!best?.magnet) {
        alert("No magnet link found for this title.");
        return;
      }
      window.location.href = best.magnet;
    } catch (err) {
      alert("Failed to open magnet link.");
    } finally {
      setQuickLoading(null);
    }
  }

  useEffect(() => {
    let mounted = true;
    const fetchDownloads = () => {
      fetch("/api/downloads")
        .then((r) => r.json())
        .then((data) => {
          if (mounted) setActiveDownloads(data);
        })
        .catch(() => {});
    };
    
    fetchDownloads();
    const interval = setInterval(fetchDownloads, 2000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-restore player on reload
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("active_player");
      if (saved) {
        const t = JSON.parse(saved) as PlayTarget;
        if (String(t.tmdbId) === String(details.id) && t.type === details.type) {
          openPlay(t, true);
        }
      }
    } catch (e) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details.id, details.type]);

  const mediaItem: MediaItem = {
    id: details.id,
    media_type: details.type,
    title: details.title,
    overview: details.overview,
    poster_path: details.poster_path,
    backdrop_path: details.backdrop_path,
    vote_average: details.vote_average,
    year: details.year,
  };

  useEffect(() => {
    if (details.type !== "tv") return;
    let cancelled = false;
    setEpisodesLoading(true);
    fetch(`/api/tmdb/tv/${details.id}/season/${season}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setEpisodes(Array.isArray(data.episodes) ? data.episodes : []);
      })
      .catch(() => setEpisodes([]))
      .finally(() => !cancelled && setEpisodesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [details.id, details.type, season]);

  function openPlay(t: PlayTarget, restored = false) {
    const saved = getProgress()[progressKey(t)];
    setStartPosition(saved && saved.position > 10 && saved.position / (saved.duration || 1) < 0.95 ? saved.position : 0);
    setTarget(t);
    if (!restored) {
      sessionStorage.setItem('active_player', JSON.stringify(t));
    }
  }

  function closePlay() {
    setTarget(null);
    sessionStorage.removeItem('active_player');
  }

  async function openDownloadModal(t: PlayTarget) {
    const key = t.type === "tv" ? `S${t.season}E${t.episode}` : "movie";
    setDownloadingTarget(key);
    try {
      const params = new URLSearchParams({
        type: t.type,
        title: t.title,
        tmdbId: String(t.tmdbId),
      });
      if (t.imdbId) params.set("imdbId", t.imdbId);
      if (t.year) params.set("year", t.year);
      if (t.season) params.set("season", String(t.season));
      if (t.episode) params.set("episode", String(t.episode));

      const res = await fetch(`/api/torrents?${params}`);
      const data = await res.json();
      const results: TorrentResult[] = data.results ?? [];
      
      if (!results.length) {
        alert("No sources found to download.");
        setDownloadingTarget(null);
        return;
      }

      const sorted = [...results].sort(
        (a, b) =>
          Number(b.seeds > 0) - Number(a.seeds > 0) ||
          Number(b.source === "yts") - Number(a.source === "yts") ||
          playabilityRank(a.name) - playabilityRank(b.name) ||
          b.seeds - a.seeds ||
          Math.abs(qualityRank(b.quality) - 3) - Math.abs(qualityRank(a.quality) - 3)
      );

      setDownloadSources(sorted);
      sourcesCache[key] = sorted;
      setDownloadModalTarget(t);
    } catch (err) {
      alert("Failed to fetch sources.");
    } finally {
      setDownloadingTarget(null);
    }
  }

  async function confirmDownload(t: PlayTarget, source: TorrentResult) {
    const label = t.type === "tv"
      ? `${t.title} — S${String(t.season).padStart(2, "0")}E${String(t.episode).padStart(2, "0")}${t.episodeName ? ` · ${t.episodeName}` : ""}`
      : t.title;

    setDownloadModalTarget(null);

    try {
      const res = await fetch("/api/downloads/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          magnet: source.magnet,
          title: label,
          posterPath: t.posterPath,
          fileIdx: source.fileIdx,
          type: t.type,
          tmdbId: t.tmdbId,
          imdbId: t.imdbId,
          season: t.season,
          episode: t.episode,
          episodeName: t.episodeName,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start download");
      }

      router.push("/downloads");
    } catch (err: any) {
      alert(err.message || "Failed to start download.");
    }
  }

  const backdrop = tmdbImg(details.backdrop_path ?? details.poster_path, "w1280");
  const runtime =
    details.type === "movie"
      ? details.runtime
        ? `${details.runtime}m`
        : null
      : details.episode_run_time?.[0]
        ? `${details.episode_run_time[0]}m/ep`
        : null;

  return (
    <div className="min-h-screen pb-16">
      {/* banner */}
      <div className="relative h-[62vh] min-h-[420px] w-full">
        {backdrop && (
          <Image src={backdrop} alt={details.title} fill priority sizes="100vw" className="object-cover object-top" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-surface to-transparent" />

        <div className="absolute bottom-[10%] left-4 right-4 max-w-5xl md:left-10 md:right-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            {details.type === "tv" ? "TV Series" : "Film"}
          </p>
          <h1 className="mt-1 text-3xl font-black leading-tight md:text-5xl">{details.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {details.vote_average > 0 && (
              <span className="flex items-center gap-1 font-semibold">
                <Star size={14} className="fill-yellow-400 text-yellow-400" />
                {details.vote_average.toFixed(1)}
              </span>
            )}
            {details.year && <span className="text-muted">{details.year}</span>}
            {runtime && <span className="text-muted">{runtime}</span>}
            {details.genres.slice(0, 3).map((g) => (
              <span key={g.id} className="border border-white/30 px-2 py-0.5 text-xs text-muted">
                {g.name}
              </span>
            ))}
          </div>
          <p className="mt-3 line-clamp-3 max-w-xl text-sm text-white/85 md:text-base">
            {details.overview}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2.5 sm:gap-3">
            <button
              onClick={() =>
                openPlay({
                  type: details.type,
                  tmdbId: details.id,
                  imdbId: details.imdb_id,
                  title: details.title,
                  year: details.year,
                  posterPath: details.poster_path,
                  ...(details.type === "tv" ? { season: 1, episode: 1 } : {}),
                })
              }
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-6 text-sm font-bold text-black shadow-md transition hover:bg-white/90 active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <Play size={18} fill="currentColor" />
              <span>{details.type === "movie" ? "Stream Now" : "Play S1 E1"}</span>
            </button>
            {(() => {
              if (details.type === "movie") {
                const md = activeDownloads.find(d => d.type === "movie" && d.tmdbId === details.id);
                if (md?.done || (md && md.progress >= 1)) {
                  return (
                    <div className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-5 text-sm font-semibold text-emerald-400 whitespace-nowrap">
                      <Check size={18} />
                      <span>Downloaded</span>
                    </div>
                  );
                }
                if (md) return (
                  <div className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 px-4">
                    <CircularProgress progress={md.progress} />
                  </div>
                );
              }
              return (
                <button
                  onClick={() =>
                    openDownloadModal({
                      type: details.type,
                      tmdbId: details.id,
                      imdbId: details.imdb_id,
                      title: details.title,
                      year: details.year,
                      posterPath: details.poster_path,
                      ...(details.type === "tv" ? { season: 1, episode: 1 } : {}),
                    })
                  }
                  disabled={downloadingTarget !== null}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-5 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-white/20 hover:text-white active:scale-95 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  <Download size={18} />
                  <span>{downloadingTarget === (details.type === "tv" ? "S1E1" : "movie") ? "Starting..." : "Download"}</span>
                </button>
              );
            })()}
            {/* Direct Copy Magnet URL button on Movie/Show Hero */}
            <button
              type="button"
              onClick={() =>
                handleQuickCopyMagnet(
                  {
                    type: details.type,
                    tmdbId: details.id,
                    imdbId: details.imdb_id,
                    title: details.title,
                    year: details.year,
                    posterPath: details.poster_path,
                    ...(details.type === "tv" ? { season: 1, episode: 1 } : {}),
                  },
                  "hero-copy"
                )
              }
              disabled={quickLoading !== null}
              title="Copy magnet link of best source to clipboard"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-white/20 hover:text-white active:scale-95 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              {copiedId === "hero-copy" ? (
                <>
                  <Check size={18} className="text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied!</span>
                </>
              ) : quickLoading === "hero-copy" ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Finding...</span>
                </>
              ) : (
                <>
                  <Copy size={18} />
                  <span>Copy Magnet</span>
                </>
              )}
            </button>
            {/* Direct Download Magnet button on Movie/Show Hero */}
            <button
              type="button"
              onClick={() =>
                handleQuickDownloadMagnet(
                  {
                    type: details.type,
                    tmdbId: details.id,
                    imdbId: details.imdb_id,
                    title: details.title,
                    year: details.year,
                    posterPath: details.poster_path,
                    ...(details.type === "tv" ? { season: 1, episode: 1 } : {}),
                  },
                  "hero-download"
                )
              }
              disabled={quickLoading !== null}
              title="Open magnet link in external BitTorrent app (qBittorrent, etc.)"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-white/20 hover:text-brand active:scale-95 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              {quickLoading === "hero-download" ? (
                <>
                  <Loader2 size={18} className="animate-spin text-brand" />
                  <span>Opening...</span>
                </>
              ) : (
                <>
                  <Magnet size={18} className="text-brand" />
                  <span>Download Magnet</span>
                </>
              )}
            </button>
            <button
              onClick={() => toggle(mediaItem)}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-5 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-white/20 hover:text-white active:scale-95 whitespace-nowrap cursor-pointer"
            >
              {mounted && has(mediaItem) ? <Check size={18} /> : <Plus size={18} />}
              <span>{mounted && has(mediaItem) ? "In My List" : "My List"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* episodes */}
      {details.type === "tv" && details.seasons.length > 0 && (
        <div className="mt-6 px-4 md:px-10">
          <SeasonTabs
            seasons={details.seasons}
            active={season}
            onSelect={(s) => setSeason(s)}
          />
          <div className="mt-4 space-y-2">
            {episodesLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-[104px] animate-pulse rounded bg-elevated" />
                ))
              : episodes.map((ep: any) => {
                  const activeDownload = activeDownloads.find(
                    (d) =>
                      d.type === "tv" &&
                      d.tmdbId === details.id &&
                      d.season === ep.season_number &&
                      d.episode === ep.episode_number
                  );
                  const isDownloaded = activeDownload?.done;
                  const still = tmdbImg(ep.still_path, "w300");
                  const expanded = showOverview[ep.episode_number];
                  
                  const progressEntry = progresses.find(
                    (p) =>
                      p.type === "tv" &&
                      p.tmdbId === details.id &&
                      p.season === ep.season_number &&
                      p.episode === ep.episode_number
                  );
                  const progressPercent =
                    progressEntry && progressEntry.duration > 0
                      ? Math.min(100, Math.max(0, (progressEntry.position / progressEntry.duration) * 100))
                      : 0;

                  return (
                    <div
                      key={ep.id}
                      className={cn(
                        "group flex gap-4 rounded-lg p-3 transition-colors hover:bg-elevated"
                      )}
                    >
                      <button
                        onClick={() =>
                          openPlay({
                            type: "tv",
                            tmdbId: details.id,
                            imdbId: details.imdb_id,
                            title: details.title,
                            year: details.year,
                            season: ep.season_number,
                            episode: ep.episode_number,
                            episodeName: ep.name,
                            posterPath: details.poster_path,
                          })
                        }
                        className="relative h-[72px] w-[128px] shrink-0 overflow-hidden rounded bg-elevated md:h-[86px] md:w-[154px]"
                      >
                        {still ? (
                          <Image src={still} alt={ep.name} fill sizes="154px" className="object-cover opacity-80 group-hover:opacity-60" />
                        ) : (
                          <div className="grid h-full place-items-center text-xs text-muted">No preview</div>
                        )}
                        <span className="absolute inset-0 grid place-items-center">
                          <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-black/50 opacity-0 transition group-hover:opacity-100">
                            <Play size={16} fill="currentColor" />
                          </span>
                        </span>
                        {progressPercent > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                            <div className="h-full bg-brand" style={{ width: `${progressPercent}%` }} />
                          </div>
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-semibold">
                              {ep.episode_number}. {ep.name}
                            </h3>
                            <p className="mt-0.5 text-xs text-muted">
                              {ep.runtime ? `${ep.runtime}m` : ""}
                              {ep.air_date ? ` · ${ep.air_date}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isDownloaded || (activeDownload && activeDownload.progress >= 1) ? (
                              <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 text-xs font-semibold text-emerald-400 border border-emerald-500/30 whitespace-nowrap" title="Downloaded">
                                <Check size={12} />
                                Downloaded
                              </span>
                            ) : activeDownload ? (
                              <div className="inline-flex h-8 w-8 items-center justify-center">
                                <CircularProgress progress={activeDownload.progress} />
                              </div>
                            ) : (
                              <button
                                onClick={() => openDownloadModal({
                                  type: "tv",
                                  tmdbId: details.id,
                                  imdbId: details.imdb_id,
                                  title: details.title,
                                  year: details.year,
                                  season: ep.season_number,
                                  episode: ep.episode_number,
                                  episodeName: ep.name,
                                  posterPath: details.poster_path,
                                })}
                                disabled={downloadingTarget !== null}
                                title="Download episode"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-muted transition hover:border-white hover:text-white hover:bg-white/10 disabled:opacity-50 cursor-pointer"
                              >
                                <Download size={13} />
                              </button>
                            )}
                            {/* Copy Magnet URL for episode */}
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickCopyMagnet(
                                  {
                                    type: "tv",
                                    tmdbId: details.id,
                                    imdbId: details.imdb_id,
                                    title: details.title,
                                    year: details.year,
                                    season: ep.season_number,
                                    episode: ep.episode_number,
                                    episodeName: ep.name,
                                    posterPath: details.poster_path,
                                  },
                                  `ep-${ep.episode_number}-copy`
                                )
                              }
                              disabled={quickLoading !== null}
                              title="Copy magnet URL for this episode"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-muted transition hover:border-white hover:text-white hover:bg-white/10 disabled:opacity-50 cursor-pointer"
                            >
                              {copiedId === `ep-${ep.episode_number}-copy` ? (
                                <Check size={13} className="text-emerald-400" />
                              ) : quickLoading === `ep-${ep.episode_number}-copy` ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>
                            {/* Download Magnet for episode in external client */}
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickDownloadMagnet(
                                  {
                                    type: "tv",
                                    tmdbId: details.id,
                                    imdbId: details.imdb_id,
                                    title: details.title,
                                    year: details.year,
                                    season: ep.season_number,
                                    episode: ep.episode_number,
                                    episodeName: ep.name,
                                    posterPath: details.poster_path,
                                  },
                                  `ep-${ep.episode_number}-download`
                                )
                              }
                              disabled={quickLoading !== null}
                              title="Open / Download magnet in external BitTorrent client"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-muted transition hover:border-brand hover:text-brand hover:bg-white/10 disabled:opacity-50 cursor-pointer"
                            >
                              {quickLoading === `ep-${ep.episode_number}-download` ? (
                                <Loader2 size={13} className="animate-spin text-brand" />
                              ) : (
                                <Magnet size={13} className="text-brand" />
                              )}
                            </button>
                          </div>
                        </div>
                        <p
                          className={cn(
                            "mt-1 text-xs leading-relaxed text-muted",
                            !expanded && "line-clamp-2"
                          )}
                        >
                          {ep.overview || "No description available."}
                        </p>
                        {ep.overview.length > 120 && (
                          <button
                            onClick={() =>
                              setShowOverview((o: Record<number, boolean>) => ({ ...o, [ep.episode_number]: !o[ep.episode_number] }))
                            }
                            className="mt-1 text-xs text-muted hover:text-white"
                          >
                            {expanded ? "less" : "more"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            {!episodesLoading && episodes.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">No episodes found for this season.</p>
            )}
          </div>
        </div>
      )}

      {/* movie info panel */}
      {details.type === "movie" && (
        <div className="mt-8 px-4 md:px-10">
          <div className="grid gap-6 rounded-lg border border-white/10 bg-elevated/50 p-5 md:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold text-muted">About</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/80">{details.overview}</p>
              {details.tagline && <p className="mt-2 text-xs italic text-muted">“{details.tagline}”</p>}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted">Genres</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {details.genres.map((g) => (
                  <span key={g.id} className="rounded-full bg-white/10 px-3 py-1 text-xs">
                    {g.name}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted">How streaming works</h3>
              <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-muted">
                <CircleHelp size={14} className="mt-0.5 shrink-0" />
                The torrent is fetched peer-to-peer by your local server and played while
                it downloads. Nothing is stored permanently.
              </p>
            </div>
          </div>
        </div>
      )}

      {target && (
        <PlayerOverlay target={target} startPosition={startPosition} onClose={closePlay} />
      )}

      {/* Download Selection Modal */}
      {downloadModalTarget && downloadSources && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setDownloadModalTarget(null)}>
          <div 
            className="w-full max-w-lg rounded-xl border border-white/10 bg-elevated shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 p-4 bg-elevated">
              <h2 className="text-lg font-bold">Select File to Download</h2>
              <button onClick={() => setDownloadModalTarget(null)} className="text-muted hover:text-white transition">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-3 space-y-2">
              {downloadSources.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-3 transition hover:border-white/10 hover:bg-white/[0.06]"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-brand/20 px-2 py-0.5 text-xs font-bold text-brand">
                        {s.quality}
                      </span>
                      {s.source === "yts" && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                          Web Optimized
                        </span>
                      )}
                      <span className="text-xs text-muted">
                        {s.size ? `${s.size} · ` : ""}👤 {s.seeds} seeders
                      </span>
                    </div>
                    <span className="truncate text-xs font-medium text-white/90" title={s.name}>
                      {s.name}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {/* Copy Magnet URL */}
                    <button
                      type="button"
                      onClick={() => handleCopyMagnet(s.magnet, s.id)}
                      title="Copy magnet link to clipboard"
                      className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/20 hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      {copiedId === s.id ? (
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

                    {/* Open / Download Magnet in default BitTorrent app */}
                    <a
                      href={s.magnet}
                      title="Download magnet in external BitTorrent app (qBittorrent, etc.)"
                      className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                    >
                      <Magnet size={13} className="text-brand" />
                      <span>Magnet</span>
                    </a>

                    {/* In-app download to ~/Downloads/TorrentFlix */}
                    <button
                      type="button"
                      onClick={() => confirmDownload(downloadModalTarget, s)}
                      title="Download within TorrentFlix"
                      className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-bold text-white shadow transition hover:bg-brand/90 active:scale-95 cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
