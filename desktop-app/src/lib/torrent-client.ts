/**
 * Server-side WebTorrent client (Node runtime).
 *
 * The browser <video> element streams from `/api/stream` while this client
 * fetches pieces over plain P2P (no proxy, no VPN). Keeps a small number of
 * torrents alive and reclaims idle ones.
 */
import { fileIsBrowserSafe, fileIsVideo } from "./utils";
import { TRACKERS, DHT_BOOTSTRAP_NODES } from "./trackers";
import path from "path";
import os from "os";
import fs from "fs";

const MAX_TORRENTS = 3;
const IDLE_TTL_MS = 10 * 60 * 1000; // 10 min — keep low for 8GB RAM systems
const DONE_CLEANUP_DELAY_MS = 30_000; // 30s after download completes, free torrent from RAM

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
        paused: meta.paused ?? false,
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
          globalThis.__wtDownloads.set(item.id, {
            ...item,
            torrentRef: null,
          });
        }
      }
    }
  } catch (err) {
    console.error("[TorrentFlix] Failed to load downloads state:", err);
  }
}

export function getDownloadsMap(): Map<string, any> {
  if (!globalThis.__wtDownloads) {
    globalThis.__wtDownloads = new Map();
    loadDownloadsState();
  } else if (globalThis.__wtDownloads.size === 0) {
    loadDownloadsState();
  }
  return globalThis.__wtDownloads;
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
  // eslint-disable-next-line no-var
  var __ltDownloads: Set<string> | undefined;
}

export async function ensureDaemonRunning(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:8080/stats", { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

let clientPromise: Promise<AnyClient> | null = null;

export async function getClient(): Promise<AnyClient> {
  if (globalThis.__wtClient) return globalThis.__wtClient;
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    try {
      const mod = await import("webtorrent");
      const WebTorrent = (mod as any).default ?? mod;
      globalThis.__wtClient = new WebTorrent({
        maxConns: 500,
        downloadLimit: -1,
        uploadLimit: -1,
        dht: { bootstrap: DHT_BOOTSTRAP_NODES },
        natUpnp: true,
        natPmp: true,
        utp: true,
        utPex: true,
        lsd: true,
        seedOutgoingConnections: true,
      });
      globalThis.__wtAccess = new Map();
      getDownloadsMap();

      // Prevent unhandled error crashes
      globalThis.__wtClient.on("error", (err: Error) => {
        console.error("[TorrentFlix] WebTorrent client error:", err.message);
      });

      if (!globalThis.__wtCleanup) {
        globalThis.__wtCleanup = setInterval(() => {
          const access = globalThis.__wtAccess;
          if (!access || !globalThis.__wtClient) return;
          const now = Date.now();
          const downloads = getDownloadsMap();
          for (const t of globalThis.__wtClient.torrents as AnyTorrent[]) {
            const hasDownload = Array.from(downloads.keys()).some(k => k.startsWith(t.infoHash + ':'));
            const isDone = t.done || (t.progress && t.progress >= 1);
            if (hasDownload || isDone) continue; // Never evict explicit or completed downloads

            const last = access.get(t.infoHash) ?? 0;
            if (now - last > IDLE_TTL_MS) {
              try {
                globalThis.__wtClient.remove(t, { destroyStore: false }); // Keep cached files in Downloads/TorrentFlix
              } catch {}
              access.delete(t.infoHash);
            }
          }
        }, 60_000);
        globalThis.__wtCleanup.unref?.();
      }

      return globalThis.__wtClient;
    } finally {
      clientPromise = null;
    }
  })();

  return clientPromise;
}

function touch(infoHash: string) {
  globalThis.__wtAccess?.set(infoHash, Date.now());
}

function evictIfNeeded(client: AnyClient) {
  const downloads = getDownloadsMap();
  const torrents = (client.torrents as AnyTorrent[]).filter(t => {
    const hasDownload = Array.from(downloads.keys()).some(k => k.startsWith(t.infoHash + ':'));
    const isDone = t.done || (t.progress && t.progress >= 1);
    return !hasDownload && !isDone;
  });
  if (torrents.length <= MAX_TORRENTS) return;
  const access = globalThis.__wtAccess ?? new Map();
  torrents
    .sort((a, b) => (access.get(a.infoHash) ?? 0) - (access.get(b.infoHash) ?? 0))
    .slice(0, torrents.length - MAX_TORRENTS)
    .forEach((t) => {
      try {
        client.remove(t.infoHash, { destroyStore: false }); // Keep cached files in Downloads/TorrentFlix
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

// Removed prioritizeCriticalRange as it creates unmanaged streams.
// The browser's native <video> tag makes Range requests for the head and tail,
// which our /api/stream endpoint automatically translates into prioritized WebTorrent read streams.

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

  // Immediate critical pieces for instant playback: next 8 pieces (~16MB)
  const criticalAhead = Math.min(endPiece, startPiece + 8);
  try {
    torrent.critical(startPiece, criticalAhead);
  } catch {}

  // Readahead buffer window: next 55 pieces (~80-120MB) with high priority
  const bufferAhead = Math.min(endPiece, startPiece + 55);
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
  // Try libtorrent daemon first
  try {
    const res = await fetch("http://127.0.0.1:8080/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ magnet }),
    });
    if (res.ok) {
      const data = await res.json();
      
      const files = data.files || [];
      if (!files.length) throw new Error("Torrent has no files.");

      let bestIdx = 0;
      if (Number.isInteger(opts.fileIdx) && opts.fileIdx! >= 0 && opts.fileIdx! < files.length) {
        if (fileIsVideo(files[opts.fileIdx!].name)) {
          bestIdx = opts.fileIdx!;
        }
      } else {
        const scored = files.map((f: any) => ({
          ...f,
          browserSafe: fileIsBrowserSafe(f.name),
          isVideo: fileIsVideo(f.name),
          epMatch: fileMatchesEpisode(f.name, opts.season, opts.episode)
        })).sort((a: any, b: any) => 
          Number(b.epMatch) - Number(a.epMatch) ||
          Number(b.browserSafe) - Number(a.browserSafe) ||
          Number(b.isVideo) - Number(a.isVideo) ||
          b.size - a.size
        );
        bestIdx = scored[0].idx;
      }

      const best = files[bestIdx];
      
      // Store flag globally so getTorrentFile knows it's a libtorrent stream
      if (!globalThis.__ltDownloads) globalThis.__ltDownloads = new Set();
      globalThis.__ltDownloads.add(data.infoHash);

      return {
        infoHash: data.infoHash,
        fileIdx: bestIdx,
        fileName: best.name,
        fileSize: best.size,
        browserSafe: fileIsBrowserSafe(best.name),
      };
    }
  } catch {
    // Daemon not running or failed; fall back to WebTorrent
    console.log("[TorrentFlix] libtorrent daemon not available, falling back to WebTorrent.");
  }

  const client = await getClient();
  const downloadsPath = getDownloadsPath();

  // v3 returns a Promise from get()
  let torrent: AnyTorrent | null = await client.get(magnet);
  if (!torrent) {
    torrent = client.add(magnet, {
      path: downloadsPath,
      announce: TRACKERS,
      maxConns: 200,
      uploads: 20,
      storeCacheSlots: 100,
    });
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
  const downloads = getDownloadsMap();
  const idx = fileIdx !== undefined ? fileIdx : (torrent._streamMeta?.fileIdx ?? 0);
  const downloadId = `${torrent.infoHash}:${idx}`;

  const existing = downloads.get(downloadId);
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

  downloads.set(downloadId, downloadMeta);
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
  if ((globalThis as any).__ltDownloads?.has(infoHash)) {
    try {
      const res = await fetch(`http://127.0.0.1:8080/stats?infoHash=${infoHash}`);
      if (res.ok) return await res.json();
    } catch {}
  }

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
 * Called when the player closes. Keeps the torrent cached in RAM so
 * re-opening the same title is instant. The idle cleanup timer will
 * eventually reclaim it after IDLE_TTL_MS of inactivity.
 */
export async function stopStreaming(infoHash: string) {
  touch(infoHash);
  const client = globalThis.__wtClient;
  const torrent = client ? await client.get(infoHash) : null;
  if (torrent) {
    torrent._critical = [];
    if (torrent._activeStreamWindow) {
      try {
        torrent.deselect(torrent._activeStreamWindow.start, torrent._activeStreamWindow.end);
      } catch {}
      delete torrent._activeStreamWindow;
    }
    try { torrent._updateSelections(); } catch {}
  }
  console.log(`[TorrentFlix] Player closed — keeping torrent ${infoHash} cached in RAM (idle timer will reclaim).`);
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

export async function cancelDownload(downloadId: string) {
  return removeDownload(downloadId, true);
}

export async function clearAllDownloads() {
  const downloads = getDownloadsMap();
  for (const downloadId of Array.from(downloads.keys())) {
    await removeDownload(downloadId, true);
  }
}

export async function clearAllErrors() {
  const downloads = getDownloadsMap();
  for (const [downloadId, meta] of Array.from(downloads.entries())) {
    if (meta.error) {
      downloads.delete(downloadId);
    }
  }
  saveDownloadsState();
}

async function ensureInfoHash(torrent: any): Promise<string> {
  if (torrent.infoHash) return torrent.infoHash;
  return new Promise((resolve) => {
    torrent.once("infoHash", () => resolve(torrent.infoHash));
  });
}

export async function startDownload(
  magnet: string,
  title: string,
  posterPath?: string,
  fileIdx?: number,
  type?: "movie" | "tv",
  tmdbId?: number,
  imdbId?: string | null,
  season?: number,
  episode?: number,
  episodeName?: string
) {
  const client = await getClient();
  const downloadsPath = getDownloadsPath();
  
  let torrent: any = await client.get(magnet);
  let isNew = false;
  
  if (!torrent) {
    torrent = client.add(magnet, {
      path: downloadsPath,
      announce: TRACKERS,
      maxConns: 200,
      uploads: 20,
      storeCacheSlots: 100,
    });
    isNew = true;
  } else {
    const infoHash = await ensureInfoHash(torrent);
    const isPersisted = Array.from(globalThis.__wtDownloads?.keys() || []).some(k => k.startsWith(infoHash + ':'));
    if (!isPersisted) {
      await new Promise<void>((resolve) => {
        client.remove(infoHash, { destroyStore: false }, (err: any) => {
          if (err) console.error("Error removing old torrent:", err);
          resolve();
        });
      });
      torrent = client.add(magnet, {
        path: downloadsPath,
        announce: TRACKERS,
        maxConns: 200,
        uploads: 20,
        storeCacheSlots: 100,
      });
      isNew = true;
    }
  }

  const infoHash = await ensureInfoHash(torrent);

  if (fileIdx !== undefined) {
    const applyFileSelection = () => {
      if (isNew) {
        torrent!.files.forEach((file: any) => {
          file.deselect();
        });
      }
      if (torrent!.files[fileIdx]) {
        torrent!.files[fileIdx].select();
      }
    };
    if (torrent.ready) {
      applyFileSelection();
    } else {
      torrent.on("ready", applyFileSelection);
    }
  }

  const downloadId = `${infoHash}:${fileIdx !== undefined ? fileIdx : 'all'}`;
  const downloads = getDownloadsMap();
  
  const downloadMeta: any = {
    magnet,
    title,
    posterPath,
    addedAt: Date.now(),
    fileIdx,
    type,
    tmdbId,
    imdbId,
    season,
    episode,
    episodeName,
    torrentRef: torrent,  // Keep a direct reference
    error: null,
  };
  
  downloads.set(downloadId, downloadMeta);
  saveDownloadsState();

  // Listen for errors on this torrent — store the error instead of losing the torrent
  torrent.on("error", (err: Error) => {
    console.error(`[TorrentFlix] Download error for "${title}":`, err.message);
    downloadMeta.error = err.message;
  });

  // Auto-destroy torrent from RAM once download completes (file is already on disk)
  torrent.on("done", () => {
    console.log(`[TorrentFlix] Download complete: "${title}". Will free RAM in ${DONE_CLEANUP_DELAY_MS / 1000}s.`);
    downloadMeta.done = true;
    downloadMeta.completedAt = Date.now();
    saveDownloadsState();
    setTimeout(async () => {
      try {
        const c = globalThis.__wtClient;
        if (c) {
          const t = await c.get(infoHash);
          if (t) {
            c.remove(infoHash, { destroyStore: false }); // keep files, free RAM
            console.log(`[TorrentFlix] Freed RAM for completed download: "${title}"`);
          }
        }
        downloadMeta.torrentRef = null; // allow GC
      } catch (e: any) {
        console.error(`[TorrentFlix] Failed to cleanup completed download:`, e?.message);
      }
    }, DONE_CLEANUP_DELAY_MS);
  });

  return { infoHash, downloadId };
}

const resumingTorrents = new Set<string>();

export async function resumeActiveDownload(meta: any) {
  if (!meta || !meta.magnet || meta.done) return null;
  const infoHash = (meta.id || "").split(':')[0];
  if (!infoHash) return null;

  if (resumingTorrents.has(infoHash)) {
    const c = globalThis.__wtClient;
    return c ? await c.get(infoHash) : null;
  }

  resumingTorrents.add(infoHash);
  try {
    const client = await getClient();
    let torrent: any = await client.get(infoHash);
    if (!torrent) {
      const downloadsPath = getDownloadsPath();
      torrent = client.add(meta.magnet, {
        path: downloadsPath,
        announce: TRACKERS,
        maxConns: 200,
        uploads: 20,
        storeCacheSlots: 100,
      });

      meta.torrentRef = torrent;

      const fileIdx = meta.fileIdx;
      if (fileIdx !== undefined) {
        const applyFileSelection = () => {
          torrent.files.forEach((f: any) => {
            try { f.deselect(); } catch {}
          });
          if (torrent.files[fileIdx]) {
            try { torrent.files[fileIdx].select(); } catch {}
          }
        };
        if (torrent.ready) {
          applyFileSelection();
        } else {
          torrent.once("ready", applyFileSelection);
        }
      }

      torrent.on("error", (err: Error) => {
        console.error(`[TorrentFlix] Download error for "${meta.title}":`, err.message);
        meta.error = err.message;
      });

      torrent.on("done", () => {
        console.log(`[TorrentFlix] Download complete: "${meta.title}". Will free RAM in ${DONE_CLEANUP_DELAY_MS / 1000}s.`);
        meta.done = true;
        meta.completedAt = Date.now();
        meta.error = null;
        saveDownloadsState();
        setTimeout(async () => {
          try {
            const c = globalThis.__wtClient;
            if (c) {
              const liveT = await c.get(infoHash);
              if (liveT) {
                c.remove(infoHash, { destroyStore: false });
                console.log(`[TorrentFlix] Freed RAM for completed download: "${meta.title}"`);
              }
            }
            meta.torrentRef = null;
          } catch (e: any) {
            console.error(`[TorrentFlix] Failed to cleanup completed download:`, e?.message);
          }
        }, DONE_CLEANUP_DELAY_MS);
      });

      if (meta.paused) {
        torrent.pause();
      }
    } else {
      meta.torrentRef = torrent;
    }
    return torrent;
  } catch (err: any) {
    console.error(`[TorrentFlix] Failed to resume download "${meta.title}":`, err?.message);
    meta.error = err?.message;
    return null;
  } finally {
    resumingTorrents.delete(infoHash);
  }
}

export async function getAllDownloadsStats() {
  const downloads = getDownloadsMap();
  if (!downloads || downloads.size === 0) return [];

  const results = [];
  for (const [downloadId, meta] of downloads.entries()) {
    const infoHash = downloadId.split(':')[0];
    const fileIdxStr = downloadId.split(':')[1];
    const fileIdx = (fileIdxStr !== 'undefined' && fileIdxStr !== 'all') ? parseInt(fileIdxStr, 10) : undefined;

    // 1. Completed download whose torrent was freed from RAM or marked done
    if (meta.done || meta.completedAt) {
      results.push({
        id: downloadId,
        infoHash,
        magnet: meta.magnet || `magnet:?xt=urn:btih:${infoHash}`,
        title: meta.title,
        posterPath: meta.posterPath,
        name: meta.torrentName || meta.title,
        progress: 1,
        peers: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        downloaded: meta.fileLength || 0,
        length: meta.fileLength || 0,
        timeRemaining: 0,
        ready: true,
        done: true,
        paused: false,
        fileIdx: meta.fileIdx ?? 0,
        type: meta.type,
        tmdbId: meta.tmdbId,
        imdbId: meta.imdbId,
        season: meta.season,
        episode: meta.episode,
        episodeName: meta.episodeName,
      });
      continue;
    }

    // 2. Active or in-progress download: ensure WebTorrent client has it running
    let torrent: any = null;
    const client = globalThis.__wtClient;
    if (client) {
      torrent = await client.get(infoHash);
      if (!torrent && meta.torrentRef && !meta.torrentRef.destroyed) {
        torrent = meta.torrentRef;
      }
    }

    if (!torrent && !meta.error) {
      torrent = await resumeActiveDownload(meta);
    }

    // 3. Stored error or torrent destroyed while incomplete
    if (meta.error || (torrent && torrent.destroyed && !torrent.done)) {
      results.push({
        id: downloadId,
        infoHash,
        magnet: meta.magnet || `magnet:?xt=urn:btih:${infoHash}`,
        title: meta.title,
        posterPath: meta.posterPath,
        progress: torrent?.progress ?? 0,
        status: 'error',
        errorMessage: meta.error || 'Torrent was destroyed',
      });
      continue;
    }

    // 4. Waiting for metadata / connecting
    if (!torrent) {
      results.push({
        id: downloadId,
        infoHash,
        magnet: meta.magnet || `magnet:?xt=urn:btih:${infoHash}`,
        title: meta.title,
        posterPath: meta.posterPath,
        name: meta.torrentName || meta.title,
        progress: 0,
        peers: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        downloaded: 0,
        length: meta.fileLength || 0,
        timeRemaining: 0,
        ready: false,
        done: false,
        paused: Boolean(meta.paused),
        fileIdx: meta.fileIdx ?? 0,
        type: meta.type,
        tmdbId: meta.tmdbId,
        imdbId: meta.imdbId,
        season: meta.season,
        episode: meta.episode,
        episodeName: meta.episodeName,
      });
      continue;
    }

    let downloaded = torrent.downloaded ?? 0;
    let length = torrent.length ?? 0;
    let progress = torrent.progress ?? 0;
    let done = Boolean(torrent.done || progress >= 1);
    const ready = torrent.ready;

    const file = fileIdx !== undefined && torrent.files ? torrent.files[fileIdx] : undefined;
    
    if (ready && file) {
      downloaded = file.downloaded;
      length = file.length;
      progress = length > 0 ? downloaded / length : 0;
      done = progress === 1;
    }

    // Cache file info for when torrent is freed from RAM later
    if (ready && !meta.torrentName) {
      meta.torrentName = torrent.name;
      meta.fileLength = length;
    }

    if (done && !meta.done) {
      meta.done = true;
      meta.completedAt = Date.now();
      saveDownloadsState();
    }

    results.push({
      id: downloadId,
      infoHash: torrent.infoHash,
      magnet: meta.magnet || torrent.magnetURI || `magnet:?xt=urn:btih:${torrent.infoHash}`,
      title: meta.title,
      posterPath: meta.posterPath,
      name: torrent.name,
      progress,
      peers: torrent.numPeers ?? 0,
      downloadSpeed: torrent.downloadSpeed ?? 0,
      uploadSpeed: torrent.uploadSpeed ?? 0,
      downloaded,
      length: length || meta.fileLength || 0,
      timeRemaining: torrent.timeRemaining ?? 0,
      ready,
      done,
      paused: Boolean(torrent.paused || meta.paused),
      fileIdx: meta.fileIdx ?? 0,
      type: meta.type,
      tmdbId: meta.tmdbId,
      imdbId: meta.imdbId,
      season: meta.season,
      episode: meta.episode,
      episodeName: meta.episodeName,
    });
  }

  return results.sort((a, b) => {
    const aMeta = downloads.get(a.id);
    const bMeta = downloads.get(b.id);
    return (bMeta?.addedAt ?? 0) - (aMeta?.addedAt ?? 0);
  });
}

export async function pauseDownload(downloadId: string) {
  const downloads = getDownloadsMap();
  const meta = downloads.get(downloadId);
  if (meta) {
    meta.paused = true;
    saveDownloadsState();
  }
  const client = globalThis.__wtClient;
  if (!client) return;
  const infoHash = downloadId.split(':')[0];
  const torrent = await client.get(infoHash);
  if (torrent) torrent.pause();
}

export async function resumeDownload(downloadId: string) {
  const downloads = getDownloadsMap();
  const meta = downloads.get(downloadId);
  if (meta) {
    meta.paused = false;
    meta.error = null;
    saveDownloadsState();
  }
  const client = globalThis.__wtClient;
  if (client) {
    const infoHash = downloadId.split(':')[0];
    const torrent = await client.get(infoHash);
    if (torrent) {
      torrent.resume();
      return;
    }
  }
  if (meta) {
    await resumeActiveDownload(meta);
  }
}

export async function removeDownload(downloadId: string, deleteFiles: boolean = false) {
  const downloads = getDownloadsMap();
  if (!downloads) return;
  
  const meta = downloads.get(downloadId);
  if (!meta) return;
  
  downloads.delete(downloadId);
  saveDownloadsState();

  const infoHash = downloadId.split(':')[0];
  const hasOtherFiles = Array.from(downloads.keys()).some(k => k !== downloadId && k.startsWith(infoHash + ':'));
  
  if (!hasOtherFiles) {
    const client = globalThis.__wtClient;
    if (client) {
      const torrent = await client.get(infoHash);
      if (torrent) {
        await new Promise<void>((resolve) => {
          client.remove(infoHash, { destroyStore: deleteFiles }, () => resolve());
        });
      }
    }
    // If torrent was already freed from RAM, ensure files on disk are removed if requested
    if (deleteFiles && meta.torrentName) {
      try {
        const filePath = path.join(getDownloadsPath(), meta.torrentName);
        if (fs.existsSync(filePath)) {
          fs.rmSync(filePath, { recursive: true, force: true });
        }
      } catch (err) {
        console.error(`[TorrentFlix] Failed to delete file on disk:`, err);
      }
    }
  }
}

export async function retryDownload(downloadId: string) {
  const downloads = getDownloadsMap();
  if (!downloads) throw new Error("No downloads tracked");

  const meta = downloads.get(downloadId);
  if (!meta) throw new Error("Download not found");
  if (!meta.magnet) throw new Error("No magnet URI stored for this download");

  // Remove the old broken torrent
  const infoHash = downloadId.split(':')[0];
  const client = await getClient();
  const oldTorrent = await client.get(infoHash);
  if (oldTorrent) {
    await new Promise<void>((resolve) => {
      client.remove(infoHash, { destroyStore: true }, () => resolve());
    });
  }

  // Remove the old download entry
  downloads.delete(downloadId);

  // Re-start the download with the same parameters
  return startDownload(
    meta.magnet,
    meta.title,
    meta.posterPath,
    meta.fileIdx,
    meta.type,
    meta.tmdbId,
    meta.imdbId,
    meta.season,
    meta.episode,
    meta.episodeName,
  );
}
