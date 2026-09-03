"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import MediaCard from "@/components/MediaCard";
import SkeletonCard from "@/components/SkeletonCard";
import { Loader2 } from "lucide-react";

const CATEGORY_TABS = [
  { key: "popular", label: "Popular" },
  { key: "top_rated", label: "Top Rated" },
  { key: "upcoming", label: "Upcoming" },
  { key: "now_playing", label: "Now Playing" },
  { key: "on_the_air", label: "On Air" },
  { key: "ko", label: "K-Dramas" },
  { key: "th", label: "Thai Dramas" },
];

function deduplicate(existing: any[], incoming: any[]) {
  const seen = new Set(existing.map((item) => item.id));
  const fresh = incoming.filter((item) => !seen.has(item.id));
  return [...existing, ...fresh];
}

function BrowseInner() {
  const sp = useSearchParams();
  const type = sp.get("type") === "tv" ? "tv" : "movie";
  const category = sp.get("cat") ?? "popular";

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const observerTarget = useRef<HTMLDivElement>(null);
  const prevParamsRef = useRef({ type, category });

  // Reset state when category or type changes
  useEffect(() => {
    if (
      prevParamsRef.current.type !== type ||
      prevParamsRef.current.category !== category
    ) {
      prevParamsRef.current = { type, category };
      setItems([]);
      setPage(1);
      setTotalPages(1);
    }
  }, [type, category]);

  // Fetch items for current type, category, and page
  useEffect(() => {
    // Prevent fetching if params changed but page hasn't reset to 1 yet
    if (
      prevParamsRef.current.type !== type ||
      prevParamsRef.current.category !== category
    ) {
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    // upcoming/now_playing are movie-only; on_the_air is tv-only
    const cat =
      type === "tv" && (category === "upcoming" || category === "now_playing")
        ? "popular"
        : type === "movie" && category === "on_the_air"
          ? "upcoming"
          : category;

    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    let apiUrl = `/api/tmdb/${type}/${cat}?page=${page}`;
    if (category === "ko") {
      apiUrl = `/api/tmdb/discover/${type}?with_original_language=ko&sort_by=popularity.desc&page=${page}`;
    } else if (category === "th") {
      apiUrl = `/api/tmdb/discover/${type}?with_original_language=th&sort_by=popularity.desc&page=${page}`;
    }

    fetch(apiUrl, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted) return;
        const results = data.results ?? [];
        setItems((prev) => (page === 1 ? results : deduplicate(prev, results)));
        setTotalPages(Math.min(data.total_pages ?? 1, 50));
      })
      .catch((err) => {
        if (!isMounted || err.name === "AbortError") return;
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
          setLoadingMore(false);
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [type, category, page]);

  // Load next page callback
  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && page < totalPages) {
      setPage((prev) => prev + 1);
    }
  }, [loading, loadingMore, page, totalPages]);

  // IntersectionObserver for infinite scrolling
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: "300px",
        threshold: 0.1,
      }
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [loadMore]);

  const tabs = CATEGORY_TABS.filter((t) =>
    type === "movie"
      ? t.key !== "on_the_air"
      : t.key !== "upcoming" && t.key !== "now_playing"
  );

  return (
    <div className="min-h-screen px-4 pb-16 pt-28 md:px-10">
      <h1 className="text-xl font-bold md:text-2xl">
        {type === "tv" ? "TV Shows" : "Movies"}
      </h1>

      <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/browse?type=${type}&cat=${t.key}`}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              category === t.key
                ? "bg-white text-black"
                : "bg-white/10 text-muted hover:bg-white/20 hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 md:gap-4">
        {loading && page === 1
          ? Array.from({ length: 18 }).map((_, i) => <SkeletonCard key={i} className="w-full" />)
          : items.map((r: any) => (
              <MediaCard
                key={`${r.media_type ?? type}-${r.id}`}
                className="w-full"
                item={{
                  id: r.id,
                  media_type: type,
                  title: r.title || r.name || "Untitled",
                  overview: r.overview ?? "",
                  poster_path: r.poster_path ?? null,
                  backdrop_path: r.backdrop_path ?? null,
                  vote_average: r.vote_average ?? 0,
                  year:
                    (r.release_date || r.first_air_date || "").slice(0, 4) ||
                    null,
                }}
              />
            ))}
      </div>

      {/* Skeletons while loading subsequent pages */}
      {loadingMore && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={`more-${i}`} className="w-full" />
          ))}
        </div>
      )}

      {/* Infinite scroll trigger sentinel */}
      {page < totalPages && (
        <div
          ref={observerTarget}
          className="mt-8 flex h-16 w-full items-center justify-center"
        >
          {loadingMore && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
              <span>Loading more titles…</span>
            </div>
          )}
        </div>
      )}

      {/* End of list message */}
      {!loading && !loadingMore && page >= totalPages && items.length > 0 && (
        <p className="mt-12 text-center text-xs text-muted">
          You have reached the end of the collection.
        </p>
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
