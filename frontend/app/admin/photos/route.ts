import { adminName } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { StorageFullError, saveImage } from "@/lib/upload";
import { BodyTimeout, BodyTooLarge, GateFull, createGate, parseFormLimited, readBodyLimited, sameOrigin } from "@/lib/request-guard";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/** Hard limits for one photo request (one product: main photo + gallery). The importer's browser shrinks photos to <= 1600px WebP first, so real requests are far smaller. */
const MAX_BODY = 24 * 1024 * 1024; // aggregate multipart body, counted on the stream before parsing (Caddy staff host allows 26 MB, Next server actions 25 MB)
const MAX_FILES = 7;               // main + 6 gallery
const MAX_PARTS = 12;
// The importer runs 4 workers: allow 3 processed at once and 8 waiting; more than that is told to retry.
const gate = createGate(Math.max(1, Number(process.env.ADMIN_UPLOAD_CONCURRENCY || 3)), 8);

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Photo upload for the bulk importer. Two calls, both admin only (the admin cookie is SameSite=Strict, so other sites cannot trigger this):
 *  - JSON {slugs:[...]}  ->  {missing:[...]}: which of those products still have no main photo (so a re-run skips finished ones).
 *  - JSON {done:true}: refresh the site's cached pages once at the end.
 *  - multipart slug + files[]  ->  attaches the first file as the main photo and the rest (max 6) as the gallery.
 * Every file goes through saveImage(): real file signature check, decode, re-encode, 4 MB limit.
 */
export async function POST(req: Request) {
  if (!(await adminName())) return json({ error: "Not signed in" }, 401);
  // This is a plain route (not a server action), so Next's own Origin check does not cover it: check it here as well as SameSite=Strict.
  if (!sameOrigin(req.headers, [process.env.ADMIN_HOST ?? ""].filter(Boolean))) return json({ error: "Cross-site request refused" }, 403);
  const type = req.headers.get("content-type") ?? "";

  if (type.includes("application/json")) {
    let body: { slugs?: unknown; done?: unknown } | null = null;
    try { body = JSON.parse(new TextDecoder().decode(await readBodyLimited(req, 256 * 1024, 15_000))); } catch { /* too large, slow or not JSON: treated as empty */ }
    if (body?.done) { revalidatePath("/", "layout"); return json({ ok: true }); }
    const slugs = Array.isArray(body?.slugs) ? body.slugs.filter((x): x is string => typeof x === "string").slice(0, 1000) : [];
    if (!slugs.length) return json({ missing: [] });
    const rows = (await db().prepare("SELECT slug FROM products WHERE slug IN (?) AND (image_url = '' OR (image_url NOT LIKE '/%' AND image_url NOT LIKE 'https://%'))").all(slugs)) as { slug: string }[];
    return json({ missing: rows.map((r) => r.slug) });
  }

  try {
    return await gate.run(() => handleUpload(req));
  } catch (e) {
    if (e instanceof BodyTooLarge) { console.warn("[photos] too-large"); return json({ error: "Upload is too large (24 MB per request). Send fewer or smaller photos." }, 413); }
    if (e instanceof BodyTimeout) return json({ error: "Upload took too long" }, 408);
    if (e instanceof GateFull) return json({ error: "Busy, try again in a moment" }, 503);
    if (e instanceof StorageFullError) return json({ error: e.message }, 507);
    return json({ error: "Upload too large or unreadable" }, 400);
  }
}

async function handleUpload(req: Request): Promise<Response> {
  const fd = await parseFormLimited(req, MAX_BODY, 90_000);
  if ([...fd.keys()].length > MAX_PARTS) return json({ error: "Too many form fields" }, 400);
  const slug = String(fd.get("slug") ?? "");
  const all = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (all.length > MAX_FILES) return json({ error: `At most ${MAX_FILES} photos per product` }, 400);
  const files = all;
  if (!slug || !files.length) return json({ error: "slug and files are required" }, 400);
  const product = (await db().prepare("SELECT id FROM products WHERE slug = ?").get(slug)) as { id: number } | undefined;
  if (!product) return json({ error: "Unknown product" }, 404);

  const urls: string[] = [];
  const failed: string[] = [];
  for (const f of files) {
    try { urls.push(await saveImage(f)); } catch (e) { failed.push(`${f.name}: ${e instanceof Error ? e.message : "failed"}`); }
  }
  if (urls.length) {
    await db().prepare("UPDATE products SET image_url = ?, gallery = ? WHERE id = ?").run(urls[0], JSON.stringify(urls.slice(1, 7)), product.id);
  }
  return json({ saved: urls.length, failed });
}
