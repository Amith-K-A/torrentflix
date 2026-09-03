import { NextRequest, NextResponse } from "next/server";
import { searchTorrents } from "@/lib/torrent-search";
import type { MediaType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = (sp.get("type") === "tv" ? "tv" : "movie") as MediaType;
  const tmdbId = sp.get("tmdbId") ? Number(sp.get("tmdbId")) : undefined;
  const imdbId = sp.get("imdbId");
  const title = sp.get("title") ?? "";
  const year = sp.get("year");
  const season = sp.get("season") ? Number(sp.get("season")) : undefined;
  const episode = sp.get("episode") ? Number(sp.get("episode")) : undefined;

  if (!title && !tmdbId && !imdbId) {
    return NextResponse.json({ error: "Need title, tmdbId or imdbId" }, { status: 400 });
  }

  try {
    const results = await searchTorrents({
      type,
      tmdbId,
      imdbId,
      title,
      year,
      season,
      episode,
    });
    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Torrent search failed", results: [] },
      { status: 502 }
    );
  }
}
