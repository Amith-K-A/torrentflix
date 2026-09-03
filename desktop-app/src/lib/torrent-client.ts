/**
 * Server-side WebTorrent client (Node runtime).
 *
 * The browser <video> element streams from `/api/stream` while this client
 * fetches pieces over plain P2P (no proxy, no VPN). Keeps a small number of
 * torrents alive and reclaims idle ones.
 */
import { fileIsBrowserSafe, fileIsVideo } from "./utils";
import path from "path";
import os from "os";
import fs from "fs";

const MAX_TORRENTS = 4;
const IDLE_TTL_MS = 30 * 60 * 1000; // 30 min

export function getDownloadsPath(): string {
  const p = path.join(os.homedir(), "Downloads", "TorrentFlix");
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {}
  return p;
}

const DOWNLOADS_STATE_FILE = path.join(getDownloadsPath(), ".downloads.json");

export function saveDownloadsState() {
  try {
    const downloads = globalThis.__wtDownloads;
    if (!downloads) return;
    const serializable: any[] = [];
    for (const [id, meta] of downloads.entries()) {
      serializable.push({
        id,
        magnet: meta.magnet,
        title: meta.title,
        torrentName: meta.torrentName,
        posterPath: meta.posterPath,
        addedAt: meta.addedAt,
        fileIdx: meta.fileIdx,
        fileLength: meta.fileLength,
        type: meta.type,
        tmdbId: meta.tmdbId,
        imdbId: meta.imdbId,
        season: meta.season,
        episode: meta.episode,
        episodeName: meta.episodeName,
        completedAt: meta.completedAt,
        error: meta.error,
        done: meta.done ?? false,
      });
    }
    fs.writeFileSync(DOWNLOADS_STATE_FILE, JSON.stringify(serializable, null, 2));
  } catch (err) {
    console.error("[TorrentFlix] Failed to save downloads state:", err);
  }
}

export function loadDownloadsState() {
  try {
    if (!fs.existsSync(DOWNLOADS_STATE_FILE)) return;
    const raw = fs.readFileSync(DOWNLOADS_STATE_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      if (!globalThis.__wtDownloads) globalThis.__wtDownloads = new Map();
      for (const item of data) {
        if (!globalThis.__wtDownloads.has(item.id)) {
          globalThis.__wtDownloads.set(item.id, item);
        }
      }
    }
  } catch (err) {
    console.error("[TorrentFlix] Failed to load downloads state:", err);
  }
}

type AnyTorrent = any;
type AnyClient = any;

declare global {
  // eslint-disable-next-line no-var
  var __wtClient: AnyClient | undefined;
  // eslint-disable-next-line no-var
  var __wtAccess: Map<string, number> | undefined;
  // eslint-disable-next-line no-var
  var __wtCleanup: NodeJS.Timeout | undefined;
  // eslint-disable-next-line no-var
  var __wtDownloads: Map<string, any> | undefined;
}

export async function getClient(): Promise<AnyClient> {
  if (!globalThis.__wtClient) {
    const mod = await import("webtorrent");
    const WebTorrent = (mod as any).default ?? mod;
    globalThis.__wtClient = new WebTorrent({ maxConns: 300 });
    globalThis.__wtAccess = new Map();
    if (!globalThis.__wtDownloads) {
      globalThis.__wtDownloads = new Map();
      loadDownloadsState();
    }
  }
  if (!globalThis.__wtCleanup) {
    globalThis.__wtCleanup = setInterval(() => {
      const access = globalThis.__wtAccess;
      if (!access || !globalThis.__wtClient) return;
      const now = Date.now();
      for (const t of globalThis.__wtClient.torrents as AnyTorrent[]) {
        if (globalThis.__wtDownloads?.has(t.infoHash)) continue; // Never evict explicit downloads

        const last = access.get(t.infoHash) ?? 0;
        if (now - last > IDLE_TTL_MS) {
          try {
            globalThis.__wtClient.remove(t, { destroyStore: true });
          } catch {}
          access.delete(t.infoHash);
        }
      }
    }, 60_000);
    globalThis.__wtCleanup.unref?.();
  }
  return globalThis.__wtClient;
}

function touch(infoHash: string) {
  globalThis.__wtAccess?.set(infoHash, Date.now());
}

function evictIfNeeded(client: AnyClient) {
  const torrents = (client.torrents as AnyTorrent[]).filter(t => !globalThis.__wtDownloads?.has(t.infoHash));
  if (torrents.length <= MAX_TORRENTS) return;
  const access = globalThis.__wtAccess ?? new Map();
  torrents
    .sort((a, b) => (access.get(a.infoHash) ?? 0) - (access.get(b.infoHash) ?? 0))
    .slice(0, torrents.length - MAX_TORRENTS)
    .forEach((t) => {
      try {
        client.remove(t, { destroyStore: true });
      } catch {}
      access.delete(t.infoHash);
    });
}

export interface StartedTorrent {
  infoHash: string;
  fileIdx: number;
  fileName: string;
  fileSize: number;
  browserSafe: boolean;
}

export interface StartOptions {
  /** Pre-picked video file index within the torrent (e.g. torrentio's fileIdx for episode packs). */
  fileIdx?: number;
  season?: number;
  episode?: number;
  title?: string;
  posterPath?: string;
  type?: "movie" | "tv";
  tmdbId?: number;
  imdbId?: string | null;
  episodeName?: string;
}

/** Filename looks like the given episode: "S01E05", "1x05", "Episode 5". */
function fileMatchesEpisode(name: string, season?: number, episode?: number): boolean {
  if (!episode) return false;
  const s = season ?? 0;
  const n = name.toLowerCase();
  return (
    new RegExp(`s0*${s}[\\s._-]?e0*${episode}\\b`).test(n) ||
    new RegExp(`\\b0*${s}x0*${episode}\\b`).test(n) ||
    new RegExp(`\\bepisode[\\s._-]*0*${episode}\\b`).test(n)
  );
}

/**
 * Prioritize the piece window around the streaming playhead.
 * Deselects previous streaming window and clears old critical flags so peer bandwidth
 * immediately concentrates on the new seek point instead of continuing to download
 * from the beginning of the file.
 */
export function prioritizeStreamRange(file: AnyTorrent, startByte: number, endByte: number) {
  const torrent = file._torrent;
  if (!torrent || !torrent.ready || torrent.destroyed) return;

  const pieceLength = torrent.pieceLength;
  const absStart = file.offset + startByte;
  const absEnd = file.offset + endByte;

  const startPiece = Math.max(file._startPiece, Math.floor(absStart / pieceLength));
  const endPiece = Math.min(file._endPiece, Math.floor(absEnd / pieceLength));

  // Clear previous critical piece flags across the torrent so stale positions don't steal priority
  torrent._critical = [];

  // Deselect previous custom stream window if any
  if (torrent._activeStreamWindow) {
    try {
      torrent.deselect(torrent._activeStreamWindow.start, torrent._activeStreamWindow.end);
    } catch {}
  }

  // Immediate critical pieces for instant playback: next 5-8 pieces (~10-15MB)
  const criticalAhead = Math.min(endPiece, startPiece + 6);
  try {
    torrent.critical(startPiece, criticalAhead);
  } catch {}

  // Readahead buffer window: next 30-40 pieces (~50-80MB) with high priority
  const bufferAhead = Math.min(endPiece, startPiece + 35);
  try {
    torrent.select(startPiece, bufferAhead, 100);
  } catch {}

  torrent._activeStreamWindow = { start: startPiece, end: bufferAhead };

  try {
    torrent._updateSelections();
  } catch {}
}

/** Pre-prioritize file head and tail pieces so container headers and moov atom load in seconds. */
function prePrioritizeMetadata(torrent: AnyTorrent, file: AnyTorrent) {
  if (!torrent || !torrent.ready || torrent.destroyed) return;

  const fileStart = file._startPiece;
  const fileEnd = file._endPiece;

  // 1. Critical head pieces (first 3-4 pieces) for instant video header / ftyp parsing
  const headEnd = Math.min(fileEnd, fileStart + 3);
  try {
    torrent.critical(fileStart, headEnd);
    torrent.select(fileStart, Math.min(fileEnd, fileStart + 15), 100);
  } catch {}

  // 2. Critical tail pieces (last 2-3 pieces) for instant moov atom parsing in MP4/MKV
  const tailStart = Math.max(fileStart, fileEnd - 2);
  try {
    torrent.critical(tailStart, fileEnd);
    torrent.select(tailStart, fileEnd, 90);
  } catch {}

  try {
    torrent._updateSelections();
  } catch {}
}

/** Add a magnet, wait for metadata, return the best video file to stream. */
export async function startTorrent(magnet: string, opts: StartOptions = {}): Promise<StartedTorrent> {
  const client = await getClient();
  const downloadsPath = getDownloadsPath();

  // v3 returns a Promise from get()
  let torrent: AnyTorrent | null = await client.get(magnet);
  if (!torrent) {
    torrent = client.add(magnet, { path: downloadsPath });
    evictIfNeeded(client);
  }
  touch(torrent.infoHash);

  if (opts.title || opts.tmdbId) {
    torrent._streamMeta = {
      title: opts.title,
      posterPath: opts.posterPath,
      type: opts.type,
      tmdbId: opts.tmdbId,
      imdbId: opts.imdbId,
      season: opts.season,
      episode: opts.episode,
      episodeName: opts.episodeName,
      fileIdx: opts.fileIdx,
    };
  }

  if (!torrent.ready) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for torrent metadata (no peers yet)."));
      }, 30_000);
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      function cleanup() {
        clearTimeout(timer);
        torrent!.removeListener("ready", onReady);
        torrent!.removeListener("error", onError);
      }
      torrent!.once("ready", onReady);
      torrent!.once("error", onError);
    });
  }
  touch(torrent.infoHash);

  // Use sequential strategy for streaming
  torrent.strategy = "sequential";

  const files: AnyTorrent[] = torrent.files ?? [];
  if (!files.length) throw new Error("Torrent has no files.");

  // Torrentio names the exact file for episode packs — trust it when valid.
  if (Number.isInteger(opts.fileIdx) && opts.fileIdx! >= 0 && opts.fileIdx! < files.length) {
    const f = files[opts.fileIdx!];
    const name: string = f.name ?? "";
    if (fileIsVideo(name)) {
      // Deselect whole torrent so background download doesn't compete with stream
      torrent.deselect(0, torrent.pieces.length - 1);
      files.forEach((otherFile: any) => {
        try { otherFile.deselect(); } catch {}
      });

      // Pre-prioritize head and tail for fast metadata loading
      prePrioritizeMetadata(torrent, f);

      if (torrent._streamMeta) {
        torrent._streamMeta.fileIdx = opts.fileIdx!;
        torrent._streamMeta.fileLength = f.length;
        torrent._streamMeta.fileName = name;
      }

      torrent.on("done", () => {
        registerCompletedStreamDownload(torrent, opts.fileIdx!, f);
      });

      return {
        infoHash: torrent.infoHash,
        fileIdx: opts.fileIdx!,
        fileName: name,
        fileSize: f.length ?? 0,
        browserSafe: fileIsBrowserSafe(name),
      };
    }
  }

  // Otherwise score files: requested episode match first (season packs),
  // then a browser-playable container, then any video, then largest.
  const scored = files
    .map((f, idx) => {
      const name: string = f.name ?? "";
      return {
        f,
        idx,
        size: f.length ?? 0,
        browserSafe: fileIsBrowserSafe(name),
        isVideo: fileIsVideo(name),
        epMatch: fileMatchesEpisode(name, opts.season, opts.episode),
      };
    })
    .sort(
      (a, b) =>
        Number(b.epMatch) - Number(a.epMatch) ||
        Number(b.browserSafe) - Number(a.browserSafe) ||
        Number(b.isVideo) - Number(a.isVideo) ||
        b.size - a.size
    );

  const best = scored[0];

  // Deselect whole torrent so background download doesn't compete with stream
  torrent.deselect(0, torrent.pieces.length - 1);
  files.forEach((f: any) => {
    try { f.deselect(); } catch {}
  });

  // Pre-prioritize head and tail for fast metadata loading
  prePrioritizeMetadata(torrent, best.f);

  if (torrent._streamMeta) {
    torrent._streamMeta.fileIdx = best.idx;
    torrent._streamMeta.fileLength = best.f.length;
    torrent._streamMeta.fileName = best.f.name;
  }

  torrent.on("done", () => {
    registerCompletedStreamDownload(torrent, best.idx, best.f);
  });

  return {
    infoHash: torrent.infoHash,
    fileIdx: best.idx,
    fileName: best.f.name,
    fileSize: best.f.length ?? 0,
    browserSafe: best.browserSafe,
  };
}

export function registerCompletedStreamDownload(torrent: AnyTorrent, fileIdx?: number, targetFile?: any) {
  if (!globalThis.__wtDownloads) globalThis.__wtDownloads = new Map();
  const idx = fileIdx !== undefined ? fileIdx : (torrent._streamMeta?.fileIdx ?? 0);
  const downloadId = `${torrent.infoHash}:${idx}`;

  const existing = globalThis.__wtDownloads.get(downloadId);
  if (existing && existing.done) return;

  const file = targetFile || (torrent.files ? torrent.files[idx] : null);
  const meta = torrent._streamMeta || {};

  const downloadMeta: any = {
    id: downloadId,
    magnet: torrent.magnetURI || `magnet:?xt=urn:btih:${torrent.infoHash}`,
    title: meta.title || torrent.name,
    torrentName: torrent.name,
    posterPath: meta.posterPath,
    addedAt: existing?.addedAt || Date.now(),
    completedAt: Date.now(),
    fileIdx: idx,
    fileLength: file?.length || torrent.length,
    type: meta.type || "movie",
    tmdbId: meta.tmdbId,
    imdbId: meta.imdbId,
    season: meta.season,
    episode: meta.episode,
    episodeName: meta.episodeName,
    torrentRef: torrent,
    error: null,
    done: true,
  };

  globalThis.__wtDownloads.set(downloadId, downloadMeta);
  saveDownloadsState();
}

export async function getTorrentFile(infoHash: string, fileIdx: number) {
  const client = globalThis.__wtClient;
  if (!client) return null;
  const torrent = await client.get(infoHash);
  if (!torrent || !torrent.ready) return null;
  touch(infoHash);
  const file = (torrent.files as AnyTorrent[])[fileIdx];
  return file ? { torrent, file } : null;
}

export async function getTorrentStats(infoHash: string, fileIdx?: number) {
  const client = globalThis.__wtClient;
  const torrent = client ? await client.get(infoHash) : null;
  if (!torrent) return null;
  touch(infoHash);

  const cachedRanges: { start: number; end: number }[] = [];
  let fileProgress = torrent.progress ?? 0;

  const targetFile = torrent.files && Number.isInteger(fileIdx) && torrent.files[fileIdx!]
    ? torrent.files[fileIdx!]
    : torrent.files?.[0];

  if (torrent.ready && torrent.bitfield && targetFile) {
    const fStart = targetFile._startPiece ?? 0;
    const fEnd = targetFile._endPiece ?? (torrent.pieces.length - 1);
    const totalPieces = Math.max(1, fEnd - fStart + 1);

    let inRange = false;
    let rangeStart = 0;
    let downloadedPieces = 0;

    for (let p = fStart; p <= fEnd; p++) {
      const has = torrent.bitfield.get(p);
      if (has) downloadedPieces++;

      if (has && !inRange) {
        inRange = true;
        rangeStart = p - fStart;
      } else if (!has && inRange) {
        inRange = false;
        const rangeEnd = p - fStart;
        cachedRanges.push({
          start: rangeStart / totalPieces,
          end: rangeEnd / totalPieces,
        });
      }
    }
    if (inRange) {
      cachedRanges.push({
        start: rangeStart / totalPieces,
        end: 1,
      });
    }

    fileProgress = downloadedPieces / totalPieces;
  }

  if (fileProgress >= 1 || (torrent.progress && torrent.progress >= 1)) {
    registerCompletedStreamDownload(torrent, fileIdx, targetFile);
  }

  return {
    infoHash: torrent.infoHash,
    name: torrent.name,
    progress: fileProgress,
    overallProgress: torrent.progress ?? 0,
    peers: torrent.numPeers ?? 0,
    downloadSpeed: torrent.downloadSpeed ?? 0,
    uploadSpeed: torrent.uploadSpeed ?? 0,
    downloaded: torrent.downloaded ?? 0,
    length: torrent.length ?? 0,
    cachedRanges,
  };
}


/**
 * Build a web ReadableStream for a byte range of a torrent file.
 * webtorrent v3's stream is not compatible with Readable.toWeb, so pump it
 * manually with backpressure and immediate cancellation on client abort.
 */
export function fileRangeStream(
  file: AnyTorrent,
  start: number,
  end: number,
  signal?: AbortSignal
): ReadableStream {
  const nodeStream: import("stream").Readable = file.createReadStream({ start, end });
  let paused = false;
  let closed = false;

  const destroyNodeStream = () => {
    if (closed) return;
    closed = true;
    try {
      nodeStream.destroy();
    } catch {}
  };

  if (signal) {
    if (signal.aborted) {
      destroyNodeStream();
      return new ReadableStream({
        start(controller) {
          controller.close();
        },
      });
    }
    signal.addEventListener("abort", destroyNodeStream, { once: true });
  }

  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => {
        if (closed) return;
        controller.enqueue(new Uint8Array(chunk));
        if ((controller.desiredSize ?? 1) <= 0 && !paused) {
          paused = true;
          nodeStream.pause();
        }
      });
      nodeStream.on("end", () => {
        try {
          controller.close();
        } catch {}
        destroyNodeStream();
      });
      nodeStream.on("error", (err: Error) => {
        try {
          controller.error(err);
        } catch {}
        destroyNodeStream();
      });
    },
    pull() {
      if (paused && !closed) {
        paused = false;
        nodeStream.resume();
      }
    },
    cancel() {
      destroyNodeStream();
    },
  });
}

/**
 * Start a persistent download to the user's Downloads folder
 */
export async function startDownload(magnet: string, title: string, posterPath?: string) {
  const client = await getClient();
  const downloadsPath = path.join(os.homedir(), 'Downloads', 'TorrentFlix');
  
  // Add to downloads map immediately to prevent eviction
  // (We don't know infoHash yet, but WebTorrent deduplicates magnets anyway)
  let torrent: AnyTorrent | null = await client.get(magnet);
  
  if (!torrent) {
    torrent = client.add(magnet, { path: downloadsPath });
  } else if (!globalThis.__wtDownloads?.has(torrent.infoHash)) {
    // If it was already in memory but not a persistent download, 
    // we technically can't change the `path` easily without restarting the torrent.
    // For simplicity, we just flag it. It will stay in memory, but not be saved to disk
    // unless WebTorrent is restarted.
    // In a robust app we would destroy and re-add it with the new path.
    client.remove(torrent, { destroyStore: false });
    torrent = client.add(magnet, { path: downloadsPath });
  }

  globalThis.__wtDownloads?.set(torrent!.infoHash, {
    title,
    posterPath,
    addedAt: Date.now()
  });

  return { infoHash: torrent!.infoHash };
}

/**
 * Get stats for all active persistent downloads
 */
export async function getAllDownloadsStats() {
  const client = globalThis.__wtClient;
  const downloads = globalThis.__wtDownloads;
  if (!client || !downloads) return [];

  const results = [];
  for (const [infoHash, meta] of downloads.entries()) {
    const torrent = await client.get(infoHash);
    if (!torrent) {
      // It was removed somehow, maybe error
      results.push({
        infoHash,
        title: meta.title,
        posterPath: meta.posterPath,
        progress: 0,
        status: 'error',
      });
      continue;
    }

    results.push({
      infoHash: torrent.infoHash,
      title: meta.title,
      posterPath: meta.posterPath,
      name: torrent.name,
      progress: torrent.progress ?? 0,
      peers: torrent.numPeers ?? 0,
      downloadSpeed: torrent.downloadSpeed ?? 0,
      uploadSpeed: torrent.uploadSpeed ?? 0,
      downloaded: torrent.downloaded ?? 0,
      length: torrent.length ?? 0,
      timeRemaining: torrent.timeRemaining ?? 0,
      ready: torrent.ready,
      done: torrent.done,
    });
  }

  return results.sort((a, b) => {
    const aMeta = downloads.get(a.infoHash);
    const bMeta = downloads.get(b.infoHash);
    return (bMeta?.addedAt ?? 0) - (aMeta?.addedAt ?? 0);
  });
}
