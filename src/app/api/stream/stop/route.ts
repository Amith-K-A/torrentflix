import { NextRequest, NextResponse } from "next/server";
import { stopStreaming } from "@/lib/torrent-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stream/stop — immediately free a streaming torrent from RAM.
 * Called when the player closes so we don't hold pieces in memory for 10+ min.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const infoHash: string = (body?.infoHash ?? "").toLowerCase();
    if (!infoHash) {
      return NextResponse.json({ error: "infoHash required" }, { status: 400 });
    }
    await stopStreaming(infoHash);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to stop torrent" },
      { status: 500 }
    );
  }
}
