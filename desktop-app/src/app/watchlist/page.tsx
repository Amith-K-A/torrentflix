"use client";

import Link from "next/link";
import { BookmarkPlus } from "lucide-react";
import MediaCard from "@/components/MediaCard";
import { useProgressList, useWatchlist } from "@/hooks/useStore";

export default function WatchlistPage() {
  const { list } = useWatchlist();
  const progressList = useProgressList();

  const progressByItem = new Map(
    progressList.map((p) => [`${p.type}:${p.tmdbId}`, p.position / (p.duration || 1)])
  );

  return (
    <div className="min-h-screen px-4 pb-16 pt-28 md:px-10">
      <h1 className="text-xl font-bold md:text-2xl">My List</h1>

      {list.length === 0 ? (
        <div className="mt-24 grid place-items-center gap-4 text-center">
          <BookmarkPlus size={44} className="text-muted" />
          <p className="text-lg font-semibold">Your list is empty</p>
          <p className="max-w-sm text-sm text-muted">
            Add movies and shows with the <span className="font-bold text-white">+</span> button
            on any poster to keep them here.
          </p>
          <Link
            href="/"
            className="rounded bg-brand px-5 py-2 text-sm font-bold transition hover:bg-brand-dark"
          >
            Browse titles
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3 md:gap-4">
          {list.map((item) => (
            <MediaCard
              key={`${item.media_type}-${item.id}`}
              item={item}
              progress={progressByItem.get(`${item.media_type}:${item.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
