<p align="center">
  <a href="https://github.com/Amith-K-A/torrentflix">
    <img src="public/logo.png" alt="TorrentFlix Logo" width="120" height="120" style="border-radius: 24px; margin-bottom: 12px;" />
  </a>
</p>

<h1 align="center">TorrentFlix 🎬⚡</h1>

<p align="center">
  <strong>A premium, Netflix-style streaming experience for Movies & TV Shows powered by WebTorrent P2P & TMDB metadata.</strong>
  <br />
  <em>Stream instantly while downloading with zero wait time, 4K/1080p quality selection, real-time subtitle sync, and dedicated desktop & web apps.</em>
</p>

<p align="center">
  <a href="https://github.com/Amith-K-A/torrentflix/releases/latest">
    <img src="https://img.shields.io/github/v/release/Amith-K-A/torrentflix?color=E50914&label=Latest%20Release&logo=github&style=for-the-badge" alt="Latest Release" />
  </a>
  <a href="https://github.com/Amith-K-A/torrentflix/releases/latest/download/TorrentFlix-0.1.0-arm64.dmg">
    <img src="https://img.shields.io/badge/macOS%20DMG-Apple%20Silicon-black?style=for-the-badge&logo=apple&logoColor=white" alt="macOS DMG Download" />
  </a>
  <img src="https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/Electron-44-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/Android_TV-React_Native-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android TV" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
</p>

---

## 📥 Downloads & Applications

Enjoy standalone native playback with persistent storage, background downloading, and zero external server requirements:

<table>
  <thead>
    <tr>
      <th>Platform</th>
      <th>Target / Architecture</th>
      <th>Type</th>
      <th>Link</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>macOS</strong> (Sonoma, Ventura, Monterey)</td>
      <td>Apple Silicon (<code>M1 / M2 / M3 / M4</code>)</td>
      <td><code>.dmg</code></td>
      <td>
        <a href="https://github.com/Amith-K-A/torrentflix/releases/latest/download/TorrentFlix-0.1.0-arm64.dmg">
          <strong>⬇️ Download TorrentFlix-0.1.0-arm64.dmg</strong>
        </a>
      </td>
    </tr>
    <tr>
      <td><strong>Android TV / Google TV / Fire TV</strong></td>
      <td>ARM / Android TV (API 26+)</td>
      <td>React Native Leanback App</td>
      <td>
        <a href="android-tv-app/">
          <strong>📺 View Android TV App & Setup</strong>
        </a>
      </td>
    </tr>
  </tbody>
</table>

> 📌 **Looking for all releases and tags?** Visit the [**GitHub Releases Page**](https://github.com/Amith-K-A/torrentflix/releases).

### 🛠️ macOS Installation Guide

1. Download the latest [**TorrentFlix-0.1.0-arm64.dmg**](https://github.com/Amith-K-A/torrentflix/releases/latest/download/TorrentFlix-0.1.0-arm64.dmg).
2. Double-click the `.dmg` file and drag **TorrentFlix.app** into your **Applications** folder.
3. **If macOS Gatekeeper flags the app as unsigned or unverified:**
   Run this single command in your macOS Terminal:
   ```bash
   xattr -cr /Applications/TorrentFlix.app
   ```
4. Launch **TorrentFlix** from your Applications or Spotlight search.

---

## ✨ Features

- 🎭 **Netflix-Grade User Experience**:
  - Immersive hero billboard with video trailers and backdrop art
  - Interactive poster rows with smooth hover previews and quick actions
  - Full-featured TV Show season & episode drawer with watched checkmarks
  - Multi-language catalog browser covering **14+ languages** (English, Korean, Japanese, Spanish, Hindi, Tamil, Telugu, Malayalam, French, etc.)

- ⚡ **Instant Sequential P2P Streaming**:
  - Starts playback within seconds using sequential piece ordering
  - Full HTTP 206 Partial Content range requests for instant seeking backwards and forwards
  - Mid-stream quality switcher (2160p / 4K, 1080p, 720p)
  - Codec intelligence: automatically prioritizes browser-safe MP4 / AAC streams

- 💬 **Live Subtitle Sync Engine**:
  - Automatic `.srt` and `.vtt` subtitle loading
  - Built-in real-time offset hotkeys: adjust subtitle timing by `±0.5s` on the fly without restarting

- 📊 **Real-Time Swarm Telemetry**:
  - In-player HUD showing live download speeds, connected peer count, and cache percentage
  - Visual cached ranges buffer bar

- 💾 **Integrated Download Manager (`/downloads`)**:
  - Download full movies and TV episodes directly to `~/Downloads/TorrentFlix`
  - Real-time circular progress indicators, download speed, ETA, and peer stats
  - Pause, resume, copy magnet links, and play downloaded files offline

- 🛡️ **Anti-Censorship & Regional ISP Bypass**:
  - Torrent discovery powered by Torrentio API with automated fallbacks to YTS and 1337x mirrors
  - Optional `PROXY_URL` (SOCKS5/HTTP) support: routes search requests through a proxy while video streaming remains direct peer-to-peer (no proxy bandwidth bottlenecks)

- ⏱️ **Watchlist & Resume Playback**:
  - Continue watching carousel that automatically restores your exact timestamp
  - Persistent disk & browser state syncing (`~/Downloads/TorrentFlix/.store.json`)

---

## ⌨️ Player Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Play / Pause |
| <kbd>→</kbd> | Seek forward 10 seconds |
| <kbd>←</kbd> | Seek backward 10 seconds |
| <kbd>F</kbd> | Toggle Fullscreen |
| <kbd>M</kbd> | Toggle Mute |
| <kbd>[</kbd> | Delay subtitles by `-0.5s` |
| <kbd>]</kbd> | Advance subtitles by `+0.5s` |
| <kbd>0</kbd> | Reset subtitle sync to `0.0s` |
| <kbd>Esc</kbd> | Exit player or close quality/source menu |

---

## 🏗️ Architecture & How It Works

```
Browser / Electron Window
       │
       │  HTTP Range Requests (206 Partial Content)
       ▼
Local Next.js Streaming Server (/api/stream)
       │
       │  Sequential Chunk Prioritization
       ▼
WebTorrent / Python Torrent Daemon (libtorrent)
       │
       │  Direct P2P Swarm Connection (No proxy)
       ▼
BitTorrent Swarm (Peers & Seeders)
```

1. **Discovery**: When you select a title, TorrentFlix queries Torrentio, YTS, and 1337x mirrors in parallel to find the highest-seeded, most compatible torrents.
2. **Sequential Piece Fetching**: WebTorrent requests the beginning of the video file first and keeps an ahead-of-time buffer.
3. **Range Seeking**: When scrubbing the progress bar, HTTP 206 partial range requests instruct the streaming engine to prioritize pieces at the target offset immediately.
4. **Data Persistence**: Watch progress, download queues, and settings are saved to `~/Downloads/TorrentFlix/.store.json` for reliable persistence across app restarts.

---

## 🚀 Web App Setup (Run from Source)

### Prerequisites

- **Node.js**: v18.18+ or v20+ recommended
- **TMDB API Key**: Free account at [themoviedb.org](https://www.themoviedb.org/signup)

### 1. Clone the repository

```bash
git clone https://github.com/Amith-K-A/torrentflix.git
cd torrentflix
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required: Get your free API key from themoviedb.org -> Settings -> API
TMDB_API_KEY=your_tmdb_api_key_here

# Optional: HTTP or SOCKS5 proxy for torrent search (useful if torrent sites are blocked by your ISP)
# Note: Video streaming traffic is direct P2P and will NOT route through this proxy.
# PROXY_URL=socks5://127.0.0.1:1080
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🖥️ Building the Desktop App from Source

To package the Electron desktop app and create the macOS `.dmg`:

```bash
cd desktop-app
npm install
npm run desktop:build
```

The output installer will be generated in `desktop-app/dist-desktop/TorrentFlix-0.1.0-arm64.dmg`.

---

## 🧰 Tech Stack

- **Frontend**: [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Desktop**: [Electron 44](https://www.electronjs.org/), [Electron Builder](https://www.electron.build/)
- **Torrent Engine**: [WebTorrent](https://webtorrent.io/), Python libtorrent daemon (`torrentd.py`)
- **Metadata & Scrapers**: [TheMovieDatabase (TMDB) API](https://developer.themoviedb.org/), [Torrentio](https://torrentio.strem.fun), Cheerio, Axios
- **Subtitle Parser**: Custom WebVTT parser & subtitle offset synchronizer

---

## ⚖️ Legal Disclaimer

TorrentFlix is an open-source educational project developed for personal research into peer-to-peer streaming protocols and metadata indexing. 

- TorrentFlix **does not host, store, or distribute any media files or torrents**.
- All media metadata is fetched through public third-party APIs (TMDB).
- Torrent discovery relies entirely on public trackers and external scrapers.
- Users are solely responsible for adhering to their local copyright laws and regulations.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/Amith-K-A">Amith K A</a>
</p>
