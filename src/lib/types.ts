export type MediaType = "movie" | "tv";

export interface MediaItem {
  id: number;
  media_type: MediaType;
  title: string; // unified from title/name
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  year: string | null;
  genre_ids?: number[];
}

export interface TorrentResult {
  id: string; // infoHash
  name: string;
  infoHash: string;
  magnet: string;
  quality: string; // 2160p / 1080p / 720p / unknown
  size?: string;
  seeds: number;
  source: string; // torrentio / yts / 1337x
  fileIdx?: number; // pre-picked video file index (torrentio)
}

export interface EpisodeItem {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  runtime: number | null;
  air_date: string | null;
}

export interface PlayTarget {
  type: MediaType;
  tmdbId: number;
  imdbId?: string | null;
  title: string;
  year?: string | null;
  season?: number;
  episode?: number;
  episodeName?: string;
  posterPath?: string | null;
}
