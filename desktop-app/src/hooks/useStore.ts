"use client";

import { useCallback, useEffect, useState } from "react";
import {
  STORE_EVENT,
  getWatchlist,
  inWatchlist,
  toggleWatchlist,
  getWatched,
  isWatched,
  toggleWatched,
  getProgress,
  type ProgressEntry,
  type WatchlistItem,
} from "@/lib/store";
import type { MediaItem } from "@/lib/types";

function useStoreValue<T>(read: () => T): T {
  const [value, setValue] = useState<T>(read);
  useEffect(() => {
    const sync = () => setValue(read());
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

export function useWatchlist() {
  const list = useStoreValue<WatchlistItem[]>(getWatchlist);
  const has = useCallback(
    (item: MediaItem) => inWatchlist(item.media_type, item.id),
    []
  );
  const toggle = useCallback((item: MediaItem) => toggleWatchlist(item), []);
  return { list, has, toggle };
}

export function useWatchedEpisodes(tvId: number) {
  const watched = useStoreValue(getWatched);
  const isEpisodeWatched = useCallback(
    (season: number, episode: number) => Boolean(watched[`${tvId}:${season}:${episode}`]),
    [watched, tvId]
  );
  const toggleEpisode = useCallback(
    (season: number, episode: number) => toggleWatched(tvId, season, episode),
    [tvId]
  );
  return { isEpisodeWatched, toggleEpisode, isWatched };
}

export function useProgressList(): ProgressEntry[] {
  return useStoreValue<ProgressEntry[]>(() =>
    Object.values(getProgress()).sort((a, b) => b.updatedAt - a.updatedAt)
  );
}
