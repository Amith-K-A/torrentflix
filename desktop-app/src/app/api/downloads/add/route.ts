import { NextRequest, NextResponse } from "next/server";
import { startDownload } from "@/lib/torrent-client";
import { infoHashFromMagnet } from "@/lib/trackers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const magnet: string = body?.magnet ?? "";
    const title: string = body?.title ?? "Unknown Title";
    const posterPath: string = body?.posterPath ?? "";

    if (!infoHashFromMagnet(magnet)) {
      return NextResponse.json({ error: "Invalid magnet URI" }, { status: 400 });
    }

    const result = await startDownload(magnet, title, posterPath);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to add download" },
      { status: 502 }
    );
  }
}
