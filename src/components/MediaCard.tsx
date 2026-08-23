"use client";

import Link from "next/link";
import Image from "next/image";
import { Play, Star } from "lucide-react";
import { cn, tmdbImg } from "@/lib/utils";
import type { MediaItem } from "@/lib/types";
import { useWatchlist } from "@/hooks/useStore";

export default function MediaCard({ item, progress }: { item: MediaItem; progress?: number }) {
  const poster = tmdbImg(item.poster_path, "w300");
  const href = `/watch/${item.id}?type=${item.media_type}`;
  const { has, toggle } = useWatchlist();

  return (
    <div className="group relative w-[130px] shrink-0 transition-transform duration-300 hover:z-10 hover:scale-105 md:w-[170px]">
      <Link href={href} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded bg-elevated">
          {poster ? (
            <Image
              src={poster}
              alt={item.title}
              fill
              sizes="170px"
              className="object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center p-2 text-center text-xs text-muted">
              {item.title}
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/30" />
          <div className="absolute inset-0 hidden place-items-center group-hover:grid">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-black">
              <Play size={18} fill="currentColor" />
            </span>
          </div>
        </div>
      </Link>

      {progress !== undefined && progress > 0 && (
        <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded bg-white/20">
          <div className="h-full bg-brand" style={{ width: `${Math.min(progress * 100, 100)}%` }} />
        </div>
      )}

      <div className="mt-1.5 flex items-start justify-between gap-1">
        <p className="line-clamp-1 text-xs font-medium text-muted" title={item.title}>
          {item.title}
        </p>
        <button
          onClick={(e) => {
            e.preventDefault();
            toggle(item);
          }}
          aria-label={has(item) ? "Remove from My List" : "Add to My List"}
          className={cn(
            "shrink-0 text-xs transition-colors",
            has(item) ? "text-brand" : "text-muted hover:text-white"
          )}
        >
          {has(item) ? "✓" : "+"}
        </button>
      </div>
      {item.vote_average > 0 && (
        <p className="flex items-center gap-1 text-[10px] text-muted">
          <Star size={9} className="fill-yellow-400 text-yellow-400" />
          {item.vote_average.toFixed(1)}
          {item.year ? ` · ${item.year}` : ""}
          <span className="uppercase"> · {item.media_type === "tv" ? "TV" : "Movie"}</span>
        </p>
      )}
    </div>
  );
}
