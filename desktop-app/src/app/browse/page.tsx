"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import MediaCard from "@/components/MediaCard";
import SkeletonCard from "@/components/SkeletonCard";
import { Loader2, SlidersHorizontal, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const MOVIE_GENRES = [
  { id: "", name: "All Genres" },
  { id: "28", name: "Action" },
  { id: "12", name: "Adventure" },
  { id: "16", name: "Animation" },
  { id: "35", name: "Comedy" },
  { id: "80", name: "Crime" },
  { id: "99", name: "Documentary" },
  { id: "18", name: "Drama" },
  { id: "10751", name: "Family" },
  { id: "14", name: "Fantasy" },
  { id: "36", name: "History" },
  { id: "27", name: "Horror" },
  { id: "10402", name: "Music" },
  { id: "9648", name: "Mystery" },
  { id: "10749", name: "Romance" },
  { id: "878", name: "Science Fiction" },
  { id: "53", name: "Thriller" },
  { id: "10752", name: "War" },
  { id: "37", name: "Western" },
];

const TV_GENRES = [
  { id: "", name: "All Genres" },
  { id: "10759", name: "Action & Adventure" },
  { id: "16", name: "Animation" },
  { id: "35", name: "Comedy" },
  { id: "80", name: "Crime" },
  { id: "99", name: "Documentary" },
  { id: "18", name: "Drama" },
  { id: "10751", name: "Family" },
  { id: "10762", name: "Kids" },
  { id: "9648", name: "Mystery" },
  { id: "10763", name: "News" },
  { id: "10764", name: "Reality" },
  { id: "10765", name: "Sci-Fi & Fantasy" },
  { id: "10766", name: "Soap" },
  { id: "10767", name: "Talk" },
  { id: "10768", name: "War & Politics" },
  { id: "37", name: "Western" },
];

const SORT_OPTIONS = [
  { key: "popularity.desc", label: "Most Popular" },
  { key: "vote_average.desc", label: "Highest Rated" },
  { key: "primary_release_date.desc", label: "Newest Releases" },
  { key: "primary_release_date.asc", label: "Oldest Classics" },
  { key: "title.asc", label: "Title (A to Z)" },
];

const YEAR_OPTIONS = [
  { key: "", label: "All Years" },
  { key: "2026", label: "2026" },
  { key: "2025", label: "2025" },
  { key: "2024", label: "2024" },
  { key: "2023", label: "2023" },
  { key: "2022", label: "2022" },
  { key: "2021", label: "2021" },
  { key: "2020", label: "2020" },
  { key: "2010s", label: "2010s" },
  { key: "2000s", label: "2000s" },
  { key: "1990s", label: "1990s" },
  { key: "classic", label: "Classics (Pre-1990)" },
];

const LANGUAGE_OPTIONS = [
  { code: "", name: "All Languages" },
  { code: "en", name: "English" },
  { code: "ko", name: "Korean" },
  { code: "ja", name: "Japanese" },
  { code: "hi", name: "Hindi" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "th", name: "Thai" },
  { code: "it", name: "Italian" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "ml", name: "Malayalam" },
  { code: "kn", name: "Kannada" },
];

const RATING_OPTIONS = [
  { key: "", label: "All Ratings" },
  { key: "8", label: "8.0+ ⭐ Masterpiece" },
  { key: "7", label: "7.0+ ⭐ Great" },
  { key: "6", label: "6.0+ ⭐ Good" },
];

const CATEGORY_TABS = [
  { key: "popular", label: "Popular" },
  { key: "top_rated", label: "Top Rated" },
  { key: "upcoming", label: "Upcoming" },
  { key: "now_playing", label: "Now Playing" },
  { key: "on_the_air", label: "On Air" },
];

function deduplicate(existing: any[], incoming: any[]) {
  const seen = new Set(existing.map((item) => item.id));
  const fresh = incoming.filter((item) => !seen.has(item.id));
  return [...existing, ...fresh];
}

function BrowseInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const type = sp.get("type") === "tv" ? "tv" : "movie";
  const category = sp.get("cat") ?? "popular";
  const genre = sp.get("genre") ?? "";
  const sort = sp.get("sort") ?? "";
  const year = sp.get("year") ?? "";
  const lang = sp.get("lang") ?? "";
  const rating = sp.get("rating") ?? "";

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const observerTarget = useRef<HTMLDivElement>(null);
  const prevParamsRef = useRef({ type, category, genre, sort, year, lang, rating });

  const activeFiltersCount = [
    genre ? 1 : 0,
    sort && sort !== "popularity.desc" ? 1 : 0,
    year ? 1 : 0,
    lang ? 1 : 0,
    rating ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const updateParam = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(sp.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === "") {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const clearFilters = () => {
    const params = new URLSearchParams();
    params.set("type", type);
    params.set("cat", "popular");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Reset state when any filter parameter changes
  useEffect(() => {
    const current = { type, category, genre, sort, year, lang, rating };
    if (JSON.stringify(prevParamsRef.current) !== JSON.stringify(current)) {
      prevParamsRef.current = current;
      setItems([]);
      setPage(1);
      setTotalPages(1);
    }
  }, [type, category, genre, sort, year, lang, rating]);

  // Fetch items for current filter configuration and page
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    const isCustomFilterActive = Boolean(genre || sort || year || lang || rating);

    let apiUrl = "";
    if (isCustomFilterActive) {
      const q = new URLSearchParams();
      q.set("page", String(page));

      // Resolve sort
      let effectiveSort = sort || "popularity.desc";
      if (type === "tv") {
        if (effectiveSort === "primary_release_date.desc") effectiveSort = "first_air_date.desc";
        if (effectiveSort === "primary_release_date.asc") effectiveSort = "first_air_date.asc";
        if (effectiveSort === "title.asc") effectiveSort = "name.asc";
      }
      q.set("sort_by", effectiveSort);

      if (genre) q.set("with_genres", genre);
      if (lang) q.set("with_original_language", lang);
      if (rating) q.set("vote_average.gte", rating);

      // If sorting by rating or minimum rating is set, enforce vote threshold to filter out spam
      if (effectiveSort.startsWith("vote_average") || rating) {
        q.set("vote_count.gte", type === "movie" ? "80" : "30");
      }

      // Year / Decade handling
      if (year) {
        if (/^\d{4}$/.test(year)) {
          if (type === "movie") q.set("primary_release_year", year);
          else q.set("first_air_date_year", year);
        } else if (year === "2010s") {
          const dateField = type === "movie" ? "primary_release_date" : "first_air_date";
          q.set(`${dateField}.gte`, "2010-01-01");
          q.set(`${dateField}.lte`, "2019-12-31");
        } else if (year === "2000s") {
          const dateField = type === "movie" ? "primary_release_date" : "first_air_date";
          q.set(`${dateField}.gte`, "2000-01-01");
          q.set(`${dateField}.lte`, "2009-12-31");
        } else if (year === "1990s") {
          const dateField = type === "movie" ? "primary_release_date" : "first_air_date";
          q.set(`${dateField}.gte`, "1990-01-01");
          q.set(`${dateField}.lte`, "1999-12-31");
        } else if (year === "classic") {
          const dateField = type === "movie" ? "primary_release_date" : "first_air_date";
          q.set(`${dateField}.lte`, "1989-12-31");
        }
      }

      apiUrl = `/api/tmdb/discover/${type}?${q.toString()}`;
    } else {
      // Normal category endpoint
      const cat =
        type === "tv" && (category === "upcoming" || category === "now_playing")
          ? "popular"
          : type === "movie" && category === "on_the_air"
            ? "upcoming"
            : category;

      apiUrl = `/api/tmdb/${type}/${cat}?page=${page}`;
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
  }, [type, category, genre, sort, year, lang, rating, page]);

  // Load next page callback
  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && page < totalPages) {
      setPage((prev) => prev + 1);
    }
  }, [loading, loadingMore, page, totalPages]);

  // Infinite scroll
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

  const genres = type === "movie" ? MOVIE_GENRES : TV_GENRES;

  return (
    <div className="min-h-screen px-4 pb-16 pt-24 md:px-10">
      {/* Title & Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">
              {type === "tv" ? "TV Shows" : "Movies"}
            </h1>
            {activeFiltersCount > 0 && (
              <span className="rounded-full bg-brand/20 px-2.5 py-0.5 text-xs font-bold text-brand border border-brand/30">
                {activeFiltersCount} filter{activeFiltersCount > 1 ? "s" : ""} active
              </span>
            )}
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Clear filters</span>
            </button>
          )}
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                updateParam({ cat: t.key });
              }}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer",
                category === t.key && activeFiltersCount === 0
                  ? "bg-white text-black shadow-md"
                  : "bg-white/10 text-muted hover:bg-white/15 hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filter Controls Toolbar */}
        <div className="mt-2 flex flex-wrap items-center gap-2.5 rounded-xl border border-white/10 bg-surface-dim/60 p-3 backdrop-blur-md">
          <div className="flex items-center gap-1.5 pr-1 text-xs font-bold uppercase tracking-wider text-muted/80">
            <SlidersHorizontal size={14} className="text-brand" />
            <span className="hidden sm:inline">Filter By</span>
          </div>

          {/* Genre Filter */}
          <select
            value={genre}
            onChange={(e) => updateParam({ genre: e.target.value })}
            className="h-9 rounded-lg border border-white/10 bg-elevated px-3 text-xs font-medium text-white transition hover:border-white/20 focus:border-brand focus:outline-none cursor-pointer"
          >
            {genres.map((g) => (
              <option key={g.id} value={g.id} className="bg-surface text-white">
                {g.name}
              </option>
            ))}
          </select>

          {/* Sort Filter */}
          <select
            value={sort || "popularity.desc"}
            onChange={(e) => updateParam({ sort: e.target.value })}
            className="h-9 rounded-lg border border-white/10 bg-elevated px-3 text-xs font-medium text-white transition hover:border-white/20 focus:border-brand focus:outline-none cursor-pointer"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.key} value={s.key} className="bg-surface text-white">
                Sort: {s.label}
              </option>
            ))}
          </select>

          {/* Release Year Filter */}
          <select
            value={year}
            onChange={(e) => updateParam({ year: e.target.value })}
            className="h-9 rounded-lg border border-white/10 bg-elevated px-3 text-xs font-medium text-white transition hover:border-white/20 focus:border-brand focus:outline-none cursor-pointer"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y.key} value={y.key} className="bg-surface text-white">
                {y.label}
              </option>
            ))}
          </select>

          {/* Audio Language Filter */}
          <select
            value={lang}
            onChange={(e) => updateParam({ lang: e.target.value })}
            className="h-9 rounded-lg border border-white/10 bg-elevated px-3 text-xs font-medium text-white transition hover:border-white/20 focus:border-brand focus:outline-none cursor-pointer"
          >
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.code} value={l.code} className="bg-surface text-white">
                {l.name}
              </option>
            ))}
          </select>

          {/* Minimum Rating Filter */}
          <select
            value={rating}
            onChange={(e) => updateParam({ rating: e.target.value })}
            className="h-9 rounded-lg border border-white/10 bg-elevated px-3 text-xs font-medium text-white transition hover:border-white/20 focus:border-brand focus:outline-none cursor-pointer"
          >
            {RATING_OPTIONS.map((r) => (
              <option key={r.key} value={r.key} className="bg-surface text-white">
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Media Grid */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 md:gap-4">
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

      {/* End of list or empty state */}
      {!loading && !loadingMore && items.length === 0 && (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <p className="text-base font-semibold text-white">No titles match your selected filters</p>
          <p className="mt-1 text-xs text-muted">Try changing the genre, year, or rating filters</p>
          <button
            onClick={clearFilters}
            className="mt-4 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand/90 cursor-pointer"
          >
            Reset all filters
          </button>
        </div>
      )}

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
