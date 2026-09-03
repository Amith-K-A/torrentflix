import { NextRequest, NextResponse } from "next/server";
import path from "path";
import os from "os";
import fs from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStoreFilePath(): string {
  const dir = path.join(os.homedir(), "Downloads", "TorrentFlix");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return path.join(dir, ".store.json");
}

function readDiskStore(): Record<string, any> {
  try {
    const file = getStoreFilePath();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf-8");
      return JSON.parse(raw) || {};
    }
  } catch (e) {
    console.error("[TorrentFlix] Failed to read disk store:", e);
  }
  return {};
}

function writeDiskStore(data: Record<string, any>) {
  try {
    const file = getStoreFilePath();
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("[TorrentFlix] Failed to write disk store:", e);
  }
}

export async function GET() {
  const store = readDiskStore();
  return NextResponse.json({ store });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const current = readDiskStore();

    if (body.key && body.value !== undefined) {
      current[body.key] = body.value;
    } else if (body.store && typeof body.store === "object") {
      Object.assign(current, body.store);
    }

    writeDiskStore(current);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to save store" },
      { status: 500 }
    );
  }
}
