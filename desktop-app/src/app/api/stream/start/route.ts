import { NextRequest, NextResponse } from "next/server";
import { startTorrent } from "@/lib/torrent-client";
import { infoHashFromMagnet } from "@/lib/trackers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const magnet: string = body?.magnet ?? "";
    if (!infoHashFromMagnet(magnet)) {
      return NextResponse.json({ error: "Invalid magnet URI" }, { status: 400 });
    }
    const num = (v: unknown) => (Number.isInteger(v) ? (v as number) : undefined);
    const started = await startTorrent(magnet, {
      fileIdx: num(body?.fileIdx),
      season: num(body?.season),
      episode: num(body?.episode),
      title: body?.title,
      posterPath: body?.posterPath,
      type: body?.type,
      tmdbId: num(body?.tmdbId),
      imdbId: body?.imdbId,
      episodeName: body?.episodeName,
    });
    return NextResponse.json(started);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to start torrent" },
      { status: 502 }
    );
  }
}
