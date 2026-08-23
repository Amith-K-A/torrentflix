import axios from "axios";
import * as cheerio from "cheerio";
import { HttpsProxyAgent } from "https-proxy-agent";
import type { MediaType, TorrentResult } from "./types";
import { buildMagnet } from "./trackers";

/**
 * Torrent discovery layer, built for regions where torrent sites are
 * ISP-blocked (e.g. India):
 *
 *  1. Torrentio (default)  — public Stremio addon, not ISP-blocked, queried
 *     by TMDB id so results always match the clicked title.
 *  2. YTS mirrors          — direct API, movie fallback (tries several domains).
 *  3. 1337x mirrors        — HTML scrape fallback for anything else.
 *
 * If PROXY_URL is set, every outbound request to torrent sites goes through
 * that proxy. Streaming never touches the proxy — it is pure P2P.
 */

const PROXY_URL = process.env.PROXY_URL;
const TORRENTIO_URL = process.env.TORRENTIO_URL || "https://torrentio.strem.fun";

const YTS_MIRRORS = [
  "https://yts.mx",
  "https://yts.ag",
  "https://yts.rs",
  "https://yts.pm",
  "https://yts.wtf",
];

const X1377X_MIRRORS = [
  "https://1337x.to",
  "https://1337x.st",
  "https://x1337x.ws",
  "https://1337x.gd",
  "https://1337x.is",
];

let cachedProxyAgent: HttpsProxyAgent<string> | undefined;
function proxyAgent() {
  if (!PROXY_URL) return undefined;
  if (!cachedProxyAgent) cachedProxyAgent = new HttpsProxyAgent(PROXY_URL);
  return cachedProxyAgent;
}

async function fetchWith(
  url: string,
  opts: { timeout?: number; proxy?: boolean } = {}
): Promise<string> {
  const res = await axios.get<string>(url, {
    timeout: opts.timeout ?? 8000,
    httpAgent: opts.proxy ? proxyAgent() : undefined,
    httpsAgent: opts.proxy ? proxyAgent() : undefined,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    },
    validateStatus: (s) => s === 200,
  });
  return res.data;
}

/* ------------------------------------------------------------------ */
/* Torrentio                                                          */
/* ------------------------------------------------------------------ */

interface TorrentioStream {
  infoHash: string;
  fileIdx?: number;
  title: string;
}

function parseTorrentioTitle(raw: string) {
  // e.g. "Movie.Name.2023.1080p.WEBRip.x264 👤 245 | 💾 2.1 GB | 🎬 yts"
  const seedsMatch = raw.match(/👤\s*(\d+)/);
  const sizeMatch = raw.match(/💾\s*([\d.]+\s*[KMG]B)/i);
  const qualityMatch = raw.match(/(2160p|1080[pi]|720p|480p|4K)/i);
  const name = raw.split("👤")[0].split("|")[0].replace(/\s+/g, " ").trim();
  return {
    name: name || raw,
    quality: qualityMatch ? qualityMatch[1].toLowerCase().replace("i", "p") : "unknown",
    seeds: seedsMatch ? parseInt(seedsMatch[1], 10) : 0,
    size: sizeMatch ? sizeMatch[1] : undefined,
  };
}

async function searchTorrentio(
  type: MediaType,
  tmdbId?: number,
  imdbId?: string | null,
  season?: number,
  episode?: number
): Promise<TorrentResult[]> {
  let path: string;
  if (type === "tv") {
    const s = season ?? 1;
    const e = episode ?? 1;
    path = imdbId
      ? `/stream/series/${imdbId}:${s}:${e}.json`
      : `/stream/series/tmdb:${tmdbId}:${s}:${e}.json`;
  } else {
    path = tmdbId ? `/stream/movie/tmdb:${tmdbId}.json` : `/stream/movie/${imdbId}.json`;
  }

  const data = await axios.get<{ streams?: TorrentioStream[] }>(
    `${TORRENTIO_URL}${path}`,
    { timeout: 12000, validateStatus: (s) => s === 200 }
  );
  const streams = data.data.streams ?? [];

  return streams.map((s) => {
    const parsed = parseTorrentioTitle(s.title);
    return {
      id: s.infoHash.toLowerCase(),
      infoHash: s.infoHash.toLowerCase(),
      magnet: buildMagnet(s.infoHash, parsed.name),
      name: parsed.name,
      quality: parsed.quality,
      size: parsed.size,
      seeds: parsed.seeds,
      source: "torrentio",
      fileIdx: s.fileIdx,
    };
  });
}

/* ------------------------------------------------------------------ */
/* YTS                                                                */
/* ------------------------------------------------------------------ */

async function searchYts(imdbId?: string | null, title?: string, year?: string | null) {
  const term = imdbId || title || "";
  if (!term) return [];

  for (const mirror of YTS_MIRRORS) {
    try {
      const url = imdbId
        ? `${mirror}/api/v2/list_movies.json?query_term=${encodeURIComponent(imdbId)}`
        : `${mirror}/api/v2/list_movies.json?query_term=${encodeURIComponent(
            title + (year ? ` ${year}` : "")
          )}`;
      const data = await axios.get<any>(url, {
        timeout: 8000,
        httpsAgent: proxyAgent(),
      });
      const movies = data.data?.data?.movies;
      if (!movies?.length) return [];
      return movies.slice(0, 2).flatMap((m: any) =>
        (m.torrents ?? []).map((t: any) => ({
          id: t.hash.toLowerCase(),
          infoHash: t.hash.toLowerCase(),
          magnet: buildMagnet(t.hash, `${m.title_long} ${t.quality} ${t.type}`),
          name: `${m.title_long} ${t.quality} ${t.type}`,
          quality: t.quality ?? "unknown",
          size: t.size,
          seeds: t.seeds ?? 0,
          source: "yts",
        }))
      );
    } catch {
      // mirror blocked or down — try next
    }
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* 1337x (scrape)                                                     */
/* ------------------------------------------------------------------ */

async function search1377x(query: string): Promise<TorrentResult[]> {
  const q = query.trim();
  if (!q) return [];

  let $: cheerio.CheerioAPI | null = null;
  for (const mirror of X1377X_MIRRORS) {
    try {
      const html = await fetchWith(`${mirror}/search/${encodeURIComponent(q)}/1/`, {
        proxy: true,
      });
      $ = cheerio.load(html);
      break;
    } catch {
      // try next mirror
    }
  }
  if (!$) return [];

  const rows: { href: string; name: string; seeds: number; size: string }[] = [];
  $("tbody tr").each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length < 4) return;
    const a = $(cells[0]).find("a").last();
    const href = a.attr("href") ?? "";
    const name = a.text().trim();
    const seeds = parseInt($(cells[1]).text().trim() || "0", 10);
    const sizeCell = $(cells[3]).clone();
    sizeCell.find("span").remove();
    const size = sizeCell.text().trim();
    if (href.includes("/torrent/") && name) rows.push({ href, name, seeds, size });
  });

  const top = rows.sort((a, b) => b.seeds - a.seeds).slice(0, 6);
  const results = await Promise.allSettled(
    top.map(async (row) => {
      // magnet lives on the detail page
      let magnet = "";
      for (const mirror of X1377X_MIRRORS) {
        try {
          const html = await fetchWith(
            row.href.startsWith("http") ? row.href : `${mirror}${row.href}`,
            { proxy: true }
          );
          const d = cheerio.load(html);
          magnet = d('a[href^="magnet:?xt=urn:btih:"]').first().attr("href") ?? "";
          if (magnet) break;
        } catch {
          // try next mirror
        }
      }
      if (!magnet) throw new Error("no magnet");
      const hash = magnet.match(/urn:btih:([a-z0-9]{32,40})/i)?.[1] ?? "";
      return {
        id: hash.toLowerCase(),
        infoHash: hash.toLowerCase(),
        magnet,
        name: row.name,
        quality:
          row.name.match(/(2160p|1080[pi]|720p|480p|4K)/i)?.[1].toLowerCase().replace("i", "p") ??
          "unknown",
        size: row.size,
        seeds: row.seeds,
        source: "1337x",
      } as TorrentResult;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<TorrentResult> => r.status === "fulfilled")
    .map((r) => r.value);
}

/* ------------------------------------------------------------------ */
/* Combined                                                           */
/* ------------------------------------------------------------------ */

export interface TorrentQuery {
  type: MediaType;
  tmdbId?: number;
  imdbId?: string | null;
  title: string;
  year?: string | null;
  season?: number;
  episode?: number;
}

export async function searchTorrents(q: TorrentQuery): Promise<TorrentResult[]> {
  const attempts: Promise<TorrentResult[]>[] = [];

  if (q.type === "tv") {
    attempts.push(searchTorrentio(q.type, q.tmdbId, q.imdbId, q.season, q.episode).catch(() => []));
  } else {
    // For movies, fetch BOTH tmdb and imdb in parallel to maximize sources,
    // as some movies are only seeded well under one of the IDs in Torrentio.
    if (q.tmdbId) {
      attempts.push(searchTorrentio("movie", q.tmdbId, null).catch(() => []));
    }
    attempts.push(searchYts(q.imdbId, q.title, q.year).catch(() => []));
  }

  const results = await Promise.all(attempts);
  let all = results.flat();

  // If we have no seeded results for a movie, fallback to Torrentio IMDB id
  const hasSeeded = all.some((t) => t.seeds > 0);
  if (!hasSeeded && q.type === "movie" && q.imdbId) {
    const imdbFallback = await searchTorrentio("movie", undefined, q.imdbId).catch(() => []);
    all = [...all, ...imdbFallback];
  }

  const needsFallback = q.type === "tv" && !q.tmdbId && !q.imdbId;
  const stillNoSeeded = all.length === 0 || all.every((t) => t.seeds === 0);

  // If the primary providers came up empty, scrape 1337x by name.
  if (stillNoSeeded || needsFallback) {
    const query =
      q.type === "tv"
        ? `${q.title} S${String(q.season ?? 1).padStart(2, "0")}E${String(
            q.episode ?? 1
          ).padStart(2, "0")}`
        : `${q.title} ${q.year ?? ""}`.trim();
    const scraped = await search1377x(query).catch(() => []);
    all = [...all, ...scraped];
  }

  // de-dupe by infoHash, keep the entry with more seeders
  const byHash = new Map<string, TorrentResult>();
  for (const t of all) {
    if (!t.infoHash) continue;
    const prev = byHash.get(t.infoHash);
    if (!prev || t.seeds > prev.seeds) byHash.set(t.infoHash, t);
  }

  return [...byHash.values()].sort((a, b) => b.seeds - a.seeds).slice(0, 30);
}
