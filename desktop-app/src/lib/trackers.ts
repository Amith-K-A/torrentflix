/**
 * Public tracker announce URLs appended to every magnet URI.
 * Includes WebRTC (wss://) trackers so browser peers can find the swarm too.
 */
export const DHT_BOOTSTRAP_NODES: string[] = [
  "router.bittorrent.com:6881",
  "router.utorrent.com:6881",
  "dht.transmissionbt.com:6881",
  "dht.libtorrent.org:25401",
  "dht.aelitis.com:6881",
];

export const TRACKERS: string[] = [
  // WebRTC trackers (browser peers)
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.btorrent.xyz",
  "wss://tracker.webtorrent.dev",
  "wss://tracker.files.fm:7073/announce",
  // UDP trackers (fastest for Node.js)
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
  "udp://tracker.openbittorrent.com:80/announce",
  "udp://tracker.tiny-vps.com:6969/announce",
  "udp://tracker.pomf.se:80/announce",
  "udp://p4p.arenabg.com:1337/announce",
  "udp://movies.zsw.ca:6969/announce",
  "udp://open.tracker.cl:1337/announce",
  "udp://tracker.filemail.com:6969/announce",
  "udp://tracker.bittor.pw:1337/announce",
  "udp://tracker.swateam.org.uk:2710/announce",
  "udp://tracker.cyberia.is:6969/announce",
  "udp://ipv4.tracker.harry.lu:80/announce",
  "udp://retracker.lanta-net.ru:2710/announce",
  // HTTP / HTTPS trackers (fallback when UDP is restricted by ISP/firewall)
  "http://tracker.opentrackr.org:1337/announce",
  "http://tracker.openbittorrent.com:80/announce",
  "https://tracker.nanoha.org:443/announce",
  "https://tracker.loligirl.cn:443/announce",
  "https://tracker.tamersunion.org:443/announce",
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
