import { NextRequest, NextResponse } from "next/server";
import { pauseDownload, resumeDownload, cancelDownload, clearAllDownloads, clearAllErrors, retryDownload } from "@/lib/torrent-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action: string = body?.action;
    const id: string = body?.id;

    if (action === "clear_all") {
      await clearAllDownloads();
      return NextResponse.json({ success: true });
    } else if (action === "clear_errors") {
      await clearAllErrors();
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ error: "Missing download id" }, { status: 400 });
    }

    if (action === "pause") {
      await pauseDownload(id);
    } else if (action === "resume") {
      await resumeDownload(id);
    } else if (action === "cancel") {
      await cancelDownload(id);
    } else if (action === "retry") {
      const result = await retryDownload(id);
      return NextResponse.json({ success: true, ...result });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to perform action" },
      { status: 502 }
    );
  }
}
