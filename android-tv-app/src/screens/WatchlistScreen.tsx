import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { FocusableCard } from "../components/FocusableCard";
import { getWatchlist } from "../lib/store";
import type { MediaItem } from "../lib/types";

interface Props {
  onSelectMedia: (item: MediaItem) => void;
}

export const WatchlistScreen: React.FC<Props> = ({ onSelectMedia }) => {
  const [items, setItems] = useState<MediaItem[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const list = await getWatchlist();
      if (mounted) setItems(list);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Watchlist</Text>
        <Text style={styles.subtitle}>{items.length} saved titles</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Your watchlist is empty</Text>
          <Text style={styles.emptySub}>
            Browse movies and TV shows and click "Add to List" to save them here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          numColumns={5}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <FocusableCard item={item} onPress={onSelectMedia} />
          )}
        />
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
    paddingHorizontal: 40,
    paddingTop: 20,
    paddingBottom: 10,
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
  grid: {
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    color: "#aaa",
    fontSize: 18,
    fontWeight: "bold",
  },
  emptySub: {
    color: "#666",
    fontSize: 13,
    marginTop: 6,
  },
});
