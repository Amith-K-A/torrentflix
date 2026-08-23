# TorrentFlix 🎬⚡

A Netflix-style streaming web app that searches torrents for movies & TV shows
and plays them instantly while they download — powered by TMDB metadata and
WebTorrent P2P.

## Features

- **Netflix-style UI** — hero billboard, hoverable poster rows, dark theme
- **TMDB catalog** — trending, popular, top-rated, search, season/episode browsers
- **One-click streaming** — finds the best-seeded torrent automatically and
  plays it in a custom video player while it downloads
- **Quality switcher** — swap between 2160p / 1080p / 720p mid-session
- **Subtitle support** — load any `.srt`/`.vtt` (SRT is auto-converted)
- **My List + episode tracking** — watchlist, watched checkmarks, resume
  playback where you left off (stored locally in your browser)
- **India-friendly** — torrent *discovery* uses Torrentio (not ISP-blocked)
  plus YTS/1337x mirror fallbacks and an optional `PROXY_URL`; streaming
  itself is direct P2P and never proxied

## Setup

```bash
npm install
```

1. Create a free TMDB account at [themoviedb.org](https://www.themoviedb.org/signup)
2. Go to **Settings → API → Request an API Key** (choose Developer)
3. Copy `.env.example` to `.env.local` and paste your key:

```env
TMDB_API_KEY=your_key_here
```

4. Start it:

```bash
npm run dev
# open http://localhost:3000
```

### Optional: proxy for torrent search (India / blocked ISPs)

Torrent *metadata* comes from [Torrentio](https://torrentio.strem.fun) which is
usually reachable, with YTS + 1337x mirrors as fallback. If everything is
blocked on your network, point `PROXY_URL` at any HTTP/SOCKS proxy and only
the search requests will go through it — video streaming never does:

```env
PROXY_URL=socks5://127.0.0.1:1080
```

## How streaming works

```
Browser ──HTTP range──▶ /api/stream ──▶ Node WebTorrent client ──P2P──▶ swarm
   ▲                                                            (no proxy)
   └────────── video plays while pieces download ───────────────┘
```

1. Click **Play** → app searches Torrentio / YTS / 1337x for the title's torrents
2. Best-seeded torrent is started server-side (metadata only takes a few seconds)
3. The `<video>` element streams from `/api/stream` with full seek support
4. Download speed, peers, and cache % are shown live in the player

> **Note:** torrents with 0 seeders can't stream — pick another quality/source
> in the player's source switcher if playback stalls. MKV files may not decode
> in some browsers; MP4 sources are preferred automatically.

## Legal

This project is for **educational and personal use**. It hosts no content and
indexes nothing itself. You are responsible for complying with the copyright
laws of your region.

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS v4**
- **webtorrent** (Node client for P2P streaming with HTTP range support)
- **axios + cheerio** (Torrentio API, YTS mirrors, 1337x scrape fallback)
- **TMDB** for all movie/TV metadata
