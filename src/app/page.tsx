"use client";

import { useEffect, useState } from "react";
import MediaRow from "@/components/MediaRow";
import HeroSection from "@/components/HeroSection";
import SetupNotice from "@/components/SetupNotice";
import { useProgressList } from "@/hooks/useStore";
import type { MediaItem } from "@/lib/types";

function normalize(r: any, type?: "movie" | "tv"): MediaItem {
  return {
    id: r.id,
    media_type: r.media_type ?? type ?? "movie",
    title: r.title || r.name || "Untitled",
    overview: r.overview ?? "",
    poster_path: r.poster_path ?? null,
    backdrop_path: r.backdrop_path ?? null,
    vote_average: r.vote_average ?? 0,
    year: (r.release_date || r.first_air_date || "").slice(0, 4) || null,
  };
}

function Row({
  path,
  title,
  type,
  moreHref,
}: {
  path: string;
  title: string;
  type?: "movie" | "tv";
  moreHref?: string;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tmdb${path}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setItems((data.results ?? []).map((r: any) => normalize(r, type)));
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path, type]);

  return (
    <MediaRow
      title={title}
      items={items}
      loading={loading}
      moreHref={moreHref}
    />
  );
}

interface ContinueItem extends MediaItem {
  __progress: number;
  __key: string;
}

export default function HomePage() {
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [mounted, setMounted] = useState(false);
  const progressList = useProgressList();

  useEffect(() => {
    setMounted(true);
    fetch("/api/tmdb/trending/all/week")
      .then(async (r) => {
        if (r.status === 503) {
          setNeedsSetup(true);
          return [];
        }
        const data = await r.json();
        return (data.results ?? [])
          .filter((x: any) => x.media_type === "movie" || x.media_type === "tv")
          .map((r: any) => normalize(r));
      })
      .then(setTrending)
      .catch(() => {})
      .finally(() => setTrendingLoading(false));
  }, []);

  if (needsSetup) {
    return (
      <div className="grid min-h-screen place-items-center px-4 pt-20">
        <SetupNotice />
      </div>
    );
  }

  const continueWatching: ContinueItem[] = progressList
    .filter((p) => p.position > 15 && p.position / (p.duration || 1) < 0.95)
    .slice(0, 12)
    .map((p) => ({
      id: p.tmdbId,
      media_type: p.type,
      title: p.episodeName
        ? `${p.title} · S${p.season}E${p.episode}`
        : p.title,
      overview: "",
      poster_path: p.poster_path,
      backdrop_path: p.backdrop_path,
      vote_average: 0,
      year: null,
      __progress: p.position / (p.duration || 1),
      __key: p.key,
    }));

  return (
    <div className="pb-16">
      {trendingLoading ? (
        <div className="h-[72vh] min-h-[480px] w-full animate-pulse bg-elevated" />
      ) : (
        <HeroSection items={trending} />
      )}

      <div className="relative z-10 -mt-6">
        {mounted && continueWatching.length > 0 && (
          <MediaRow
            title="Continue Watching"
            items={continueWatching}
            progressFor={(item) => (item as ContinueItem).__progress}
          />
        )}
        <Row 
          path="/trending/all/day" 
          title="Trending Now" 
          moreHref="/browse?type=movie&cat=popular"
        />
        <Row
          path="/movie/now_playing"
          title="Latest Movies"
          type="movie"
          moreHref="/browse?type=movie&cat=now_playing"
        />
        <Row
          path="/movie/popular"
          title="Popular Movies"
          type="movie"
          moreHref="/browse?type=movie&cat=popular"
        />
        <Row
          path="/tv/popular"
          title="Popular TV Shows"
          type="tv"
          moreHref="/browse?type=tv&cat=popular"
        />
        <Row
          path="/movie/top_rated"
          title="Top Rated Movies"
          type="movie"
          moreHref="/browse?type=movie&cat=top_rated"
        />
        <Row
          path="/tv/top_rated"
          title="Top Rated TV Shows"
          type="tv"
          moreHref="/browse?type=tv&cat=top_rated"
        />
        <Row
          path="/movie/upcoming"
          title="Coming Soon"
          type="movie"
          moreHref="/browse?type=movie&cat=upcoming"
        />
        <Row
          path="/discover/tv?with_original_language=ko&sort_by=popularity.desc"
          title="Popular K-Dramas"
          type="tv"
          moreHref="/browse?type=tv&cat=ko"
        />
        <Row
          path="/discover/tv?with_original_language=th&sort_by=popularity.desc"
          title="Popular Thai Dramas"
          type="tv"
          moreHref="/browse?type=tv&cat=th"
        />
      </div>
    </div>
  );
}
