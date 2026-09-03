import { NextRequest, NextResponse } from "next/server";
import { getTorrentStats } from "@/lib/torrent-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const infoHash = (sp.get("infoHash") ?? "").toLowerCase();
  const fileIdx = sp.has("fileIdx") ? Number(sp.get("fileIdx")) : undefined;
  const stats = await getTorrentStats(infoHash, fileIdx);
  if (!stats) {
    return NextResponse.json({ error: "Torrent not found" }, { status: 404 });
  }
  return NextResponse.json(stats);
}
