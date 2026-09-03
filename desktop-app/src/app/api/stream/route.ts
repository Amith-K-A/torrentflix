import { NextRequest, NextResponse } from "next/server";
import { fileRangeStream, getTorrentFile, prioritizeStreamRange } from "@/lib/torrent-client";
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

  if (req.signal.aborted) {
    return new NextResponse(null, { status: 499 });
  }

  if ((globalThis as any).__ltDownloads?.has(infoHash)) {
    try {
      const targetUrl = `http://127.0.0.1:8080/stream?infoHash=${infoHash}&fileIdx=${fileIdx}`;
      
      const reqHeaders: Record<string, string> = {};
      const range = req.headers.get("range");
      if (range) reqHeaders["Range"] = range;

      const res = await fetch(targetUrl, { headers: reqHeaders, signal: req.signal });
      
      if (res.ok || res.status === 206) {
        let streamReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        
        const wrapperStream = new ReadableStream({
          async start(controller) {
            streamReader = res.body?.getReader();
            if (!streamReader) {
              controller.close();
              return;
            }
            try {
              while (true) {
                const { done, value } = await streamReader.read();
                if (done) break;
                controller.enqueue(value);
              }
              controller.close();
            } catch (e: any) {
              if (
                e.name === 'AbortError' || 
                e.code === 'UND_ERR_RES_CONTENT_LENGTH_MISMATCH' || 
                (e.message && e.message.includes('Aborted')) ||
                (e.message && e.message.includes('terminated'))
              ) {
                controller.close();
              } else {
                controller.error(e);
              }
            }
          },
          cancel() {
            if (streamReader) {
              streamReader.cancel().catch(() => {});
            }
          }
        });

        return new NextResponse(wrapperStream as any, {
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
        });
      }
    } catch (e: any) {
      if (
        req.signal.aborted || 
        e.name === 'AbortError' || 
        (e.message && e.message.includes('Aborted')) ||
        e.code === 'UND_ERR_RES_CONTENT_LENGTH_MISMATCH'
      ) {
        return new NextResponse(null, { status: 499 }); // 499 Client Closed Request
      }
      console.warn("Libtorrent proxy failed, trying WebTorrent...", e);
    }
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

      // Prioritize the stream piece window for this range request
      prioritizeStreamRange(file, start, end);

      const stream = fileRangeStream(file, start, end, req.signal);
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

  prioritizeStreamRange(file, 0, Math.max(size - 1, 0));
  const stream = fileRangeStream(file, 0, Math.max(size - 1, 0), req.signal);
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
