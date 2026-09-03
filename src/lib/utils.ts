export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function tmdbImg(
  path: string | null | undefined,
  size: "w200" | "w300" | "w500" | "w780" | "w1280" | "original" = "w500"
): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/** Convert SRT to WebVTT (if needed) and inject cue position settings */
export function parseSubtitles(text: string, isSrt: boolean): string {
  let body = text.replace(/\r+/g, "").replace(/^\uFEFF/, "");

  // Normalize SRT timestamp commas to WebVTT periods
  body = body.replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");

  if (!body.startsWith("WEBVTT")) {
    body = `WEBVTT\n\n${body}`;
  }

  // Inject positioning to lift subtitles up from the bottom edge (avoiding overlap with bottom control bar)
  body = body.replace(
    /(\d{1,2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}\.\d{3})(.*)/g,
    (match, times, existingSettings) => {
      if (/line:/.test(existingSettings)) {
        return match;
      }
      return `${times} line:84% position:50% align:center`;
    }
  );

  return body;
}

export function qualityRank(q: string): number {
  if (/2160|4k/i.test(q)) return 4;
  if (/1080/i.test(q)) return 3;
  if (/720/i.test(q)) return 2;
  if (/480/i.test(q)) return 1;
  return 0;
}

export const VIDEO_EXTENSIONS = ["mp4", "webm", "m4v", "mkv", "avi", "mov"];

export function fileIsVideo(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_EXTENSIONS.includes(ext);
}

/** Browsers can play mp4/webm/m4v natively; mkv/avi are hit-or-miss. */
export function fileIsBrowserSafe(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "webm", "m4v", "mov"].includes(ext);
}

/**
 * How likely a browser is to decode a stream, judged from the release name.
 * Lower is better. TV sources skew HEVC/x265 in MKV, which most browsers
 * can't decode — prefer x264/H.264 in an MP4 container when one is seeded.
 */
export function playabilityRank(name: string): number {
  const n = name.toLowerCase();
  if (/x265|h\.?265|hevc/.test(n)) return 3;
  if (/xvid|divx/.test(n)) return 3;
  if (/x264|h\.?264|avc/.test(n)) return 0;
  const ext = n.split(".").pop() ?? "";
  if (["mp4", "webm", "m4v"].includes(ext)) return 0;
  if (ext === "mkv") return 2;
  if (ext === "avi") return 3;
  return 1;
}

export function contentTypeFor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "mp4":
    case "m4v":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mkv":
      return "video/x-matroska";
    case "mov":
      return "video/quicktime";
    case "avi":
      return "video/x-msvideo";
    default:
      return "application/octet-stream";
  }
}
