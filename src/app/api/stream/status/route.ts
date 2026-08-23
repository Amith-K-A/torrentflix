import { NextRequest, NextResponse } from "next/server";
import { getTorrentStats } from "@/lib/torrent-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const infoHash = (req.nextUrl.searchParams.get("infoHash") ?? "").toLowerCase();
  const stats = await getTorrentStats(infoHash);
  if (!stats) {
    return NextResponse.json({ error: "Torrent not found" }, { status: 404 });
  }
  return NextResponse.json(stats);
}
