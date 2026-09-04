export type MediaType = "movie" | "tv";

export interface MediaItem {
  id: number;
  title: string;
  name?: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage: number;
  type: MediaType;
}

export interface EpisodeItem {
  id: number;
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  overview: string;
  stillPath: string | null;
  runtime?: number;
}

export interface PlayTarget {
  type: MediaType;
  tmdbId: number;
  imdbId?: string | null;
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  episodeName?: string;
}

export interface TorrentResult {
  title: string;
  magnet: string;
  infoHash: string;
  quality: string;
  seeders: number;
  leechers: number;
  sizeBytes: number;
  provider: string;
  isMp4?: boolean;
}

export type HardwareTier = "high" | "mid" | "constrained";
export type DecoderSelection = "auto" | "force_hardware" | "force_software";

export interface DeviceProfile {
  tier: HardwareTier;
  totalRamMb: number;
  isLowRamDevice: boolean;
  cpuCores: number;
  maxPeerConnections: number;
  rollingBufferMb: number;
  useHardwareDecoding: boolean;
  hardwareReason: string;
}

export interface StreamStats {
  infoHash: string;
  progress: number;
  peers: number;
  downloadSpeed: number;
  uploadSpeed: number;
  bufferAheadSeconds?: number;
}
