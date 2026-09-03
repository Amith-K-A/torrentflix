/**
 * Public tracker announce URLs appended to every magnet URI.
 * Includes WebRTC (wss://) trackers so browser peers can find the swarm too.
 */
export const TRACKERS: string[] = [
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.btorrent.xyz",
  "wss://tracker.webtorrent.dev",
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.demonii.com:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.moeking.me:6969/announce",
  "udp://tracker.theoks.net:6969/announce",
  "udp://explodie.org:6969/announce",
  "udp://tracker1.bt.moack.co.kr:80/announce",
  "udp://tracker.dler.org:6969/announce",
  "udp://opentracker.io:6969/announce",
  "udp://tracker.openbittorrent.com:6969/announce",
];

export function buildMagnet(infoHash: string, name: string): string {
  const dn = encodeURIComponent(name);
  const tr = TRACKERS.map((t) => `tr=${encodeURIComponent(t)}`).join("&");
  return `magnet:?xt=urn:btih:${infoHash}&dn=${dn}&${tr}`;
}

export function infoHashFromMagnet(magnet: string): string | null {
  const m = magnet.match(/urn:btih:([a-z0-9]{40})/i) || magnet.match(/urn:btih:([a-z2-7]{32})/i);
  return m ? m[1].toLowerCase() : null;
}
