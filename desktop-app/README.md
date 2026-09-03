<p align="center">
  <a href="https://github.com/Amith-K-A/torrentflix">
    <img src="public/logo.png" alt="TorrentFlix Logo" width="120" height="120" style="border-radius: 24px; margin-bottom: 12px;" />
  </a>
</p>

<h1 align="center">TorrentFlix Desktop 🎬⚡</h1>

<p align="center">
  <strong>Native macOS Desktop App for TorrentFlix — powered by Electron, WebTorrent & libtorrent.</strong>
  <br />
  <em>Enjoy zero-wait P2P streaming, background downloads, persistent library store, and full-screen Netflix-grade playback.</em>
</p>

<p align="center">
  <a href="https://github.com/Amith-K-A/torrentflix/releases/latest">
    <img src="https://img.shields.io/github/v/release/Amith-K-A/torrentflix?color=E50914&label=Latest%20Release&logo=github&style=for-the-badge" alt="Latest Release" />
  </a>
  <a href="https://github.com/Amith-K-A/torrentflix/releases/latest/download/TorrentFlix-0.1.0-arm64.dmg">
    <img src="https://img.shields.io/badge/macOS%20DMG-Apple%20Silicon-black?style=for-the-badge&logo=apple&logoColor=white" alt="macOS DMG Download" />
  </a>
  <img src="https://img.shields.io/badge/Electron-44-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js" alt="Next.js 16" />
</p>

---

## 📥 Download for macOS

<table>
  <thead>
    <tr>
      <th>Platform</th>
      <th>Architecture</th>
      <th>Installer Type</th>
      <th>Download Link</th>
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
  </tbody>
</table>

> 📌 **Looking for all releases and tags?** Visit the [**GitHub Releases Page**](https://github.com/Amith-K-A/torrentflix/releases).

### 🛠️ Installation & Gatekeeper Fix

1. Download [**TorrentFlix-0.1.0-arm64.dmg**](https://github.com/Amith-K-A/torrentflix/releases/latest/download/TorrentFlix-0.1.0-arm64.dmg).
2. Open the `.dmg` and drag **TorrentFlix.app** into `/Applications`.
3. If macOS displays *"Apple cannot verify the developer"* or *"App is damaged"*:
   ```bash
   xattr -cr /Applications/TorrentFlix.app
   ```
4. Open **TorrentFlix** and enjoy!

---

## 🛠️ Development & Building from Source

```bash
# Install dependencies
npm install

# Run in Electron dev mode
npm run dev
npm run electron

# Build macOS DMG installer
npm run desktop:build
```

The compiled DMG will be saved to `dist-desktop/TorrentFlix-0.1.0-arm64.dmg`.
