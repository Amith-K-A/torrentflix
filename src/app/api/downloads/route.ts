import { NextRequest, NextResponse } from "next/server";
import { getAllDownloadsStats } from "@/lib/torrent-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const stats = await getAllDownloadsStats();
    return NextResponse.json(stats);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to get downloads status" },
      { status: 500 }
    );
  }
}
