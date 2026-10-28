import { isAdmin } from "@/lib/admin-auth";
import { exportCsv } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { kind } = await params;
  const csv = await exportCsv(kind);
  if (csv === null) return new Response("Not found", { status: 404 });
  return new Response("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="sportiq-${kind}.csv"` },
  });
}
