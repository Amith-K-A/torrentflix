import axios from "axios";
import type { EpisodeItem, MediaItem, MediaType } from "../lib/types";

// Default key fallback, or user can configure their own key in TV Settings
let apiKey = "4a1f3918b958c8b6bc16377e89139ccf"; // standard developer key or can be updated

export function setTmdbApiKey(key: string) {
  if (key && key.trim()) apiKey = key.trim();
}

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";

export const tmdbImg = {
  poster: (path: string | null, size: "w300" | "w500" = "w300") =>
    path ? `${IMG_BASE}/${size}${path}` : null,
  backdrop: (path: string | null, size: "w780" | "w1280" = "w780") =>
    path ? `${IMG_BASE}/${size}${path}` : null,
};

function formatItem(raw: any, type: MediaType): MediaItem {
  return {
    id: raw.id,
    title: raw.title || raw.name || "Untitled",
    name: raw.name,
    overview: raw.overview || "",
    posterPath: raw.poster_path,
    backdropPath: raw.backdrop_path,
    releaseDate: raw.release_date || raw.first_air_date,
    voteAverage: Math.round((raw.vote_average || 0) * 10) / 10,
    type,
  };
}

export async function getTrending(type: MediaType = "movie"): Promise<MediaItem[]> {
  try {
    const res = await axios.get(`${TMDB_BASE}/trending/${type}/day?api_key=${apiKey}`);
    return (res.data.results || []).map((r: any) => formatItem(r, type));
  } catch (e) {
    console.warn("TMDB getTrending error:", e);
    return [];
  }
}

export async function getPopular(type: MediaType = "movie"): Promise<MediaItem[]> {
  try {
    const res = await axios.get(`${TMDB_BASE}/${type}/popular?api_key=${apiKey}`);
    return (res.data.results || []).map((r: any) => formatItem(r, type));
  } catch (e) {
    console.warn("TMDB getPopular error:", e);
    return [];
  }
}

export async function getTopRated(type: MediaType = "movie"): Promise<MediaItem[]> {
  try {
    const res = await axios.get(`${TMDB_BASE}/${type}/top_rated?api_key=${apiKey}`);
    return (res.data.results || []).map((r: any) => formatItem(r, type));
  } catch (e) {
    console.warn("TMDB getTopRated error:", e);
    return [];
  }
}

export async function getDetails(type: MediaType, id: number): Promise<any> {
  try {
    const res = await axios.get(
      `${TMDB_BASE}/${type}/${id}?api_key=${apiKey}&append_to_response=external_ids,credits,similar`
    );
    return res.data;
  } catch (e) {
    console.warn("TMDB getDetails error:", e);
    return null;
  }
}

export async function getSeasonEpisodes(tvId: number, seasonNumber: number): Promise<EpisodeItem[]> {
  try {
    const res = await axios.get(`${TMDB_BASE}/tv/${tvId}/season/${seasonNumber}?api_key=${apiKey}`);
    return (res.data.episodes || []).map((ep: any) => ({
      id: ep.id,
      episodeNumber: ep.episode_number,
      seasonNumber: ep.season_number,
      name: ep.name || `Episode ${ep.episode_number}`,
      overview: ep.overview || "",
      stillPath: ep.still_path,
      runtime: ep.runtime,
    }));
  } catch (e) {
    console.warn("TMDB getSeasonEpisodes error:", e);
    return [];
  }
}

export async function searchTitles(query: string): Promise<MediaItem[]> {
  if (!query.trim()) return [];
  try {
    const res = await axios.get(
      `${TMDB_BASE}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false`
    );
    return (res.data.results || [])
      .filter((r: any) => r.media_type === "movie" || r.media_type === "tv")
      .map((r: any) => formatItem(r, r.media_type as MediaType));
  } catch (e) {
    console.warn("TMDB searchTitles error:", e);
    return [];
  }
}

export async function getByLanguage(type: MediaType, langCode: string, page = 1): Promise<MediaItem[]> {
  try {
    const res = await axios.get(
      `${TMDB_BASE}/discover/${type}?api_key=${apiKey}&with_original_language=${langCode}&sort_by=popularity.desc&page=${page}`
    );
    return (res.data.results || []).map((r: any) => formatItem(r, type));
  } catch (e) {
    console.warn("TMDB getByLanguage error:", e);
    return [];
  }
}
