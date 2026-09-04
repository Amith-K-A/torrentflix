import axios from "axios";
import type { PlayTarget, TorrentResult } from "../lib/types";

export async function searchTorrents(target: PlayTarget): Promise<TorrentResult[]> {
  const results: TorrentResult[] = [];

  // 1. Try Torrentio API (supports both movies and series with exact episode matching)
  try {
    let torrentioUrl = "";
    if (target.imdbId) {
      if (target.type === "movie") {
        torrentioUrl = `https://torrentio.strem.fun/stream/movie/${target.imdbId}.json`;
      } else if (target.season && target.episode) {
        torrentioUrl = `https://torrentio.strem.fun/stream/series/${target.imdbId}:${target.season}:${target.episode}.json`;
      }
    }

    if (torrentioUrl) {
      const res = await axios.get(torrentioUrl, { timeout: 6000 });
      const streams = res.data?.streams || [];
      for (const s of streams) {
        if (!s.infoHash) continue;
        const titleLine = (s.title || "").split("\n")[0] || target.title;
        const detailLines = (s.title || "").split("\n");
        let seeders = 5;
        let sizeBytes = 1.2 * 1024 * 1024 * 1024;

        for (const line of detailLines) {
          const mSeed = line.match(/👤\s*(\d+)/);
          if (mSeed) seeders = parseInt(mSeed[1], 10);
          const mSize = line.match(/💾\s*([\d.]+)\s*(GB|MB)/i);
          if (mSize) {
            const val = parseFloat(mSize[1]);
            sizeBytes = mSize[2].toUpperCase() === "GB" ? val * 1024 * 1024 * 1024 : val * 1024 * 1024;
          }
        }

        const magnet = `magnet:?xt=urn:btih:${s.infoHash}&dn=${encodeURIComponent(titleLine)}`;
        let quality = "1080p";
        if (s.name?.includes("4k") || titleLine.includes("2160p") || titleLine.includes("4K")) quality = "2160p";
        else if (titleLine.includes("720p") || s.name?.includes("720p")) quality = "720p";

        results.push({
          title: titleLine,
          magnet,
          infoHash: s.infoHash.toLowerCase(),
          quality,
          seeders,
          leechers: 0,
          sizeBytes,
          provider: "Torrentio",
          isMp4: titleLine.toLowerCase().endsWith(".mp4"),
        });
      }
    }
  } catch (e) {
    console.warn("Torrentio search error:", e);
  }

  // 2. Fallback to YTS for movies if fewer than 2 results
  if (results.length < 2 && target.type === "movie") {
    try {
      const ytsUrl = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(
        target.imdbId || target.title
      )}`;
      const ytsRes = await axios.get(ytsUrl, { timeout: 5000 });
      const movie = ytsRes.data?.data?.movies?.[0];
      if (movie && movie.torrents) {
        for (const t of movie.torrents) {
          const hash = (t.hash || "").toLowerCase();
          if (!hash) continue;
          const magnet = `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(
            `${movie.title} [${t.quality}] [YTS]`
          )}`;
          results.push({
            title: `${movie.title} (${movie.year}) [${t.quality}]`,
            magnet,
            infoHash: hash,
            quality: t.quality === "2160p" ? "2160p" : t.quality === "1080p" ? "1080p" : "720p",
            seeders: t.seeds || 0,
            leechers: t.peers || 0,
            sizeBytes: t.size_bytes || 1024 * 1024 * 1024,
            provider: "YTS",
            isMp4: true,
          });
        }
      }
    } catch (e) {
      console.warn("YTS search error:", e);
    }
  }

  // Sort by seeder count descending
  return results.sort((a, b) => b.seeders - a.seeders);
}
