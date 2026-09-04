import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DecoderSelection, MediaItem } from "./types";

const WATCHLIST_KEY = "@torrentflix_tv_watchlist";
const PROGRESS_KEY = "@torrentflix_tv_progress";
const DECODER_KEY = "@torrentflix_tv_decoder";

export async function getWatchlist(): Promise<MediaItem[]> {
  try {
    const raw = await AsyncStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function toggleWatchlist(item: MediaItem): Promise<boolean> {
  try {
    const current = await getWatchlist();
    const exists = current.some((x) => x.id === item.id);
    let updated: MediaItem[];
    if (exists) {
      updated = current.filter((x) => x.id !== item.id);
    } else {
      updated = [item, ...current];
    }
    await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
    return !exists;
  } catch {
    return false;
  }
}

export async function saveProgress(tmdbId: number, position: number, duration: number, title: string) {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[tmdbId] = { position, duration, title, updatedAt: Date.now() };
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {}
}

export async function getProgress(tmdbId: number): Promise<{ position: number; duration: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[tmdbId] || null;
  } catch {
    return null;
  }
}

export async function getSavedDecoderPref(): Promise<DecoderSelection> {
  try {
    const raw = await AsyncStorage.getItem(DECODER_KEY);
    return (raw as DecoderSelection) || "auto";
  } catch {
    return "auto";
  }
}

export async function saveDecoderPref(pref: DecoderSelection): Promise<void> {
  try {
    await AsyncStorage.setItem(DECODER_KEY, pref);
  } catch {}
}
