import { NextResponse } from "next/server";
import { clientIp, limited } from "@/lib/ratelimit";
import { StorageFullError, saveImage } from "@/lib/upload";
import { BodyTimeout, BodyTooLarge, GateFull, createGate, parseFormLimited } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

/** Hard limits for this public endpoint (one image per request). Caddy enforces a matching 5 MB cap in front (see Caddyfile). */
const MAX_BODY = 5 * 1024 * 1024; // whole multipart body, counted on the stream before it is parsed
const MAX_PARTS = 4;              // form fields + file, however many the client sends
const gate = createGate(Math.max(1, Number(process.env.PUBLIC_UPLOAD_CONCURRENCY || 3)), 0); // at most 3 uploads processed at once, no queueing

const log = (event: string, extra: Record<string, string | number> = {}) =>
  console.warn(`[upload] ${event} ${Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(" ")}`.trim());

/** Public image upload for customers (jersey customisation images, review photos, exchange photos). */
export async function POST(req: Request) {
  if (await limited("upload:" + clientIp(req.headers), 15, 10 * 60 * 1000)) {
    log("rate-limited");
    return NextResponse.json({ error: "Too many uploads. Please wait a few minutes." }, { status: 429 });
  }
  // Global ceiling so many addresses together cannot fill the disk (each stored image is at most ~1600px WebP; 15 per address per 10 min is the real per-visitor limit).
  if (await limited("upload-all", 2000, 60 * 60 * 1000)) {
    log("global-ceiling");
    return NextResponse.json({ error: "Uploads are busy right now. Please try again later." }, { status: 429 });
  }
  try {
    return await gate.run(async () => {
      const fd = await parseFormLimited(req, MAX_BODY, 30_000);
      const entries = [...fd.entries()];
      if (entries.length > MAX_PARTS) return NextResponse.json({ error: "Too many form fields." }, { status: 400 });
      const files = entries.filter(([, v]) => typeof v !== "string");
      if (files.length !== 1 || files[0][0] !== "file") return NextResponse.json({ error: "Choose one image." }, { status: 400 });
      const file = files[0][1] as File;
      return NextResponse.json({ url: await saveImage(file, true) });
    });
  } catch (e) {
    if (e instanceof BodyTooLarge) { log("too-large"); return NextResponse.json({ error: "Image is larger than 4 MB." }, { status: 413 }); }
    if (e instanceof BodyTimeout) { log("slow-body"); return NextResponse.json({ error: "Upload took too long." }, { status: 408 }); }
    if (e instanceof GateFull) { log("busy"); return NextResponse.json({ error: "Uploads are busy right now. Please try again in a moment." }, { status: 503, headers: { "Retry-After": "5" } }); }
    if (e instanceof StorageFullError) return NextResponse.json({ error: e.message }, { status: 503, headers: { "Retry-After": "600" } });
    if (e instanceof TypeError) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed." }, { status: 400 });
  }
}
