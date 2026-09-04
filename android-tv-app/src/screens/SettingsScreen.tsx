import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from "react-native";
import { Cpu, HardDrive, ShieldCheck, Zap, Trash2 } from "lucide-react-native";
import { DeviceProfiler } from "../services/DeviceProfiler";
import { TorrentEngine } from "../services/TorrentEngine";
import { getSavedDecoderPref, saveDecoderPref } from "../lib/store";
import type { DecoderSelection, DeviceProfile } from "../lib/types";

export const SettingsScreen: React.FC = () => {
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [decoderPref, setDecoderPref] = useState<DecoderSelection>("auto");
  const [cleanedMsg, setCleanedMsg] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const p = await DeviceProfiler.getProfile();
      const pref = await getSavedDecoderPref();
      if (mounted) {
        setProfile(p);
        setDecoderPref(pref);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectPref = async (pref: DecoderSelection) => {
    setDecoderPref(pref);
    DeviceProfiler.setUserPreference(pref);
    await saveDecoderPref(pref);
    const updated = await DeviceProfiler.getProfile();
    setProfile(updated);
  };

  const handleCleanCache = async () => {
    await TorrentEngine.stopStream();
    setCleanedMsg(true);
    setTimeout(() => setCleanedMsg(false), 2500);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings & Hardware Diagnostics</Text>
        <Text style={styles.subtitle}>
          Manage streaming performance, hardware decoders, and TV storage caps.
        </Text>
      </View>

      {/* Hardware Profile Card */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Cpu size={18} color="#E50914" />
          <Text style={styles.sectionTitle}>Detected TV Hardware Profile</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Device Specification Tier:</Text>
            <View style={styles.tierBadge}>
              <Text style={styles.tierText}>
                {profile?.tier.toUpperCase() || "MID"}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Estimated Total Memory:</Text>
            <Text style={styles.infoVal}>{profile?.totalRamMb || 2048} MB RAM</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Low-RAM Flag (OS heuristic):</Text>
            <Text style={styles.infoVal}>
              {profile?.isLowRamDevice ? "Yes (Constrained)" : "No (Normal)"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Max P2P Peer Cap:</Text>
            <Text style={styles.infoVal}>
              {profile?.maxPeerConnections || 35} connections
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rolling Ring-Buffer Cap:</Text>
            <Text style={styles.infoVal}>
              {profile?.rollingBufferMb || 200} MB (Played chunks purged)
            </Text>
          </View>

          <View style={styles.statusBox}>
            <ShieldCheck
              size={16}
              color={profile?.useHardwareDecoding ? "#46d369" : "#3178C6"}
            />
            <Text style={styles.statusText}>{profile?.hardwareReason}</Text>
          </View>
        </View>
      </View>

      {/* Decoder Mode Selection */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Zap size={18} color="#E50914" />
          <Text style={styles.sectionTitle}>Hardware Video Decoder Mode</Text>
        </View>

        <Text style={styles.desc}>
          Specifies when native ExoPlayer hardware decoding (MediaCodec VPU) is engaged:
        </Text>

        <View style={styles.optionsRow}>
          <TouchableHighlight
            onPress={() => handleSelectPref("auto")}
            underlayColor="#333"
            style={[styles.optBtn, decoderPref === "auto" && styles.optBtnSelected]}
          >
            <View>
              <Text style={[styles.optTitle, decoderPref === "auto" && styles.optTitleSelected]}>
                Auto (Spec-Based)
              </Text>
              <Text style={styles.optDesc}>
                Uses hardware decoding only when TV specs require it.
              </Text>
            </View>
          </TouchableHighlight>

          <TouchableHighlight
            onPress={() => handleSelectPref("force_hardware")}
            underlayColor="#333"
            style={[styles.optBtn, decoderPref === "force_hardware" && styles.optBtnSelected]}
          >
            <View>
              <Text
                style={[
                  styles.optTitle,
                  decoderPref === "force_hardware" && styles.optTitleSelected,
                ]}
              >
                Force Hardware (VPU)
              </Text>
              <Text style={styles.optDesc}>
                Always offload decoding to TV GPU/VPU.
              </Text>
            </View>
          </TouchableHighlight>

          <TouchableHighlight
            onPress={() => handleSelectPref("force_software")}
            underlayColor="#333"
            style={[styles.optBtn, decoderPref === "force_software" && styles.optBtnSelected]}
          >
            <View>
              <Text
                style={[
                  styles.optTitle,
                  decoderPref === "force_software" && styles.optTitleSelected,
                ]}
              >
                Force Software
              </Text>
              <Text style={styles.optDesc}>
                Flexible rendering for high-spec TVs.
              </Text>
            </View>
          </TouchableHighlight>
        </View>
      </View>

      {/* Storage & Cache Management */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <HardDrive size={18} color="#E50914" />
          <Text style={styles.sectionTitle}>Storage & Rolling Cache</Text>
        </View>

        <Text style={styles.desc}>
          TorrentFlix does not save complete movies to internal flash. It maintains a
          rolling ring buffer limited to {profile?.rollingBufferMb || 200} MB in cache.
        </Text>

        <TouchableHighlight
          onPress={handleCleanCache}
          underlayColor="#B80710"
          style={styles.cleanBtn}
        >
          <View style={styles.btnRow}>
            <Trash2 size={16} color="#fff" />
            <Text style={styles.btnText}>
              {cleanedMsg ? "Cache Cleared!" : "Clear Streaming Cache"}
            </Text>
          </View>
        </TouchableHighlight>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d",
  },
  header: {
    paddingHorizontal: 40,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#888",
    fontSize: 13,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 40,
    marginBottom: 26,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  desc: {
    color: "#888",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: "#161616",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#222",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1f1f1f",
  },
  infoLabel: {
    color: "#aaa",
    fontSize: 13,
  },
  infoVal: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  tierBadge: {
    backgroundColor: "#E50914",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tierText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#111",
    padding: 10,
    borderRadius: 6,
    marginTop: 12,
  },
  statusText: {
    color: "#ccc",
    fontSize: 12,
    flex: 1,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  optBtn: {
    flex: 1,
    backgroundColor: "#161616",
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optBtnSelected: {
    borderColor: "#E50914",
    backgroundColor: "#201010",
  },
  optTitle: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 4,
  },
  optTitleSelected: {
    color: "#fff",
  },
  optDesc: {
    color: "#666",
    fontSize: 11,
  },
  cleanBtn: {
    backgroundColor: "#222",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
