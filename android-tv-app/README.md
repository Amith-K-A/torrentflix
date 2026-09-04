# TorrentFlix for Android TV 📺⚡

A **100% standalone, self-contained React Native application** for **Android TV, Google TV, and Amazon Fire TV**. 

Designed for 10-foot TV screens with complete **D-pad remote control navigation**, **spec-adaptive hardware decoding**, and an on-device **sliding ring-buffer** that streams movies and shows with zero external server required.

---

## 🌟 Key Architecture Highlights

1. **Zero External Server Required**:
   - Runs directly on your TV or streaming stick (Fire TV, Nvidia Shield, Chromecast with Google TV, Mi Box).
   - Searches TMDB and torrent providers (Torrentio, YTS) directly from the TV.
   - Embedded streaming engine serves video via local HTTP 206 partial content range requests.

2. **Spec-Aware Adaptive Decoding**:
   - **High-End TVs (Nvidia Shield, Apple TV class / 3GB+ RAM)**: Uses flexible software rendering with an expanded 350 MB buffer.
   - **Constrained TVs (Fire TV Stick Lite, 1GB–1.5GB RAM smart TVs)**: Automatically engages **Native Hardware Decoding via ExoPlayer (MediaCodec VPU)** because the TV's CPU cannot decode video in software without stuttering or crashing.
   - **Customizable**: Override anytime in TV Settings (`Auto`, `Force Hardware`, `Force Software`).

3. **Sliding Ring-Buffer (Storage Protection)**:
   - TV storage is small (usually <2 GB free).
   - TorrentFlix **never saves the full movie** to internal storage.
   - It maintains a tight rolling buffer (120 MB – 250 MB) and purges chunks as soon as they have been watched.

4. **10-Foot Leanback Interface**:
   - Full D-Pad Remote Navigation (Up, Down, Left, Right, OK/Select, Back).
   - Animated 1.08x card scaling and red focus glow borders.
   - Hero spotlight billboard with trailers and metadata.
   - Season and episode browser with watched checkmarks.
   - Multi-language catalog covering 14+ languages (Hindi, Telugu, Tamil, Malayalam, Kannada, Korean, Japanese, Spanish, etc.).

---

## 🎮 TV Remote Control Mapping

| Remote Key | Action |
| :--- | :--- |
| **D-Pad Directional (▲ ▼ ◀ ▶)** | Navigate focus between cards, tabs, and buttons |
| **Center / OK / Select** | Play / Pause video or select item |
| **◀ (Left arrow in player)** | Jump backward 10 seconds |
| **▶ (Right arrow in player)** | Jump forward 10 seconds |
| **Back Button** | Exit player or return to previous tab |
| **Menu / Settings** | Hardware diagnostics & buffer controls |

---

## 🚀 Development & Running on TV

### Prerequisites

1. **Android SDK**: Set `ANDROID_HOME` in your environment (e.g., `~/Library/Android/sdk`).
2. **Node.js**: v18+ or v20+.

### 1. Install dependencies

```bash
cd android-tv-app
npm install
```

### 2. Connect to your Android TV via ADB

Enable Developer Options and Network Debugging on your Android TV:

```bash
# Connect to TV's IP address (e.g. 192.168.1.105)
adb connect 192.168.1.105:5555
```

Verify the TV is recognized:

```bash
adb devices
```

### 3. Run the App on Android TV

```bash
npm run android
```

---

## 📦 Sideloading the APK onto Firestick or Android TV

If installing the compiled APK directly:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Or copy the APK to a USB drive / use apps like **Send Files to TV** or **Downloader**.
