import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const magnet = sp.get("magnet") || "";
  const name = sp.get("name") || "download";
  const hash = sp.get("hash") || "";

  if (!magnet && !hash) {
    return NextResponse.json({ error: "Missing magnet or hash parameter" }, { status: 400 });
  }

  const safeName = (name || "torrent")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  // If we have hash and source indicates yts, try fetching actual .torrent file
  if (hash) {
    try {
      const ytsUrl = `https://yts.mx/torrent/download/${hash.toUpperCase()}`;
      const res = await fetch(ytsUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        if (buffer.byteLength > 100) {
          return new Response(buffer, {
            status: 200,
            headers: {
              "Content-Type": "application/x-bittorrent",
              "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}.torrent"`,
              "Content-Length": String(buffer.byteLength),
            },
          });
        }
      }
    } catch {
      // Fall through to .magnet file download
    }
  }

  // Provide .magnet file download
  const content = (magnet || `magnet:?xt=urn:btih:${hash}`).trim() + "\n";
  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "application/x-bittorrent; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}.magnet"`,
      "Content-Length": String(Buffer.byteLength(content, "utf-8")),
    },
  });
}
