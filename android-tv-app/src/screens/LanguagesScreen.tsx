import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from "react-native";
import { FocusableCard } from "../components/FocusableCard";
import { getByLanguage } from "../api/tmdb";
import type { MediaItem } from "../lib/types";

const LANGUAGES = [
  { code: "hi", name: "Hindi" },
  { code: "te", name: "Telugu" },
  { code: "ta", name: "Tamil" },
  { code: "ml", name: "Malayalam" },
  { code: "kn", name: "Kannada" },
  { code: "en", name: "English" },
  { code: "ko", name: "Korean" },
  { code: "ja", name: "Japanese" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "th", name: "Thai" },
  { code: "it", name: "Italian" },
];

interface Props {
  onSelectMedia: (item: MediaItem) => void;
}

export const LanguagesScreen: React.FC<Props> = ({ onSelectMedia }) => {
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0].code);
  const [focusedChip, setFocusedChip] = useState<string | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await getByLanguage("movie", selectedLang);
        if (mounted) setItems(res);
      } catch (e) {
        console.warn("LanguagesScreen error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [selectedLang]);

  return (
    <View style={styles.container}>
      {/* Horizontal Language Filter Chips */}
      <View style={styles.chipBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {LANGUAGES.map((lang) => {
            const isSelected = selectedLang === lang.code;
            const isFocused = focusedChip === lang.code;
            return (
              <TouchableHighlight
                key={lang.code}
                onPress={() => setSelectedLang(lang.code)}
                onFocus={() => setFocusedChip(lang.code)}
                onBlur={() => setFocusedChip(null)}
                underlayColor="#222"
                style={[
                  styles.chip,
                  isSelected && styles.chipSelected,
                  isFocused && styles.chipFocused,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.chipTextSelected,
                    isFocused && { color: "#E50914" },
                  ]}
                >
                  {lang.name}
                </Text>
              </TouchableHighlight>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E50914" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          numColumns={5}
          contentContainerStyle={styles.grid}
          removeClippedSubviews={true}
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
  chipBar: {
    paddingVertical: 12,
    paddingHorizontal: 40,
    backgroundColor: "#141414",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#222",
    marginRight: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  chipSelected: {
    backgroundColor: "#E50914",
  },
  chipFocused: {
    borderColor: "#fff",
    transform: [{ scale: 1.08 }],
  },
  chipText: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: "#fff",
    fontWeight: "bold",
  },
  grid: {
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
