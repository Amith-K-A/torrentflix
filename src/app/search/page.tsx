"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SearchX } from "lucide-react";
import MediaCard from "@/components/MediaCard";
import SkeletonCard from "@/components/SkeletonCard";

function SearchInner() {
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!q) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/tmdb/search/multi?query=${encodeURIComponent(q)}&include_adult=false`)
        .then((r) => r.json())
        .then((data) =>
          setItems(
            (data.results ?? []).filter(
              (x: any) => x.media_type === "movie" || x.media_type === "tv"
            )
          )
        )
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="min-h-screen px-4 pb-16 pt-28 md:px-10">
      <h1 className="text-lg font-bold md:text-xl">
        {q ? (
          <>
            Results for <span className="text-brand">“{q}”</span>
          </>
        ) : (
          "Search TorrentFlix"
        )}
      </h1>

      <div className="mt-6 flex flex-wrap gap-3 md:gap-4">
        {loading
          ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
          : items.map((r: any) => (
              <MediaCard
                key={`${r.media_type}-${r.id}`}
                item={{
                  id: r.id,
                  media_type: r.media_type,
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

      {!loading && q && items.length === 0 && (
        <div className="mt-24 grid place-items-center gap-3 text-center">
          <SearchX size={44} className="text-muted" />
          <p className="text-lg font-semibold">No titles found for “{q}”</p>
          <p className="text-sm text-muted">Try a different spelling or a shorter query.</p>
        </div>
      )}
      {!q && !loading && (
        <p className="mt-24 text-center text-sm text-muted">
          Use the search icon in the top bar (or press <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">/</kbd>) to find movies and shows.
        </p>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen px-4 pt-28 md:px-10"><div className="flex flex-wrap gap-3">{Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}</div></div>}
    >
      <SearchInner />
    </Suspense>
  );
}
