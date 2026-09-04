import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from "react-native";
import { MediaRow } from "../components/MediaRow";
import { getPopular, getTopRated, getTrending } from "../api/tmdb";
import type { MediaItem, MediaType } from "../lib/types";

interface Props {
  onSelectMedia: (item: MediaItem) => void;
}

export const BrowseScreen: React.FC<Props> = ({ onSelectMedia }) => {
  const [selectedType, setSelectedType] = useState<MediaType>("movie");
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [popular, setPopular] = useState<MediaItem[]>([]);
  const [topRated, setTopRated] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [tr, pop, top] = await Promise.all([
          getTrending(selectedType),
          getPopular(selectedType),
          getTopRated(selectedType),
        ]);
        if (mounted) {
          setTrending(tr);
          setPopular(pop);
          setTopRated(top);
        }
      } catch (e) {
        console.warn("BrowseScreen error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [selectedType]);

  return (
    <View style={styles.container}>
      {/* Type Toggle Header */}
      <View style={styles.header}>
        <TouchableHighlight
          onPress={() => setSelectedType("movie")}
          underlayColor="#222"
          style={[styles.toggleBtn, selectedType === "movie" && styles.toggleActive]}
        >
          <Text style={[styles.toggleText, selectedType === "movie" && styles.toggleTextActive]}>
            Movies
          </Text>
        </TouchableHighlight>

        <TouchableHighlight
          onPress={() => setSelectedType("tv")}
          underlayColor="#222"
          style={[styles.toggleBtn, selectedType === "tv" && styles.toggleActive]}
        >
          <Text style={[styles.toggleText, selectedType === "tv" && styles.toggleTextActive]}>
            TV Shows
          </Text>
        </TouchableHighlight>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E50914" />
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <MediaRow
            title={selectedType === "movie" ? "Trending Movies Today" : "Trending Series"}
            items={trending}
            onSelect={onSelectMedia}
          />
          <MediaRow
            title="Most Popular Right Now"
            items={popular}
            onSelect={onSelectMedia}
          />
          <MediaRow
            title="Critically Acclaimed & Top Rated"
            items={topRated}
            onSelect={onSelectMedia}
          />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d",
  },
  header: {
    flexDirection: "row",
    paddingHorizontal: 40,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e1e",
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#1c1c1c",
    borderWidth: 2,
    borderColor: "transparent",
  },
  toggleActive: {
    borderColor: "#E50914",
    backgroundColor: "rgba(229, 9, 20, 0.15)",
  },
  toggleText: {
    color: "#888",
    fontSize: 14,
    fontWeight: "bold",
  },
  toggleTextActive: {
    color: "#fff",
  },
  scroll: {
    flex: 1,
    paddingTop: 10,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
