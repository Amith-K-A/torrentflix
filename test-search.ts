import { searchTorrents } from "./src/lib/torrent-search";
async function run() {
  const res = await searchTorrents({
    type: "tv",
    title: "Knot",
    tmdbId: 303493,
    imdbId: "tt38916337",
    season: 1,
    episode: 1
  });
  console.log(res.map(r => ({ name: r.name.substring(0, 30), seeds: r.seeds, source: r.source })));
}
run();
