import React, { useState } from "react";
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from "react-native";
import { Play, Info, Star } from "lucide-react-native";
import { tmdbImg } from "../api/tmdb";
import type { MediaItem } from "../lib/types";

interface Props {
  item: MediaItem | null;
  onPlay: (item: MediaItem) => void;
  onDetails: (item: MediaItem) => void;
}

export const HeroBillboard: React.FC<Props> = ({ item, onPlay, onDetails }) => {
  const [playFocused, setPlayFocused] = useState(false);
  const [detailsFocused, setDetailsFocused] = useState(false);

  if (!item) return null;

  const backdropUri = tmdbImg.backdrop(item.backdropPath, "w780");

  return (
    <View style={styles.container}>
      <ImageBackground
        source={backdropUri ? { uri: backdropUri } : undefined}
        style={styles.backdrop}
        resizeMode="cover"
      >
        {/* Dark gradient / tint overlay */}
        <View style={styles.gradientOverlay}>
          <View style={styles.content}>
            {/* Title */}
            <Text numberOfLines={2} style={styles.title}>
              {item.title}
            </Text>

            {/* Meta bar */}
            <View style={styles.metaRow}>
              {item.voteAverage > 0 && (
                <View style={styles.ratingBox}>
                  <Star size={13} color="#FFD700" fill="#FFD700" />
                  <Text style={styles.ratingText}>{item.voteAverage}</Text>
                </View>
              )}
              {item.releaseDate && (
                <Text style={styles.yearText}>
                  {item.releaseDate.substring(0, 4)}
                </Text>
              )}
              <View style={styles.badge}>
                <Text style={styles.badgeText}>HD / 4K</Text>
              </View>
            </View>

            {/* Synopsis */}
            <Text numberOfLines={3} style={styles.overview}>
              {item.overview || "Stream this title instantly with TorrentFlix P2P."}
            </Text>

            {/* D-Pad Focusable Action Buttons */}
            <View style={styles.btnRow}>
              <TouchableHighlight
                onPress={() => onPlay(item)}
                onFocus={() => setPlayFocused(true)}
                onBlur={() => setPlayFocused(false)}
                activeOpacity={0.8}
                underlayColor="#E50914"
                style={[styles.btn, styles.btnPrimary, playFocused && styles.btnFocused]}
              >
                <View style={styles.btnContent}>
                  <Play size={16} color={playFocused ? "#fff" : "#000"} fill={playFocused ? "#fff" : "#000"} />
                  <Text style={[styles.btnTextPrimary, playFocused && { color: "#fff" }]}>
                    Stream Now
                  </Text>
                </View>
              </TouchableHighlight>

              <TouchableHighlight
                onPress={() => onDetails(item)}
                onFocus={() => setDetailsFocused(true)}
                onBlur={() => setDetailsFocused(false)}
                activeOpacity={0.8}
                underlayColor="#444"
                style={[styles.btn, styles.btnSecondary, detailsFocused && styles.btnFocused]}
              >
                <View style={styles.btnContent}>
                  <Info size={16} color="#fff" />
                  <Text style={styles.btnTextSecondary}>More Details</Text>
                </View>
              </TouchableHighlight>
            </View>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 380,
    width: "100%",
    backgroundColor: "#111",
  },
  backdrop: {
    width: "100%",
    height: "100%",
  },
  gradientOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 10, 0.65)",
    justifyContent: "flex-end",
    paddingHorizontal: 40,
    paddingBottom: 30,
  },
  content: {
    maxWidth: 600,
  },
  title: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 8,
    textShadowColor: "rgba(0, 0, 0, 0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  ratingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  yearText: {
    color: "#ccc",
    fontSize: 13,
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  overview: {
    color: "#bbb",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  btn: {
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: "transparent",
  },
  btnFocused: {
    borderColor: "#E50914",
    transform: [{ scale: 1.05 }],
  },
  btnPrimary: {
    backgroundColor: "#fff",
  },
  btnSecondary: {
    backgroundColor: "rgba(100, 100, 100, 0.6)",
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnTextPrimary: {
    color: "#000",
    fontSize: 13,
    fontWeight: "bold",
  },
  btnTextSecondary: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
