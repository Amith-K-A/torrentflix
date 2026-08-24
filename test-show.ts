import { getDetails } from "./src/lib/tmdb";
import { searchTorrents } from "./src/lib/torrent-search";
async function run() {
  const details = await getDetails("tv", "316294");
  console.log("Show:", details.title, "IMDB:", details.imdb_id);
  const results = await searchTorrents({
    type: "tv",
    title: details.title,
    tmdbId: details.id,
    imdbId: details.imdb_id,
    season: 1,
    episode: 1
  });
  console.log("Results:");
  console.log(results.map(r => ({ name: r.name.substring(0, 40), seeds: r.seeds, source: r.source })));
}
run();
