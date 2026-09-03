import axios from "axios";
import type { EpisodeItem, MediaItem, MediaType } from "./types";

export function tmdbConfigured(): boolean {
  return Boolean(process.env.TMDB_API_KEY || process.env.TMDB_ACCESS_TOKEN);
}

export async function tmdb<T = any>(
  path: string,
  params: Record<string, string | number | boolean> = {}
): Promise<T> {
  if (!tmdbConfigured()) {
    throw new Error(
      "TMDB API key not configured. Add TMDB_API_KEY to .env.local (free at themoviedb.org)."
    );
  }
  const useToken = Boolean(process.env.TMDB_ACCESS_TOKEN);

  // TMDB occasionally 5xx's under burst load from the home page rows — retry.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await axios.get<T>(`https://api.themoviedb.org/3${path}`, {
        params: {
          ...params,
          ...(useToken ? {} : { api_key: process.env.TMDB_API_KEY }),
        },
        headers: useToken
          ? { Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}` }
          : undefined,
        timeout: 8000,
      });
      return res.data;
    } catch (e) {
      lastError = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

interface RawMedia {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
}

export function normalizeMedia(raw: RawMedia, fallbackType?: MediaType): MediaItem {
  const type = (raw.media_type as MediaType) || fallbackType || "movie";
  return {
    id: raw.id,
    media_type: type,
    title: raw.title || raw.name || "Untitled",
    overview: raw.overview ?? "",
    poster_path: raw.poster_path ?? null,
    backdrop_path: raw.backdrop_path ?? null,
    vote_average: raw.vote_average ?? 0,
    year: (raw.release_date || raw.first_air_date || "").slice(0, 4) || null,
  };
}

export async function getTrending(window: "day" | "week" = "week"): Promise<MediaItem[]> {
  const data = await tmdb<any>(`/trending/all/${window}`);
  return (data.results as RawMedia[])
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .map((r) => normalizeMedia(r));
}

export async function getList(path: string, type: MediaType): Promise<MediaItem[]> {
  const data = await tmdb<any>(path);
  return (data.results as RawMedia[]).map((r) => normalizeMedia(r, type));
}

export async function searchMulti(query: string): Promise<MediaItem[]> {
  const data = await tmdb<any>("/search/multi", { query, include_adult: false });
  return (data.results as RawMedia[])
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .map((r) => normalizeMedia(r));
}

export interface MediaDetails {
  id: number;
  type: MediaType;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  year: string | null;
  genres: { id: number; name: string }[];
  runtime: number | null;
  episode_run_time: number[];
  number_of_seasons: number;
  seasons: { season_number: number; name: string; episode_count: number; air_date: string | null; poster_path: string | null }[];
  imdb_id: string | null;
  tagline: string | null;
  status: string;
}

export async function getDetails(type: MediaType, id: string | number): Promise<MediaDetails> {
  const [details, ext] = await Promise.all([
    tmdb<any>(`/${type}/${id}`),
    tmdb<any>(`/${type}/${id}/external_ids`).catch(() => ({ imdb_id: null })),
  ]);
  return {
    id: details.id,
    type,
    title: details.title || details.name || "Untitled",
    overview: details.overview ?? "",
    poster_path: details.poster_path ?? null,
    backdrop_path: details.backdrop_path ?? null,
    vote_average: details.vote_average ?? 0,
    year: (details.release_date || details.first_air_date || "").slice(0, 4) || null,
    genres: details.genres ?? [],
    runtime: details.runtime ?? null,
    episode_run_time: details.episode_run_time ?? [],
    number_of_seasons: details.number_of_seasons ?? 1,
    seasons: (details.seasons ?? [])
      .filter((s: any) => s.season_number > 0 && s.episode_count > 0)
      .map((s: any) => ({
        season_number: s.season_number,
        name: s.name,
        episode_count: s.episode_count,
        air_date: s.air_date ?? null,
        poster_path: s.poster_path ?? null,
      })),
    imdb_id: ext.imdb_id ?? null,
    tagline: details.tagline ?? null,
    status: details.status ?? "",
  };
}

export async function getSeason(tvId: string | number, season: number): Promise<EpisodeItem[]> {
  const data = await tmdb<any>(`/tv/${tvId}/season/${season}`);
  return (data.episodes as any[]).map((e) => ({
    id: e.id,
    episode_number: e.episode_number,
    season_number: e.season_number ?? season,
    name: e.name ?? `Episode ${e.episode_number}`,
    overview: e.overview ?? "",
    still_path: e.still_path ?? null,
    runtime: e.runtime ?? null,
    air_date: e.air_date ?? null,
  }));
}
