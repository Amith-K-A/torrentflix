import React, { useState } from "react";
import { StyleSheet, Text, TouchableHighlight, View } from "react-native";
import { Home, Film, Tv, Globe, Search, Bookmark, Settings } from "lucide-react-native";

export type NavTab = "home" | "movies" | "shows" | "languages" | "search" | "watchlist" | "settings";

interface Props {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const TVNavbar: React.FC<Props> = ({ activeTab, onSelectTab }) => {
  const [focusedTab, setFocusedTab] = useState<NavTab | null>(null);

  const tabs: { key: NavTab; label: string; icon: any }[] = [
    { key: "home", label: "Home", icon: Home },
    { key: "movies", label: "Movies", icon: Film },
    { key: "shows", label: "TV Shows", icon: Tv },
    { key: "languages", label: "Languages", icon: Globe },
    { key: "search", label: "Search", icon: Search },
    { key: "watchlist", label: "My List", icon: Bookmark },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <View style={styles.container}>
      {/* Brand logo title */}
      <View style={styles.brandBox}>
        <Text style={styles.brandTorrent}>TORRENT</Text>
        <Text style={styles.brandFlix}>FLIX</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {tabs.map((t) => {
          const isActive = activeTab === t.key;
          const isFocused = focusedTab === t.key;
          const Icon = t.icon;

          return (
            <TouchableHighlight
              key={t.key}
              onPress={() => onSelectTab(t.key)}
              onFocus={() => setFocusedTab(t.key)}
              onBlur={() => setFocusedTab(null)}
              activeOpacity={0.8}
              underlayColor="#222"
              style={[
                styles.tabBtn,
                isActive && styles.tabBtnActive,
                isFocused && styles.tabBtnFocused,
              ]}
            >
              <View style={styles.tabContent}>
                <Icon
                  size={15}
                  color={isFocused ? "#E50914" : isActive ? "#fff" : "#888"}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    isActive && styles.tabLabelActive,
                    isFocused && styles.tabLabelFocused,
                  ]}
                >
                  {t.label}
                </Text>
              </View>
            </TouchableHighlight>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    width: "100%",
    backgroundColor: "rgba(12, 12, 12, 0.95)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  brandBox: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandTorrent: {
    color: "#E50914",
    fontWeight: "900",
    fontSize: 20,
    letterSpacing: 1.5,
  },
  brandFlix: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 20,
    letterSpacing: 1.5,
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  tabBtnActive: {
    borderBottomColor: "#E50914",
  },
  tabBtnFocused: {
    borderColor: "#E50914",
    backgroundColor: "rgba(255,255,255,0.08)",
    transform: [{ scale: 1.05 }],
  },
  tabContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tabLabel: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: "#fff",
    fontWeight: "bold",
  },
  tabLabelFocused: {
    color: "#E50914",
  },
});
