import React, { useEffect, useState } from "react";
import {
  BackHandler,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { TVNavbar, NavTab } from "./src/components/TVNavbar";
import { HomeScreen } from "./src/screens/HomeScreen";
import { BrowseScreen } from "./src/screens/BrowseScreen";
import { LanguagesScreen } from "./src/screens/LanguagesScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { WatchlistScreen } from "./src/screens/WatchlistScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { DetailScreen } from "./src/screens/DetailScreen";
import { PlayerScreen } from "./src/screens/PlayerScreen";
import type { MediaItem, PlayTarget, TorrentResult } from "./src/lib/types";

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>("home");
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [activePlayback, setActivePlayback] = useState<{
    target: PlayTarget;
    source: TorrentResult;
  } | null>(null);

  // Handle TV Remote Back Button
  useEffect(() => {
    const onBackPress = () => {
      if (activePlayback) {
        setActivePlayback(null);
        return true;
      }
      if (selectedMedia) {
        setSelectedMedia(null);
        return true;
      }
      if (currentTab !== "home") {
        setCurrentTab("home");
        return true;
      }
      return false; // Let OS exit app
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [activePlayback, selectedMedia, currentTab]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />

      {/* Fullscreen Video Player */}
      {activePlayback ? (
        <PlayerScreen
          target={activePlayback.target}
          source={activePlayback.source}
          onExit={() => setActivePlayback(null)}
        />
      ) : selectedMedia ? (
        /* Title Details Screen */
        <DetailScreen
          item={selectedMedia}
          onBack={() => setSelectedMedia(null)}
          onPlayStream={(target, source) => {
            setActivePlayback({ target, source });
          }}
        />
      ) : (
        /* Main TV Navigation Interface */
        <View style={styles.main}>
          <TVNavbar activeTab={currentTab} onSelectTab={setCurrentTab} />

          <View style={styles.content}>
            {currentTab === "home" && (
              <HomeScreen
                onSelectMedia={setSelectedMedia}
                onStreamNow={setSelectedMedia}
              />
            )}
            {(currentTab === "movies" || currentTab === "shows") && (
              <BrowseScreen onSelectMedia={setSelectedMedia} />
            )}
            {currentTab === "languages" && (
              <LanguagesScreen onSelectMedia={setSelectedMedia} />
            )}
            {currentTab === "search" && (
              <SearchScreen onSelectMedia={setSelectedMedia} />
            )}
            {currentTab === "watchlist" && (
              <WatchlistScreen onSelectMedia={setSelectedMedia} />
            )}
            {currentTab === "settings" && <SettingsScreen />}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d",
  },
  main: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
