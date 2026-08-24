/**
 * Server-side WebTorrent client (Node runtime).
 *
 * The browser <video> element streams from `/api/stream` while this client
 * fetches pieces over plain P2P (no proxy, no VPN). Keeps a small number of
 * torrents alive and reclaims idle ones.
 */
import { fileIsBrowserSafe, fileIsVideo } from "./utils";

const MAX_TORRENTS = 4;
const IDLE_TTL_MS = 30 * 60 * 1000; // 30 min

type AnyTorrent = any;
type AnyClient = any;

declare global {
  // eslint-disable-next-line no-var
  var __wtClient: AnyClient | undefined;
  // eslint-disable-next-line no-var
  var __wtAccess: Map<string, number> | undefined;
  // eslint-disable-next-line no-var
  var __wtCleanup: NodeJS.Timeout | undefined;
}

export async function getClient(): Promise<AnyClient> {
  if (!globalThis.__wtClient) {
    const mod = await import("webtorrent");
    const WebTorrent = (mod as any).default ?? mod;
    globalThis.__wtClient = new WebTorrent({ maxConns: 100 });
    globalThis.__wtAccess = new Map();
  }
  if (!globalThis.__wtCleanup) {
    globalThis.__wtCleanup = setInterval(() => {
      const access = globalThis.__wtAccess;
      if (!access || !globalThis.__wtClient) return;
      const now = Date.now();
      for (const t of globalThis.__wtClient.torrents as AnyTorrent[]) {
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
  const torrents = (client.torrents as AnyTorrent[]).slice();
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

/** Add a magnet, wait for metadata, return the best video file to stream. */
export async function startTorrent(magnet: string, opts: StartOptions = {}): Promise<StartedTorrent> {
  const client = await getClient();

  // v3 returns a Promise from get()
  let torrent: AnyTorrent | null = await client.get(magnet);
  if (!torrent) {
    torrent = client.add(magnet);
    evictIfNeeded(client);
  }
  touch(torrent.infoHash);

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

  const files: AnyTorrent[] = torrent.files ?? [];
  if (!files.length) throw new Error("Torrent has no files.");

  // Torrentio names the exact file for episode packs — trust it when valid.
  if (Number.isInteger(opts.fileIdx) && opts.fileIdx! >= 0 && opts.fileIdx! < files.length) {
    const f = files[opts.fileIdx!];
    const name: string = f.name ?? "";
    if (fileIsVideo(name)) {
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
  return {
    infoHash: torrent.infoHash,
    fileIdx: best.idx,
    fileName: best.f.name,
    fileSize: best.f.length ?? 0,
    browserSafe: best.browserSafe,
  };
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

export async function getTorrentStats(infoHash: string) {
  const client = globalThis.__wtClient;
  const torrent = client ? await client.get(infoHash) : null;
  if (!torrent) return null;
  touch(infoHash);
  return {
    infoHash: torrent.infoHash,
    name: torrent.name,
    progress: torrent.progress ?? 0,
    peers: torrent.numPeers ?? 0,
    downloadSpeed: torrent.downloadSpeed ?? 0,
    uploadSpeed: torrent.uploadSpeed ?? 0,
    downloaded: torrent.downloaded ?? 0,
    length: torrent.length ?? 0,
  };
}


/**
 * Build a web ReadableStream for a byte range of a torrent file.
 * webtorrent v3's stream is not compatible with Readable.toWeb, so pump it
 * manually with backpressure.
 */
export function fileRangeStream(file: AnyTorrent, start: number, end: number): ReadableStream {
  const nodeStream: import("stream").Readable = file.createReadStream({ start, end });
  let paused = false;
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => {
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
      });
      nodeStream.on("error", (err: Error) => {
        try {
          controller.error(err);
        } catch {}
      });
    },
    pull() {
      if (paused) {
        paused = false;
        nodeStream.resume();
      }
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}
