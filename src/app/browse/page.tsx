"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import MediaCard from "@/components/MediaCard";
import SkeletonCard from "@/components/SkeletonCard";

const CATEGORY_TABS = [
  { key: "popular", label: "Popular" },
  { key: "top_rated", label: "Top Rated" },
  { key: "upcoming", label: "Upcoming" },
  { key: "now_playing", label: "Now Playing" },
  { key: "on_the_air", label: "On Air" },
];

function BrowseInner() {
  const sp = useSearchParams();
  const type = sp.get("type") === "tv" ? "tv" : "movie";
  const category = sp.get("cat") ?? "popular";

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [type, category]);

  useEffect(() => {
    // upcoming/now_playing are movie-only; on_the_air is tv-only
    const cat = type === "tv" && (category === "upcoming" || category === "now_playing")
      ? "popular"
      : type === "movie" && category === "on_the_air"
        ? "upcoming"
        : category;

    setLoading(true);
    fetch(`/api/tmdb/${type}/${cat}?page=${page}`)
      .then((r) => r.json())
      .then((data) => {
        setItems((prev) =>
          page === 1 ? data.results ?? [] : [...prev, ...(data.results ?? [])]
        );
        setTotalPages(Math.min(data.total_pages ?? 1, 50));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, category, page]);

  const tabs = CATEGORY_TABS.filter((t) =>
    type === "movie" ? t.key !== "on_the_air" : t.key !== "upcoming" && t.key !== "now_playing"
  );

  return (
    <div className="min-h-screen px-4 pb-16 pt-28 md:px-10">
      <h1 className="text-xl font-bold md:text-2xl">
        {type === "tv" ? "TV Shows" : "Movies"}
      </h1>

      <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/browse?type=${type}&cat=${t.key}`}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              category === t.key
                ? "bg-white text-black"
                : "bg-white/10 text-muted hover:bg-white/20 hover:text-white"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3 md:gap-4">
        {loading && page === 1
          ? Array.from({ length: 18 }).map((_, i) => <SkeletonCard key={i} />)
          : items.map((r: any) => (
              <MediaCard
                key={`${r.media_type ?? type}-${r.id}`}
                item={{
                  id: r.id,
                  media_type: type,
                  title: r.title || r.name || "Untitled",
                  overview: r.overview ?? "",
                  poster_path: r.poster_path ?? null,
                  backdrop_path: r.backdrop_path ?? null,
                  vote_average: r.vote_average ?? 0,
                  year: (r.release_date || r.first_air_date || "").slice(0, 4) || null,
                }}
              />
            ))}
      </div>

      {page < totalPages && (
        <div className="mt-10 grid place-items-center">
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={loading}
            className="rounded border border-white/30 px-6 py-2 text-sm font-semibold transition hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <BrowseInner />
    </Suspense>
  );
}
