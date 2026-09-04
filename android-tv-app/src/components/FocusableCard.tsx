import React, { useRef, useState } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from "react-native";
import { Star } from "lucide-react-native";
import { tmdbImg } from "../api/tmdb";
import type { MediaItem } from "../lib/types";

interface Props {
  item: MediaItem;
  onPress: (item: MediaItem) => void;
  hasPreferredFocus?: boolean;
}

export const FocusableCard: React.FC<Props> = ({ item, onPress, hasPreferredFocus = false }) => {
  const [focused, setFocused] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.spring(scaleAnim, {
      toValue: 1.08,
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  const onBlur = () => {
    setFocused(false);
    Animated.spring(scaleAnim, {
      toValue: 1.0,
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  const posterUri = tmdbImg.poster(item.posterPath, "w300");

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableHighlight
        onPress={() => onPress(item)}
        onFocus={onFocus}
        onBlur={onBlur}
        {...({ hasTVPreferredFocus: hasPreferredFocus } as any)}
        activeOpacity={0.9}
        underlayColor="#E50914"
        style={[styles.touchable, focused && styles.touchableFocused]}
      >
        <View style={styles.inner}>
          {posterUri ? (
            <Image source={{ uri: posterUri }} style={styles.poster} resizeMode="cover" />
          ) : (
            <View style={[styles.poster, styles.noImage]}>
              <Text style={styles.noImageText}>{item.title}</Text>
            </View>
          )}

          {/* Rating Badge */}
          {item.voteAverage > 0 && (
            <View style={styles.ratingBadge}>
              <Star size={10} color="#FFD700" fill="#FFD700" />
              <Text style={styles.ratingText}>{item.voteAverage}</Text>
            </View>
          )}

          {/* Title on focus or overlay */}
          <View style={[styles.titleBar, focused && styles.titleBarFocused]}>
            <Text numberOfLines={1} style={styles.titleText}>
              {item.title}
            </Text>
          </View>
        </View>
      </TouchableHighlight>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 150,
    marginRight: 16,
    marginVertical: 10,
  },
  touchable: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
  touchableFocused: {
    borderColor: "#E50914",
    shadowColor: "#E50914",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  inner: {
    width: "100%",
    height: 220,
    backgroundColor: "#181818",
    borderRadius: 6,
    position: "relative",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  noImage: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222",
    padding: 8,
  },
  noImageText: {
    color: "#888",
    fontSize: 12,
    textAlign: "center",
  },
  ratingBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.75)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  ratingText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  titleBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  titleBarFocused: {
    backgroundColor: "rgba(229, 9, 20, 0.9)",
  },
  titleText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
});
