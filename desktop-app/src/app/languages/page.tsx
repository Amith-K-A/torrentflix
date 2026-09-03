"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import MediaCard from "@/components/MediaCard";
import SkeletonCard from "@/components/SkeletonCard";
import { Loader2 } from "lucide-react";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ko", name: "Korean" },
  { code: "ja", name: "Japanese" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "th", name: "Thai" },
  { code: "hi", name: "Hindi" },
  { code: "zh", name: "Mandarin" },
  { code: "it", name: "Italian" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "ml", name: "Malayalam" },
  { code: "kn", name: "Kannada" },
];

const SORTS = [
  { key: "popularity.desc", name: "Suggestion for you" },
  { key: "primary_release_date.desc", name: "Year Released" },
  { key: "vote_average.desc", name: "Highest Rated" },
];

function deduplicate(existing: any[], incoming: any[]) {
  const seen = new Set(existing.map((item) => item.id));
  const fresh = incoming.filter((item) => !seen.has(item.id));
  return [...existing, ...fresh];
}

function LanguagesInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  
  const type = sp.get("type") === "tv" ? "tv" : "movie";
  const lang = sp.get("lang") ?? "en";
  const sort = sp.get("sort") ?? "primary_release_date.desc";

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const observerTarget = useRef<HTMLDivElement>(null);
  const prevParamsRef = useRef({ type, lang, sort });

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Reset state when params change
  useEffect(() => {
    if (
      prevParamsRef.current.type !== type ||
      prevParamsRef.current.lang !== lang ||
      prevParamsRef.current.sort !== sort
    ) {
      prevParamsRef.current = { type, lang, sort };
      setItems([]);
      setPage(1);
      setTotalPages(1);
    }
  }, [type, lang, sort]);

  // Fetch items
  useEffect(() => {
    if (
      prevParamsRef.current.type !== type ||
      prevParamsRef.current.lang !== lang ||
      prevParamsRef.current.sort !== sort
    ) {
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    // Determine extra params for robust sorting
    let extraParams = "";
    if (sort === "vote_average.desc") {
      extraParams = "&vote_count.gte=200"; // filter out weird niche things with 1 vote of 10
    } else if (sort === "primary_release_date.desc") {
      // Filter out absolute spam and unreleased future placeholders
      const today = new Date().toISOString().split("T")[0];
      extraParams = `&vote_count.gte=5&primary_release_date.lte=${today}`;
    }

    const apiUrl = `/api/tmdb/discover/${type}?with_original_language=${lang}&sort_by=${sort}&page=${page}${extraParams}`;

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
  }, [type, lang, sort, page]);

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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-bold md:text-2xl">Browse by Languages</h1>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted">Select Your Preference</label>
            <select
              value={lang}
              onChange={(e) => updateParam("lang", e.target.value)}
              className="rounded bg-white/10 px-3 py-1.5 text-sm text-white outline-none hover:bg-white/20 focus:bg-white/20"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-elevated text-white">
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="h-6 w-[1px] bg-white/20 hidden md:block" />

          <select
            value={type}
            onChange={(e) => updateParam("type", e.target.value)}
            className="rounded bg-white/10 px-3 py-1.5 text-sm text-white outline-none hover:bg-white/20 focus:bg-white/20"
          >
            <option value="movie" className="bg-elevated text-white">Movies</option>
            <option value="tv" className="bg-elevated text-white">TV Shows</option>
          </select>

          <select
            value={sort}
            onChange={(e) => updateParam("sort", e.target.value)}
            className="rounded bg-white/10 px-3 py-1.5 text-sm text-white outline-none hover:bg-white/20 focus:bg-white/20"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key} className="bg-elevated text-white">
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 md:gap-4">
        {loading && page === 1
          ? Array.from({ length: 18 }).map((_, i) => <SkeletonCard key={i} className="w-full" />)
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
                  year:
                    (r.release_date || r.first_air_date || "").slice(0, 4) ||
                    null,
                }}
                className="w-full"
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

      {!loading && items.length === 0 && (
        <div className="mt-20 text-center text-muted">
          <p className="text-lg font-semibold">No results found</p>
          <p className="mt-1 text-sm">Try adjusting your filters.</p>
        </div>
      )}
    </div>
  );
}

export default function LanguagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LanguagesInner />
    </Suspense>
  );
}
