import { NextRequest, NextResponse } from "next/server";
import { fileRangeStream, getTorrentFile } from "@/lib/torrent-client";
import { contentTypeFor } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const infoHash = (sp.get("infoHash") ?? "").toLowerCase();
  const fileIdx = Number(sp.get("fileIdx") ?? "0");
  if (!infoHash) {
    return NextResponse.json({ error: "infoHash required" }, { status: 400 });
  }

  const found = await getTorrentFile(infoHash, fileIdx);
  if (!found) {
    return NextResponse.json(
      { error: "Torrent not started or still loading metadata" },
      { status: 404 }
    );
  }
  const { file } = found;
  const size: number = file.length ?? 0;
  const type = contentTypeFor(file.name ?? "");

  const rangeHeader = req.headers.get("range");
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? Math.min(parseInt(match[2], 10), size - 1) : size - 1;
      if (start >= size || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      const stream = fileRangeStream(file, start, end);
      return new NextResponse(stream as any, {
        status: 206,
        headers: {
          "Content-Type": type,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store",
        },
      });
    }
  }

  const stream = fileRangeStream(file, 0, Math.max(size - 1, 0));
  return new NextResponse(stream as any, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    },
  });
}
