import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from "react-native";
import Video, { VideoRef } from "react-native-video";
import {
  ArrowLeft,
  Cpu,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Users,
} from "lucide-react-native";
import { DeviceProfiler } from "../services/DeviceProfiler";
import { TorrentEngine } from "../services/TorrentEngine";
import { getProgress, saveProgress } from "../lib/store";
import type { DeviceProfile, PlayTarget, StreamStats, TorrentResult } from "../lib/types";

interface Props {
  target: PlayTarget;
  source: TorrentResult;
  onExit: () => void;
}

export const PlayerScreen: React.FC<Props> = ({ target, source, onExit }) => {
  const videoRef = useRef<VideoRef>(null);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const hasResumedRef = useRef(false);
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [stats, setStats] = useState<StreamStats>({
    infoHash: "",
    progress: 0,
    peers: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    bufferAheadSeconds: 0,
  });
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        // 1. Check TV hardware specifications
        const p = await DeviceProfiler.getProfile();
        if (mounted) setProfile(p);

        // 2. Start torrent streaming engine with TV-appropriate buffer & peer limits
        const res = await TorrentEngine.startStream(source);
        if (mounted) {
          setStreamUrl(res.streamUrl);
          setLoading(false);
          showToast(
            p.useHardwareDecoding
              ? "TV Constraint Detected: Native ExoPlayer Hardware Decoding engaged."
              : "High-Spec TV Detected: Standard Flexible Decoding active."
          );
        }
      } catch (e) {
        console.warn("PlayerScreen init error:", e);
      }
    }
    init();

    // Stats polling
    const timer = setInterval(() => {
      if (mounted) {
        setStats(TorrentEngine.getStats());
      }
    }, 1500);

    return () => {
      mounted = false;
      clearInterval(timer);
      if (currentTimeRef.current > 5 && durationRef.current > 0) {
        saveProgress(target.tmdbId, currentTimeRef.current, durationRef.current, target.title);
      }
      TorrentEngine.stopStream();
    };
  }, [source]);

  const handleSeek = (deltaSeconds: number) => {
    const next = Math.max(0, Math.min(duration, currentTime + deltaSeconds));
    videoRef.current?.seek(next);
    showToast(`${deltaSeconds > 0 ? "+" : ""}${deltaSeconds}s`);
  };


  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const speedMb = (stats.downloadSpeed / (1024 * 1024)).toFixed(1);

  return (
    <View style={styles.container}>
      {streamUrl && (
        <Video
          ref={videoRef}
          source={{ uri: streamUrl }}
          style={styles.video}
          paused={paused}
          resizeMode="contain"
          // Conditional hardware decoding based on TV specification:
          // Low-RAM TVs use direct SurfaceView hardware decoding to prevent CPU lag
          useTextureView={profile ? !profile.useHardwareDecoding : false}
          bufferConfig={{
            minBufferMs: profile ? (profile.tier === "constrained" ? 5000 : 15000) : 10000,
            maxBufferMs: profile ? (profile.tier === "constrained" ? 25000 : 50000) : 30000,
            bufferForPlaybackMs: 2500,
            bufferForPlaybackAfterRebufferMs: 4000,
          }}
          onProgress={(e) => {
            setCurrentTime(e.currentTime);
            currentTimeRef.current = e.currentTime;
            if (e.currentTime > 5 && duration > 0) {
              saveProgress(target.tmdbId, e.currentTime, duration, target.title);
            }
          }}
          onLoad={async (e) => {
            setDuration(e.duration);
            durationRef.current = e.duration;
            setLoading(false);
            if (!hasResumedRef.current) {
              hasResumedRef.current = true;
              const saved = await getProgress(target.tmdbId);
              if (saved?.position && saved.position > 10 && saved.position < e.duration - 15) {
                videoRef.current?.seek(saved.position);
                showToast(`Resumed from ${formatSeconds(saved.position)}`);
              }
            }
          }}
        />
      )}

      {loading && (
        <View style={styles.centerOverlay}>
          <ActivityIndicator size="large" color="#E50914" />
          <Text style={styles.loadingText}>
            Connecting to swarm & preparing stream...
          </Text>
        </View>
      )}

      {/* Toast Notification */}
      {toast && (
        <View style={styles.toastBox}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* 10-Foot TV Remote Overlay Controls */}
      {controlsVisible && (
        <View style={styles.overlay}>
          {/* Top Bar: Title & TV Hardware Decoding Badge */}
          <View style={styles.topBar}>
            <TouchableHighlight
              onPress={onExit}
              underlayColor="#222"
              style={styles.backBtn}
            >
              <View style={styles.btnRow}>
                <ArrowLeft size={16} color="#fff" />
                <Text style={styles.btnText}>Exit</Text>
              </View>
            </TouchableHighlight>

            <View style={styles.titleBox}>
              <Text numberOfLines={1} style={styles.mediaTitle}>
                {target.title} {target.season && `(S${target.season} E${target.episode})`}
              </Text>
              <Text style={styles.streamQualityBadge}>{source.quality}</Text>
            </View>

            {/* Spec-Adaptive Decoding Badge */}
            <View style={styles.decodingBadge}>
              <Cpu
                size={12}
                color={profile?.useHardwareDecoding ? "#46d369" : "#3178C6"}
              />
              <Text
                style={[
                  styles.decodingText,
                  { color: profile?.useHardwareDecoding ? "#46d369" : "#3178C6" },
                ]}
              >
                {profile?.useHardwareDecoding
                  ? "ExoPlayer Hardware VPU (Low-Spec Mode)"
                  : "Flexible Software Mode (High-Spec)"}
              </Text>
            </View>
          </View>

          {/* Telemetry Swarm HUD Bar */}
          <View style={styles.hudBar}>
            <View style={styles.hudItem}>
              <Gauge size={13} color="#fff" />
              <Text style={styles.hudText}>{speedMb} MB/s</Text>
            </View>
            <View style={styles.hudItem}>
              <Users size={13} color="#46d369" />
              <Text style={styles.hudText}>{stats.peers} seeders</Text>
            </View>
            <View style={styles.hudItem}>
              <Text style={styles.hudLabel}>Buffer Ahead:</Text>
              <Text style={styles.hudText}>{stats.bufferAheadSeconds || 45}s</Text>
            </View>
            <View style={styles.hudItem}>
              <Text style={styles.hudLabel}>Ring Buffer Cap:</Text>
              <Text style={styles.hudText}>{profile?.rollingBufferMb || 200} MB</Text>
            </View>
          </View>

          {/* Bottom Bar: Timeline & D-Pad Remote Instructions */}
          <View style={styles.bottomBar}>
            <View style={styles.timelineRow}>
              <Text style={styles.timeText}>{formatSeconds(currentTime)}</Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${
                        duration > 0 ? (currentTime / duration) * 100 : 0
                      }%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.timeText}>{formatSeconds(duration)}</Text>
            </View>

            {/* Remote Shortcuts Legend */}
            <View style={styles.remoteLegend}>
              <TouchableHighlight
                onPress={() => setPaused(!paused)}
                underlayColor="#222"
                style={styles.remoteKey}
              >
                <View style={styles.keyRow}>
                  {paused ? <Play size={12} color="#fff" fill="#fff" /> : <Pause size={12} color="#fff" />}
                  <Text style={styles.keyText}>OK (Play/Pause)</Text>
                </View>
              </TouchableHighlight>

              <TouchableHighlight
                onPress={() => handleSeek(-10)}
                underlayColor="#222"
                style={styles.remoteKey}
              >
                <Text style={styles.keyText}>◀ 10s</Text>
              </TouchableHighlight>

              <TouchableHighlight
                onPress={() => handleSeek(10)}
                underlayColor="#222"
                style={styles.remoteKey}
              >
                <Text style={styles.keyText}>10s ▶</Text>
              </TouchableHighlight>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 14,
  },
  toastBox: {
    position: "absolute",
    top: 70,
    alignSelf: "center",
    backgroundColor: "rgba(20, 20, 20, 0.95)",
    borderColor: "#E50914",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    zIndex: 200,
  },
  toastText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: 30,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  btnText: {
    color: "#fff",
    fontSize: 12,
  },
  titleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mediaTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  streamQualityBadge: {
    backgroundColor: "#E50914",
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  decodingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  decodingText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  hudBar: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 20,
    backgroundColor: "rgba(10, 10, 10, 0.8)",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  hudItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hudLabel: {
    color: "#888",
    fontSize: 11,
  },
  hudText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  bottomBar: {
    width: "100%",
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  timeText: {
    color: "#aaa",
    fontSize: 11,
    width: 45,
    textAlign: "center",
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#E50914",
  },
  remoteLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  remoteKey: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  keyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  keyText: {
    color: "#ddd",
    fontSize: 11,
  },
});
