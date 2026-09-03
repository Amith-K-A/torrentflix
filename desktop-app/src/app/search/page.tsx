"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SearchX, Loader2 } from "lucide-react";
import MediaCard from "@/components/MediaCard";
import SkeletonCard from "@/components/SkeletonCard";

function deduplicate(existing: any[], incoming: any[]) {
  const seen = new Set(existing.map((item) => `${item.media_type}-${item.id}`));
  const fresh = incoming.filter((item) => !seen.has(`${item.media_type}-${item.id}`));
  return [...existing, ...fresh];
}

function SearchInner() {
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const observerTarget = useRef<HTMLDivElement>(null);
  const prevQuery = useRef(q);

  // Reset when query changes
  useEffect(() => {
    if (prevQuery.current !== q) {
      prevQuery.current = q;
      setItems([]);
      setPage(1);
      setTotalPages(1);
    }
  }, [q]);

  useEffect(() => {
    if (!q) {
      setItems([]);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    if (prevQuery.current !== q) {
      return;
    }

    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    const controller = new AbortController();
    let isMounted = true;

    const t = setTimeout(() => {
      fetch(
        `/api/tmdb/search/multi?query=${encodeURIComponent(q)}&include_adult=false&page=${page}`,
        { signal: controller.signal }
      )
        .then((r) => r.json())
        .then((data) => {
          if (!isMounted) return;
          const filtered = (data.results ?? []).filter(
            (x: any) => {
              if (x.media_type !== "movie" && x.media_type !== "tv") return false;
              const title = (x.title || x.name || "").toLowerCase();
              return title.includes(q.toLowerCase());
            }
          );
          setItems((prev) => (page === 1 ? filtered : deduplicate(prev, filtered)));
          setTotalPages(Math.min(data.total_pages ?? 1, 50));
        })
        .catch((err) => {
          if (!isMounted || err.name === "AbortError") return;
          if (page === 1) setItems([]);
        })
        .finally(() => {
          if (isMounted) {
            setLoading(false);
            setLoadingMore(false);
          }
        });
    }, page === 1 ? 250 : 0);

    return () => {
      isMounted = false;
      clearTimeout(t);
      controller.abort();
    };
  }, [q, page]);

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

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 md:gap-4">
        {loading && page === 1
          ? Array.from({ length: 18 }).map((_, i) => <SkeletonCard key={i} className="w-full" />)
          : items.map((r: any) => (
              <MediaCard
                key={`${r.media_type}-${r.id}`}
                className="w-full"
                item={{
                  id: r.id,
                  media_type: r.media_type,
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

      {/* Skeletons while loading subsequent search pages */}
      {loadingMore && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={`search-more-${i}`} className="w-full" />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {page < totalPages && (
        <div
          ref={observerTarget}
          className="mt-8 flex h-16 w-full items-center justify-center"
        >
          {loadingMore && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
              <span>Loading more results…</span>
            </div>
          )}
        </div>
      )}

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
      fallback={
        <div className="min-h-screen px-4 pt-28 md:px-10">
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      }
    >
      <SearchInner />
    </Suspense>
  );
}
