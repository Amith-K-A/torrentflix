"use client";

import Image from "next/image";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleHelp, Play, Plus, Star, Download, X, Copy, Magnet, Loader2 } from "lucide-react";
import { cn, tmdbImg, playabilityRank, qualityRank } from "@/lib/utils";
import type { EpisodeItem, MediaItem, PlayTarget, TorrentResult } from "@/lib/types";
import type { MediaDetails } from "@/lib/tmdb";
import { useWatchedEpisodes, useWatchlist, useProgressList } from "@/hooks/useStore";
import { getProgress, progressKey } from "@/lib/store";
import PlayerOverlay from "./PlayerOverlay";
import SeasonTabs from "./SeasonTabs";

export default function WatchView({ details }: { details: MediaDetails }) {
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(details.type === "tv");
  const [season, setSeason] = useState(1);
  const [target, setTarget] = useState<PlayTarget | null>(null);
  const [startPosition, setStartPosition] = useState(0);
  const [showOverview, setShowOverview] = useState<Record<number, boolean>>({});
  const [mounted, setMounted] = useState(false);

  const { has, toggle } = useWatchlist();
  const { isEpisodeWatched, toggleEpisode } = useWatchedEpisodes(details.id);
  const progresses = useProgressList();

  const currentEpisodeTarget = useMemo(() => {
    if (!mounted) {
      return {
        season: 1,
        episode: 1,
        episodeName: undefined,
        isResumable: false,
        label: details.type === "movie" ? "Stream Now" : "Play S1 E1",
      };
    }

    if (details.type === "movie") {
      const movieProgress = progresses.find(
        (p) => p.type === "movie" && p.tmdbId === details.id
      );
      const isResumable =
        movieProgress &&
        movieProgress.position > 15 &&
        movieProgress.position / (movieProgress.duration || 1) < 0.92;
      return {
        season: undefined,
        episode: undefined,
        episodeName: undefined,
        isResumable: Boolean(isResumable),
        label: isResumable ? "Resume" : "Stream Now",
      };
    }

    // For TV series:
    // 1. Check if the user has watch progress on any episode of this show
    const showProgresses = progresses.filter(
      (p) => p.type === "tv" && p.tmdbId === details.id
    );
    const mostRecent = showProgresses[0]; // progresses is sorted by updatedAt desc

    if (mostRecent && mostRecent.season && mostRecent.episode) {
      const curSeason = mostRecent.season;
      const curEpisode = mostRecent.episode;
      const isPartiallyWatched =
        mostRecent.position > 15 &&
        mostRecent.position / (mostRecent.duration || 1) < 0.90;

      // If user is currently in the middle of this episode, resume it!
      if (isPartiallyWatched) {
        return {
          season: curSeason,
          episode: curEpisode,
          episodeName: mostRecent.episodeName,
          isResumable: true,
          label: `Resume S${curSeason} E${curEpisode}`,
        };
      }

      // If most recent episode was completed (>= 90%), find the NEXT episode!
      const currentSeasonObj = (details.seasons || []).find(
        (s) => s.season_number === curSeason
      );
      if (currentSeasonObj && curEpisode < currentSeasonObj.episode_count) {
        const nextEp = curEpisode + 1;
        return {
          season: curSeason,
          episode: nextEp,
          episodeName: undefined,
          isResumable: false,
          label: `Play S${curSeason} E${nextEp}`,
        };
      }

      // Check if there is a next season
      const nextSeasonObj = (details.seasons || []).find(
        (s) => s.season_number === curSeason + 1
      );
      if (nextSeasonObj && nextSeasonObj.episode_count > 0) {
        return {
          season: curSeason + 1,
          episode: 1,
          episodeName: undefined,
          isResumable: false,
          label: `Play S${curSeason + 1} E1`,
        };
      }
    }

    // 2. Fallback: Check sequentially for the first unwatched episode
    const validSeasons = (details.seasons || [])
      .filter((s) => s.season_number > 0)
      .sort((a, b) => a.season_number - b.season_number);

    for (const s of validSeasons) {
      for (let epNum = 1; epNum <= (s.episode_count || 1); epNum++) {
        const p = progresses.find(
          (prog) =>
            prog.type === "tv" &&
            prog.tmdbId === details.id &&
            prog.season === s.season_number &&
            prog.episode === epNum
        );
        const isEpWatched =
          isEpisodeWatched(s.season_number, epNum) ||
          (p && (p.position / (p.duration || 1)) >= 0.90);

        if (!isEpWatched) {
          const isPartiallyWatched =
            p && p.position > 15 && (p.position / (p.duration || 1)) < 0.90;
          return {
            season: s.season_number,
            episode: epNum,
            episodeName: p?.episodeName,
            isResumable: Boolean(isPartiallyWatched),
            label: isPartiallyWatched
              ? `Resume S${s.season_number} E${epNum}`
              : `Play S${s.season_number} E${epNum}`,
          };
        }
      }
    }

    // Default fallback
    return {
      season: 1,
      episode: 1,
      episodeName: undefined,
      isResumable: false,
      label: "Play S1 E1",
    };
  }, [details, progresses, isEpisodeWatched, mounted]);

  const router = useRouter();
  const [downloadingTarget, setDownloadingTarget] = useState<string | null>(null);
  const [downloadModalTarget, setDownloadModalTarget] = useState<PlayTarget | null>(null);
  const [downloadModalMode, setDownloadModalMode] = useState<"download" | "magnet">("download");
  const [downloadSources, setDownloadSources] = useState<TorrentResult[] | null>(null);
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
      const key = t.type === "tv" ? `S${t.season}E${t.episode}` : "movie";
      let sorted = sourcesCache[key];
      if (!sorted || sorted.length === 0) {
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
          alert("No sources found for this title.");
          return;
        }

        sorted = [...results].sort(
          (a, b) =>
            Number(b.seeds > 0) - Number(a.seeds > 0) ||
            Number(b.source === "yts") - Number(a.source === "yts") ||
            playabilityRank(a.name) - playabilityRank(b.name) ||
            b.seeds - a.seeds ||
            Math.abs(qualityRank(b.quality) - 3) - Math.abs(qualityRank(a.quality) - 3)
        );
        sourcesCache[key] = sorted;
      }

      setDownloadSources(sorted);
      setDownloadModalMode("magnet");
      setDownloadModalTarget(t);
    } catch (err) {
      alert("Failed to fetch sources.");
    } finally {
      setQuickLoading(null);
    }
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent background page scrolling and scrollbars when player or modal is open
  useEffect(() => {
    if (target || downloadModalTarget) {
      const origBodyOverflow = document.body.style.overflow;
      const origHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = origBodyOverflow;
        document.documentElement.style.overflow = origHtmlOverflow;
      };
    }
  }, [target, downloadModalTarget]);

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
    setDownloadModalMode("download");
    const key = t.type === "tv" ? `S${t.season}E${t.episode}` : "movie";
    setDownloadingTarget(key);
    try {
      if (sourcesCache[key] && sourcesCache[key].length > 0) {
        setDownloadSources(sourcesCache[key]);
        setDownloadModalTarget(t);
        return;
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
      await fetch("/api/downloads/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          magnet: source.magnet,
          title: label,
          posterPath: t.posterPath,
        }),
      });

      router.push("/downloads");
    } catch (err) {
      alert("Failed to start download.");
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
                  ...(details.type === "tv"
                    ? {
                        season: currentEpisodeTarget.season,
                        episode: currentEpisodeTarget.episode,
                        episodeName: currentEpisodeTarget.episodeName,
                      }
                    : {}),
                })
              }
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-6 text-sm font-bold text-black shadow-md transition hover:bg-white/90 active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <Play size={18} fill="currentColor" />
              <span>{currentEpisodeTarget.label}</span>
            </button>
            <button
              onClick={() =>
                openDownloadModal({
                  type: details.type,
                  tmdbId: details.id,
                  imdbId: details.imdb_id,
                  title: details.title,
                  year: details.year,
                  posterPath: details.poster_path,
                  ...(details.type === "tv"
                    ? {
                        season: currentEpisodeTarget.season,
                        episode: currentEpisodeTarget.episode,
                        episodeName: currentEpisodeTarget.episodeName,
                      }
                    : {}),
                })
              }
              disabled={downloadingTarget !== null}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-5 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-white/20 hover:text-white active:scale-95 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Download size={18} />
              <span>
                {downloadingTarget === (details.type === "tv" ? `S${currentEpisodeTarget.season}E${currentEpisodeTarget.episode}` : "movie") ? "Starting..." : "Download"}
              </span>
            </button>
            {/* Direct Copy Magnet URL on Movie/Show Hero */}
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
                    ...(details.type === "tv"
                      ? {
                          season: currentEpisodeTarget.season,
                          episode: currentEpisodeTarget.episode,
                          episodeName: currentEpisodeTarget.episodeName,
                        }
                      : {}),
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
            {/* Direct Download Magnet on Movie/Show Hero */}
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
                    ...(details.type === "tv"
                      ? {
                          season: currentEpisodeTarget.season,
                          episode: currentEpisodeTarget.episode,
                          episodeName: currentEpisodeTarget.episodeName,
                        }
                      : {}),
                  },
                  "hero-download"
                )
              }
              disabled={quickLoading !== null}
              title="Select and download magnet link in external BitTorrent app"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-white/20 hover:text-brand active:scale-95 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              {quickLoading === "hero-download" ? (
                <>
                  <Loader2 size={18} className="animate-spin text-brand" />
                  <span>Fetching...</span>
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
                  const watched = isEpisodeWatched(ep.season_number, ep.episode_number);
                  const still = tmdbImg(ep.still_path, "w300");
                  const expanded = showOverview[ep.episode_number];
                  return (
                    <div
                      key={ep.id}
                      className={cn(
                        "group flex gap-4 rounded-lg p-3 transition-colors hover:bg-elevated",
                        watched && "opacity-75"
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
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold">
                              {ep.episode_number}. {ep.name}
                            </h3>
                            <p className="mt-0.5 text-xs text-muted">
                              {ep.runtime ? `${ep.runtime}m` : ""}
                              {ep.air_date ? ` · ${ep.air_date}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => toggleEpisode(ep.season_number, ep.episode_number)}
                              title={watched ? "Mark unwatched" : "Mark watched"}
                              className={cn(
                                "inline-flex h-8 w-8 items-center justify-center rounded-full border transition cursor-pointer",
                                watched
                                  ? "border-brand bg-brand text-white"
                                  : "border-white/20 bg-white/5 text-muted hover:border-white hover:text-white hover:bg-white/10"
                              )}
                            >
                              <Check size={13} />
                            </button>
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
                              title="Select and download magnet link for this episode"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={() => setDownloadModalTarget(null)}>
          <div 
            className="w-full max-w-2xl lg:max-w-3xl rounded-2xl border border-white/15 bg-surface/95 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-white/[0.02]">
              <div>
                <div className="flex items-center gap-2">
                  <Magnet className="text-brand" size={20} />
                  <h2 className="text-lg font-bold text-white">
                    {downloadModalMode === "magnet" ? "Select Torrent to Download Magnet" : "Select File to Download"}
                  </h2>
                </div>
                <p className="text-xs text-muted mt-0.5 font-medium">
                  {downloadModalTarget.title}
                  {downloadModalTarget.season && downloadModalTarget.episode
                    ? ` · Season ${downloadModalTarget.season}, Episode ${downloadModalTarget.episode}${downloadModalTarget.episodeName ? ` (${downloadModalTarget.episodeName})` : ""}`
                    : downloadModalTarget.year ? ` (${downloadModalTarget.year})` : ""}
                </p>
              </div>
              <button 
                onClick={() => setDownloadModalTarget(null)} 
                className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-4 sm:p-5 space-y-3">
              {downloadSources.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-brand/20 px-2.5 py-1 text-xs font-bold text-brand border border-brand/30">
                        {s.quality}
                      </span>
                      {s.source === "yts" && (
                        <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/25">
                          Web Optimized
                        </span>
                      )}
                      {s.size && (
                        <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/90">
                          {s.size}
                        </span>
                      )}
                      <span className={cn(
                        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold border",
                        s.seeds > 0
                          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                          : "border-white/10 bg-white/5 text-muted"
                      )}>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {s.seeds} seeders
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Copy Magnet URL */}
                      <button
                        type="button"
                        onClick={() => handleCopyMagnet(s.magnet, s.id)}
                        title="Copy magnet link to clipboard"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-medium text-white/80 transition hover:border-white/30 hover:bg-white/10 hover:text-white cursor-pointer active:scale-95"
                      >
                        {copiedId === s.id ? (
                          <>
                            <Check size={14} className="text-emerald-400" />
                            <span className="text-emerald-400 font-semibold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {/* Download Magnet Link: Real anchor tag so browser / OS protocol handler receives it reliably */}
                      <a
                        href={s.magnet}
                        onClick={() => {
                          handleCopyMagnet(s.magnet, s.id);
                          setTimeout(() => setDownloadModalTarget(null), 1500);
                        }}
                        title="Open magnet in external BitTorrent app (qBittorrent, etc.)"
                        className={cn(
                          "inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-bold transition cursor-pointer active:scale-95 whitespace-nowrap",
                          downloadModalMode === "magnet"
                            ? "bg-brand text-white shadow-lg shadow-brand/25 hover:bg-brand/90 hover:brightness-110"
                            : "border border-white/15 bg-white/5 text-white/90 hover:border-white/30 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <Magnet size={14} className={downloadModalMode === "magnet" ? "text-white" : "text-brand"} />
                        <span>{downloadModalMode === "magnet" ? "Download Magnet" : "Magnet"}</span>
                      </a>

                      {/* In-app download to ~/Downloads/TorrentFlix */}
                      <button
                        type="button"
                        onClick={() => confirmDownload(downloadModalTarget, s)}
                        title="Download within TorrentFlix"
                        className={cn(
                          "inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold transition cursor-pointer active:scale-95 whitespace-nowrap",
                          downloadModalMode === "download"
                            ? "bg-brand text-white shadow-lg shadow-brand/25 hover:bg-brand/90 hover:brightness-110"
                            : "border border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <Download size={14} />
                        <span>{downloadModalMode === "magnet" ? "In-App" : "Download"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Torrent File / Release Name: Full name completely visible without ellipsis or background */}
                  <p className="text-xs text-white/75 font-mono break-words leading-relaxed select-all">
                    {s.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
