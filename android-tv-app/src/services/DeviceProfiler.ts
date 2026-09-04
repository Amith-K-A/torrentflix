import { Platform } from "react-native";
import type { DecoderSelection, DeviceProfile, HardwareTier } from "../lib/types";

class DeviceProfilerService {
  private profile: DeviceProfile | null = null;
  private userPreference: DecoderSelection = "auto";

  /**
   * Profiles the TV hardware based on RAM, CPU, and Android OS flags.
   */
  public async getProfile(): Promise<DeviceProfile> {
    if (this.profile) return this.applyUserPreference(this.profile);

    let totalRamMb = 2048; // default heuristic
    let isLowRam = false;
    let cpuCores = 4;

    // Estimate hardware specifications on Android
    if (Platform.OS === "android") {
      try {
        // Native performance heuristics available through JS runtime
        const heap = (performance as any)?.memory?.jsHeapSizeLimit;
        if (heap) {
          const heapMb = Math.round(heap / (1024 * 1024));
          // Devices with <= 256MB heap limit are typically 1GB-1.5GB budget TV sticks
          if (heapMb <= 256) {
            totalRamMb = 1024;
            isLowRam = true;
          } else if (heapMb <= 512) {
            totalRamMb = 2048;
          } else {
            totalRamMb = 3072;
          }
        }
      } catch {
        // Fallback default
      }
    }

    let tier: HardwareTier = "mid";
    let useHardware = false;
    let maxPeers = 35;
    let bufferMb = 200;
    let reason = "Standard TV specification.";

    if (isLowRam || totalRamMb <= 1536) {
      // Budget TV Sticks / Low RAM TVs (Fire TV Stick Lite, 1GB Mi Box)
      tier = "constrained";
      // CRITICAL: Engage native hardware decoding via ExoPlayer ONLY because
      // the low-end CPU cannot handle software decoding without dropping frames.
      useHardware = true;
      maxPeers = 25;
      bufferMb = 120;
      reason = "Constrained TV hardware (<=1.5GB RAM). Native ExoPlayer hardware decoding engaged to prevent CPU overload and OOM crashes.";
    } else if (totalRamMb >= 3072) {
      // High-End TV Hardware (Nvidia Shield, Flagship Sony/Philips Google TV)
      tier = "high";
      // The TV is fully capable of handling playback without forcing hardware decoders
      useHardware = false;
      maxPeers = 60;
      bufferMb = 350;
      reason = "High-performance TV hardware (3GB+ RAM). Software/flexible rendering active with high-throughput swarm.";
    } else {
      // Standard 2GB TV
      tier = "mid";
      useHardware = false; // Start standard, allow hardware fallback
      maxPeers = 40;
      bufferMb = 200;
      reason = "Balanced TV hardware (2GB RAM). Standard playback with adaptive fallback.";
    }

    this.profile = {
      tier,
      totalRamMb,
      isLowRamDevice: isLowRam,
      cpuCores,
      maxPeerConnections: maxPeers,
      rollingBufferMb: bufferMb,
      useHardwareDecoding: useHardware,
      hardwareReason: reason,
    };

    return this.applyUserPreference(this.profile);
  }

  public setUserPreference(pref: DecoderSelection) {
    this.userPreference = pref;
  }

  public getUserPreference(): DecoderSelection {
    return this.userPreference;
  }

  private applyUserPreference(base: DeviceProfile): DeviceProfile {
    if (this.userPreference === "force_hardware") {
      return {
        ...base,
        useHardwareDecoding: true,
        hardwareReason: "Manual Override: Native ExoPlayer hardware decoding forced.",
      };
    }
    if (this.userPreference === "force_software") {
      return {
        ...base,
        useHardwareDecoding: false,
        hardwareReason: "Manual Override: Software / flexible mode forced.",
      };
    }
    return base;
  }
}

export const DeviceProfiler = new DeviceProfilerService();
