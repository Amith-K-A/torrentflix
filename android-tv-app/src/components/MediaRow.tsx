import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { FocusableCard } from "./FocusableCard";
import type { MediaItem } from "../lib/types";

interface Props {
  title: string;
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
}

export const MediaRow: React.FC<Props> = ({ title, items, onSelect }) => {
  if (!items || items.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.rowTitle}>{title}</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={3}
        renderItem={({ item, index }) => (
          <FocusableCard
            item={item}
            onPress={onSelect}
            hasPreferredFocus={index === 0 && false}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    paddingLeft: 40,
  },
  rowTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  listContent: {
    paddingRight: 40,
  },
});
