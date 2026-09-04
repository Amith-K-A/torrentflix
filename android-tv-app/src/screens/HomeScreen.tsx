import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { HeroBillboard } from "../components/HeroBillboard";
import { MediaRow } from "../components/MediaRow";
import { getPopular, getTopRated, getTrending } from "../api/tmdb";
import type { MediaItem } from "../lib/types";

interface Props {
  onSelectMedia: (item: MediaItem) => void;
  onStreamNow: (item: MediaItem) => void;
}

export const HomeScreen: React.FC<Props> = ({ onSelectMedia, onStreamNow }) => {
  const [heroItem, setHeroItem] = useState<MediaItem | null>(null);
  const [trendingMovies, setTrendingMovies] = useState<MediaItem[]>([]);
  const [popularShows, setPopularShows] = useState<MediaItem[]>([]);
  const [topRated, setTopRated] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [trending, shows, top] = await Promise.all([
          getTrending("movie"),
          getPopular("tv"),
          getTopRated("movie"),
        ]);
        if (mounted) {
          setTrendingMovies(trending);
          setPopularShows(shows);
          setTopRated(top);
          if (trending.length > 0) {
            setHeroItem(trending[0]);
          }
        }
      } catch (e) {
        console.warn("HomeScreen loadData error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E50914" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
    >
      {/* Cinematic Hero Billboard */}
      <HeroBillboard
        item={heroItem}
        onPlay={onStreamNow}
        onDetails={onSelectMedia}
      />

      {/* Media Rows */}
      <View style={styles.rowsContainer}>
        <MediaRow
          title="Trending Movies"
          items={trendingMovies}
          onSelect={onSelectMedia}
        />
        <MediaRow
          title="Popular TV Shows"
          items={popularShows}
          onSelect={onSelectMedia}
        />
        <MediaRow
          title="Top Rated Blockbusters"
          items={topRated}
          onSelect={onSelectMedia}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d",
  },
  center: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    justifyContent: "center",
    alignItems: "center",
  },
  rowsContainer: {
    paddingBottom: 40,
    marginTop: -20,
  },
});
