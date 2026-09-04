import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from "react-native";
import { Play, Bookmark, Star, Users, HardDrive } from "lucide-react-native";
import { getDetails, getSeasonEpisodes, tmdbImg } from "../api/tmdb";
import { searchTorrents } from "../api/torrents";
import { getWatchlist, toggleWatchlist } from "../lib/store";
import type { EpisodeItem, MediaItem, PlayTarget, TorrentResult } from "../lib/types";

interface Props {
  item: MediaItem;
  onBack: () => void;
  onPlayStream: (target: PlayTarget, source: TorrentResult) => void;
}

export const DetailScreen: React.FC<Props> = ({ item, onBack, onPlayStream }) => {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [torrents, setTorrents] = useState<TorrentResult[]>([]);
  const [selectedTorrent, setSelectedTorrent] = useState<TorrentResult | null>(null);
  const [searchingTorrents, setSearchingTorrents] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const d = await getDetails(item.type, item.id);
        const list = await getWatchlist();
        if (mounted) {
          setDetails(d);
          setIsSaved(list.some((x) => x.id === item.id));
          if (item.type === "tv") {
            const eps = await getSeasonEpisodes(item.id, 1);
            if (mounted) setEpisodes(eps);
          }
        }
      } catch (e) {
        console.warn("DetailScreen load error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [item]);

  // Search torrents whenever episode or movie target is ready
  useEffect(() => {
    let mounted = true;
    async function fetchSources() {
      if (!details) return;
      setSearchingTorrents(true);
      const imdbId = details.external_ids?.imdb_id;
      const target: PlayTarget = {
        type: item.type,
        tmdbId: item.id,
        imdbId,
        title: item.title,
        season: item.type === "tv" ? selectedSeason : undefined,
        episode: item.type === "tv" ? selectedEpisode : undefined,
      };

      const sources = await searchTorrents(target);
      if (mounted) {
        setTorrents(sources);
        if (sources.length > 0) setSelectedTorrent(sources[0]);
        setSearchingTorrents(false);
      }
    }
    fetchSources();
    return () => {
      mounted = false;
    };
  }, [details, selectedSeason, selectedEpisode]);

  const handleToggleWatchlist = async () => {
    const saved = await toggleWatchlist(item);
    setIsSaved(saved);
  };

  const handleStartPlay = () => {
    if (!selectedTorrent) return;
    const imdbId = details?.external_ids?.imdb_id;
    const target: PlayTarget = {
      type: item.type,
      tmdbId: item.id,
      imdbId,
      title: item.title,
      season: item.type === "tv" ? selectedSeason : undefined,
      episode: item.type === "tv" ? selectedEpisode : undefined,
    };
    onPlayStream(target, selectedTorrent);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E50914" />
      </View>
    );
  }

  const backdropUri = tmdbImg.backdrop(item.backdropPath, "w1280");
  const posterUri = tmdbImg.poster(item.posterPath, "w300");

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Background Banner */}
      <ImageBackground
        source={backdropUri ? { uri: backdropUri } : undefined}
        style={styles.hero}
        resizeMode="cover"
      >
        <View style={styles.heroOverlay}>
          <View style={styles.headerInfo}>
            {posterUri && <Image source={{ uri: posterUri }} style={styles.poster} />}
            <View style={styles.metaCol}>
              <Text style={styles.title}>{item.title}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.ratingBadge}>
                  <Star size={12} color="#FFD700" fill="#FFD700" />
                  <Text style={styles.ratingText}>{item.voteAverage}</Text>
                </View>
                <Text style={styles.metaSub}>
                  {details?.release_date?.substring(0, 4) || details?.first_air_date?.substring(0, 4)}
                </Text>
                {details?.runtime && (
                  <Text style={styles.metaSub}>{details.runtime} min</Text>
                )}
                <View style={styles.pill}>
                  <Text style={styles.pillText}>4K / 1080p P2P</Text>
                </View>
              </View>

              <Text numberOfLines={4} style={styles.overview}>
                {item.overview || "No overview available."}
              </Text>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableHighlight
                  onPress={handleStartPlay}
                  underlayColor="#B80710"
                  style={[styles.btn, styles.btnPlay]}
                >
                  <View style={styles.btnRow}>
                    <Play size={18} color="#fff" fill="#fff" />
                    <Text style={styles.btnText}>
                      Stream {selectedTorrent?.quality || "Now"}
                    </Text>
                  </View>
                </TouchableHighlight>

                <TouchableHighlight
                  onPress={handleToggleWatchlist}
                  underlayColor="#333"
                  style={[styles.btn, styles.btnWatchlist]}
                >
                  <View style={styles.btnRow}>
                    <Bookmark size={18} color={isSaved ? "#E50914" : "#fff"} />
                    <Text style={styles.btnText}>
                      {isSaved ? "In Watchlist" : "Add to List"}
                    </Text>
                  </View>
                </TouchableHighlight>

                <TouchableHighlight
                  onPress={onBack}
                  underlayColor="#333"
                  style={[styles.btn, styles.btnBack]}
                >
                  <Text style={styles.btnText}>Back</Text>
                </TouchableHighlight>
              </View>
            </View>
          </View>
        </View>
      </ImageBackground>

      {/* Available Torrents & Sources Section */}
      <View style={styles.sourcesSection}>
        <Text style={styles.sectionHeader}>Available P2P Stream Sources</Text>
        {searchingTorrents ? (
          <ActivityIndicator size="small" color="#E50914" />
        ) : torrents.length === 0 ? (
          <Text style={styles.emptyText}>No torrent sources found for this title.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {torrents.slice(0, 8).map((t, idx) => {
              const isSelected = selectedTorrent?.infoHash === t.infoHash;
              const sizeGb = (t.sizeBytes / (1024 * 1024 * 1024)).toFixed(1);
              return (
                <TouchableHighlight
                  key={t.infoHash || idx}
                  onPress={() => setSelectedTorrent(t)}
                  underlayColor="#333"
                  style={[styles.sourceCard, isSelected && styles.sourceCardSelected]}
                >
                  <View>
                    <View style={styles.sourceTop}>
                      <Text style={[styles.sourceQuality, isSelected && { color: "#fff" }]}>
                        {t.quality}
                      </Text>
                      <Text style={styles.sourceProvider}>{t.provider}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.sourceTitle}>
                      {t.title}
                    </Text>
                    <View style={styles.sourceMeta}>
                      <View style={styles.statItem}>
                        <Users size={11} color="#46d369" />
                        <Text style={styles.statText}>{t.seeders} seeds</Text>
                      </View>
                      <View style={styles.statItem}>
                        <HardDrive size={11} color="#aaa" />
                        <Text style={styles.statText}>{sizeGb} GB</Text>
                      </View>
                    </View>
                  </View>
                </TouchableHighlight>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Episode list for TV shows */}
      {item.type === "tv" && episodes.length > 0 && (
        <View style={styles.episodesSection}>
          <Text style={styles.sectionHeader}>Season {selectedSeason} Episodes</Text>
          {episodes.map((ep) => {
            const isSelected = selectedEpisode === ep.episodeNumber;
            return (
              <TouchableHighlight
                key={ep.id}
                onPress={() => setSelectedEpisode(ep.episodeNumber)}
                underlayColor="#222"
                style={[styles.episodeRow, isSelected && styles.episodeRowSelected]}
              >
                <View style={styles.episodeInner}>
                  <Text style={styles.epNumber}>{ep.episodeNumber}</Text>
                  <View style={styles.epInfo}>
                    <Text style={[styles.epTitle, isSelected && { color: "#E50914" }]}>
                      {ep.name}
                    </Text>
                    <Text numberOfLines={2} style={styles.epOverview}>
                      {ep.overview || "No episode synopsis."}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.playingPill}>
                      <Text style={styles.playingPillText}>Selected</Text>
                    </View>
                  )}
                </View>
              </TouchableHighlight>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
  },
  hero: {
    width: "100%",
    height: 420,
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 10, 0.75)",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  headerInfo: {
    flexDirection: "row",
    gap: 30,
    alignItems: "center",
  },
  poster: {
    width: 160,
    height: 240,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  metaCol: {
    flex: 1,
    maxWidth: 700,
  },
  title: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#222",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  ratingText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  metaSub: {
    color: "#aaa",
    fontSize: 13,
  },
  pill: {
    backgroundColor: "#E50914",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  overview: {
    color: "#ccc",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  btn: {
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  btnPlay: {
    backgroundColor: "#E50914",
  },
  btnWatchlist: {
    backgroundColor: "#262626",
  },
  btnBack: {
    backgroundColor: "#181818",
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
  sourcesSection: {
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  sectionHeader: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 12,
  },
  sourceCard: {
    width: 210,
    backgroundColor: "#161616",
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  sourceCardSelected: {
    borderColor: "#E50914",
    backgroundColor: "#221111",
  },
  sourceTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sourceQuality: {
    color: "#E50914",
    fontWeight: "bold",
    fontSize: 13,
  },
  sourceProvider: {
    color: "#888",
    fontSize: 11,
  },
  sourceTitle: {
    color: "#ddd",
    fontSize: 11,
    marginBottom: 8,
  },
  sourceMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    color: "#aaa",
    fontSize: 11,
  },
  emptyText: {
    color: "#666",
    fontSize: 13,
  },
  episodesSection: {
    paddingHorizontal: 40,
    paddingVertical: 20,
  },
  episodeRow: {
    backgroundColor: "#141414",
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  episodeRowSelected: {
    backgroundColor: "#1e1e1e",
    borderColor: "#E50914",
    borderWidth: 1,
  },
  episodeInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  epNumber: {
    color: "#888",
    fontSize: 18,
    fontWeight: "bold",
    width: 30,
    textAlign: "center",
  },
  epInfo: {
    flex: 1,
  },
  epTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 3,
  },
  epOverview: {
    color: "#777",
    fontSize: 12,
  },
  playingPill: {
    backgroundColor: "#E50914",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  playingPillText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
});
