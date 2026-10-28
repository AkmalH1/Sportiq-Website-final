import { readFile } from "node:fs/promises";
import path from "node:path";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Private payment receipts. Staff only; never cached or indexed. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { name } = await params;
  if (!/^[a-f0-9]{32}\.webp$/.test(name)) return new Response("Not found", { status: 404 });
  try {
    const buf = await readFile(path.join(process.cwd(), "data", "private", "proofs", name));
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Content-Disposition": "inline" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
