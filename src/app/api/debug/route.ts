import { NextResponse, NextRequest } from "next/server";
import { ensureDaemonRunning, startTorrent } from "@/lib/torrent-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const magnet = body?.magnet;
    await ensureDaemonRunning();
    if (magnet) {
      const result = await startTorrent(magnet);
      return NextResponse.json({ success: true, result });
    }
    return NextResponse.json({ success: true, daemonRunning: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
