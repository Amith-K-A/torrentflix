import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Search } from "lucide-react-native";
import { FocusableCard } from "../components/FocusableCard";
import { searchTitles } from "../api/tmdb";
import type { MediaItem } from "../lib/types";

interface Props {
  onSelectMedia: (item: MediaItem) => void;
}

export const SearchScreen: React.FC<Props> = ({ onSelectMedia }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await searchTitles(text);
      setResults(res);
    } catch (e) {
      console.warn("Search error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Input Bar */}
      <View style={styles.searchBar}>
        <Search size={18} color="#888" />
        <TextInput
          value={query}
          onChangeText={handleSearch}
          placeholder="Search movies, TV shows, actors..."
          placeholderTextColor="#666"
          style={styles.input}
          autoFocus
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E50914" />
        </View>
      ) : results.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.hint}>
            {query.trim()
              ? `No titles found for "${query}"`
              : "Type on your TV keyboard to search titles"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
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
  searchBar: {
    marginHorizontal: 40,
    marginTop: 20,
    marginBottom: 10,
    backgroundColor: "#1c1c1c",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: "#333",
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    paddingVertical: 12,
    marginLeft: 10,
  },
  grid: {
    paddingHorizontal: 40,
    paddingVertical: 10,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  hint: {
    color: "#777",
    fontSize: 14,
  },
});
