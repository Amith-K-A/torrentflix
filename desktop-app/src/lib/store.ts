"use client";

/**
 * localStorage-backed stores: watchlist, watched episodes, playback progress.
 * All reads/writes go through helpers that broadcast a custom event so every
 * mounted component stays in sync.
 */

import type { MediaItem, MediaType } from "./types";

const WATCHLIST_KEY = "tf:watchlist";
const WATCHED_KEY = "tf:watched";
const PROGRESS_KEY = "tf:progress";

export const STORE_EVENT = "tf:store-changed";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(STORE_EVENT));
}

/* ---------------- watchlist ---------------- */

export interface WatchlistItem extends MediaItem {
  addedAt: number;
}

export function getWatchlist(): WatchlistItem[] {
  return read<WatchlistItem[]>(WATCHLIST_KEY, []).sort(
    (a, b) => b.addedAt - a.addedAt
  );
}

export function inWatchlist(type: MediaType, id: number): boolean {
  return getWatchlist().some((i) => i.media_type === type && i.id === id);
}

export function toggleWatchlist(item: MediaItem): boolean {
  const list = getWatchlist();
  const idx = list.findIndex((i) => i.media_type === item.media_type && i.id === item.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    write(WATCHLIST_KEY, list);
    return false;
  }
  list.unshift({ ...item, addedAt: Date.now() });
  write(WATCHLIST_KEY, list);
  return true;
}

/* ---------------- watched episodes ---------------- */

export type WatchedMap = Record<string, true>;

export function episodeKey(tvId: number, season: number, episode: number) {
  return `${tvId}:${season}:${episode}`;
}

export function getWatched(): WatchedMap {
  return read<WatchedMap>(WATCHED_KEY, {});
}

export function isWatched(tvId: number, season: number, episode: number): boolean {
  return Boolean(getWatched()[episodeKey(tvId, season, episode)]);
}

export function toggleWatched(tvId: number, season: number, episode: number): boolean {
  const map = getWatched();
  const key = episodeKey(tvId, season, episode);
  if (map[key]) {
    delete map[key];
    write(WATCHED_KEY, map);
    return false;
  }
  map[key] = true;
  write(WATCHED_KEY, map);
  return true;
}

/* ---------------- playback progress ---------------- */

export interface ProgressEntry {
  key: string;
  type: MediaType;
  tmdbId: number;
  season?: number;
  episode?: number;
  episodeName?: string;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  position: number; // seconds
  duration: number; // seconds
  infoHash?: string;
  quality?: string;
  updatedAt: number;
}

export function progressKey(t: {
  type: MediaType;
  tmdbId: number;
  season?: number;
  episode?: number;
}) {
  return `${t.type}:${t.tmdbId}:${t.season ?? 0}:${t.episode ?? 0}`;
}

export function getProgress(): Record<string, ProgressEntry> {
  return read<Record<string, ProgressEntry>>(PROGRESS_KEY, {});
}

export function saveProgress(entry: ProgressEntry) {
  const map = getProgress();
  map[entry.key] = entry;
  // keep the 40 most recent entries
  const trimmed = Object.values(map)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 40);
  write(
    PROGRESS_KEY,
    Object.fromEntries(trimmed.map((e) => [e.key, e]))
  );
}

export function clearProgress(key: string) {
  const map = getProgress();
  delete map[key];
  write(PROGRESS_KEY, map);
}
