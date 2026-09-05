/**
 * Subtitle Auto-Sync Engine
 * Intelligently scores and selects the best matching subtitle for the exact
 * torrent release, format, and audio stream being played, avoiding desync issues
 * caused by picking CAM/TELESYNC or mismatched release groups.
 */

export interface SubtitleItem {
  id: string;
  url: string;
  lang: string;
  subtitleFileName?: string;
  movieReleaseName?: string;
  releaseGroup?: string;
  fpsMilli?: number;
  season?: number;
  episode?: number;
}

function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function scoreSubtitleMatch(
  sub: SubtitleItem,
  releaseName: string,
  fileName?: string
): number {
  const targetText = normalize(`${releaseName} ${fileName || ""}`);
  const subText = normalize(
    `${sub.subtitleFileName || ""} ${sub.movieReleaseName || ""} ${sub.releaseGroup || ""}`
  );

  let score = 0;

  // 1. Heavy penalty for CAM / TELESYNC / TS / HDTS if target is not CAM
  const isTargetCam = /\b(cam|telesync|hdts|hdcam|ts)\b/.test(targetText);
  const isSubCam = /\b(cam|telesync|hdts|hdcam|ts|syncup)\b/.test(subText);
  if (isSubCam && !isTargetCam) {
    score -= 1000;
  }
  if (!isSubCam && isTargetCam) {
    score -= 500;
  }

  // 2. Release groups matching
  const knownGroups = [
    "yts", "yify", "amzn", "edith", "flux", "rarbg", "eztv", "megusta",
    "ntb", "psa", "galaxyrg", "etrg", "byndr", "kyogo", "geonoir",
    "grace", "lootera", "bone", "syncup", "bhd", "fra", "framestor", "qxr"
  ];
  for (const group of knownGroups) {
    if (targetText.includes(group) && subText.includes(group)) {
      score += 150;
    }
  }

  // Exact group check from sub.releaseGroup
  if (sub.releaseGroup) {
    const grp = normalize(sub.releaseGroup);
    if (grp.length > 2 && targetText.includes(grp)) {
      score += 200;
    }
  }

  // 3. Source match (WEB-DL, WEBRip, BluRay, HDTV)
  const isTargetWeb = /\b(web|webrip|web dl|webdl)\b/.test(targetText);
  const isSubWeb = /\b(web|webrip|web dl|webdl)\b/.test(subText);
  if (isTargetWeb && isSubWeb) score += 60;

  const isTargetBluray = /\b(bluray|bdrip|brrip|remux)\b/.test(targetText);
  const isSubBluray = /\b(bluray|bdrip|brrip|remux)\b/.test(subText);
  if (isTargetBluray && isSubBluray) score += 60;

  // 4. Resolution match
  const resList = ["2160p", "4k", "1080p", "720p", "480p"];
  for (const r of resList) {
    if (targetText.includes(r) && subText.includes(r)) {
      score += 30;
    }
  }

  // 5. Codec match (x264, x265, hevc)
  if (
    (targetText.includes("x265") || targetText.includes("hevc")) &&
    (subText.includes("x265") || subText.includes("hevc"))
  ) {
    score += 20;
  }
  if (targetText.includes("x264") && subText.includes("x264")) {
    score += 20;
  }

  // 6. Token overlap
  const targetTokens = targetText.split(/\s+/).filter((t) => t.length > 2);
  let overlap = 0;
  for (const t of targetTokens) {
    if (subText.includes(t)) overlap++;
  }
  score += overlap * 5;

  return score;
}

export function pickBestSubtitle(
  subtitles: SubtitleItem[],
  releaseName: string,
  fileName?: string
): SubtitleItem | null {
  const eng = subtitles.filter(
    (s) => s.lang === "eng" || s.lang === "en" || s.lang === "en-US"
  );
  if (eng.length === 0) return null;

  let bestSub: SubtitleItem = eng[0];
  let bestScore = -Infinity;

  for (const sub of eng) {
    const s = scoreSubtitleMatch(sub, releaseName, fileName);
    if (s > bestScore) {
      bestScore = s;
      bestSub = sub;
    }
  }

  return bestSub;
}
