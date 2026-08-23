import { NextRequest, NextResponse } from "next/server";
import { tmdb, tmdbConfigured } from "@/lib/tmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!tmdbConfigured()) {
    return NextResponse.json(
      { error: "TMDB not configured. Add TMDB_API_KEY to .env.local." },
      { status: 503 }
    );
  }
  const { path } = await params;
  const qs: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => (qs[k] = v));
  try {
    const data = await tmdb("/" + path.join("/"), qs);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "TMDB request failed" },
      { status: 502 }
    );
  }
}
