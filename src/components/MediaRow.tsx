"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MediaCard from "./MediaCard";
import SkeletonCard from "./SkeletonCard";
import type { MediaItem } from "@/lib/types";

export default function MediaRow({
  title,
  items,
  loading,
  progressFor,
  moreHref,
}: {
  title: string;
  items: MediaItem[];
  loading?: boolean;
  progressFor?: (item: MediaItem) => number | undefined;
  moreHref?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: true });

  const updateArrows = () => {
    const el = scroller.current;
    if (!el) return;
    setCanScroll({
      left: el.scrollLeft > 8,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 8,
    });
  };

  const scrollBy = (dir: 1 | -1) => {
    scroller.current?.scrollBy({ left: dir * (scroller.current.clientWidth * 0.8), behavior: "smooth" });
  };

  if (!loading && items.length === 0) return null;

  return (
    <section className="group/row relative mt-8">
      <div className="mb-2 flex items-baseline gap-3 px-4 md:px-10">
        <h2 className="text-sm font-semibold text-muted md:text-base">{title}</h2>
        {moreHref && (
          <Link
            href={moreHref}
            className="translate-x-[-8px] text-xs font-semibold text-brand opacity-0 transition-all group-hover/row:translate-x-0 group-hover/row:opacity-100"
          >
            Explore all ›
          </Link>
        )}
      </div>
      <div className="relative">
        {canScroll.left && (
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Scroll left"
            className="absolute left-0 top-0 z-10 hidden h-full w-10 place-items-center bg-gradient-to-r from-black/80 to-transparent text-white opacity-0 transition-opacity group-hover/row:opacity-100 md:grid"
          >
            <ChevronLeft size={28} />
          </button>
        )}
        <div
          ref={scroller}
          onScroll={updateArrows}
          className="flex gap-2.5 overflow-x-auto scroll-smooth px-4 pb-1 no-scrollbar md:gap-3 md:px-10"
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : items.map((item: any) => (
                <MediaCard key={item.__key || `${item.media_type}-${item.id}`} item={item} progress={progressFor?.(item)} />
              ))}
        </div>
        {canScroll.right && (
          <button
            onClick={() => scrollBy(1)}
            aria-label="Scroll right"
            className="absolute right-0 top-0 z-10 hidden h-full w-10 place-items-center bg-gradient-to-l from-black/80 to-transparent text-white opacity-0 transition-opacity group-hover/row:opacity-100 md:grid"
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>
    </section>
  );
}
