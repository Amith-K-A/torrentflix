"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Info, Play, Star } from "lucide-react";
import { tmdbImg } from "@/lib/utils";
import type { MediaItem } from "@/lib/types";

export default function HeroSection({ items }: { items: MediaItem[] }) {
  const [index, setIndex] = useState<number | null>(null);

  // pick a random item client-side to avoid hydration mismatch
  useEffect(() => {
    setIndex(Math.floor(Math.random() * Math.min(items.length, 5)));
  }, [items.length]);

  if (items.length === 0) return null;
  const item = items[index ?? 0];
  const backdrop = tmdbImg(item.backdrop_path ?? item.poster_path, "w1280");

  return (
    <section className="relative h-[72vh] min-h-[480px] w-full">
      {backdrop && (
        <Image
          src={backdrop}
          alt={item.title}
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-surface to-transparent" />

      <div className="absolute bottom-[15%] left-4 max-w-xl md:left-10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          #{(index ?? 0) + 1} Trending {item.media_type === "tv" ? "TV Show" : "Movie"} Today
        </p>
        <h1 className="text-3xl font-black leading-tight drop-shadow-lg md:text-5xl">
          {item.title}
        </h1>
        <div className="mt-3 flex items-center gap-3 text-sm">
          {item.vote_average > 0 && (
            <span className="flex items-center gap-1 font-semibold">
              <Star size={14} className="fill-yellow-400 text-yellow-400" />
              {item.vote_average.toFixed(1)}
            </span>
          )}
          {item.year && <span className="text-muted">{item.year}</span>}
          <span className="border border-white/40 px-1.5 text-xs text-muted">P2P</span>
        </div>
        <p className="mt-3 line-clamp-3 max-w-lg text-sm text-white/85 drop-shadow md:text-base">
          {item.overview}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <Link
            href={`/watch/${item.id}?type=${item.media_type}`}
            className="flex items-center gap-2 rounded bg-white px-6 py-2.5 text-sm font-bold text-black transition hover:bg-white/80"
          >
            <Play size={18} fill="currentColor" /> Play
          </Link>
          <Link
            href={`/watch/${item.id}?type=${item.media_type}`}
            className="flex items-center gap-2 rounded bg-white/25 px-6 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/15"
          >
            <Info size={18} /> More Info
          </Link>
        </div>
      </div>
    </section>
  );
}
