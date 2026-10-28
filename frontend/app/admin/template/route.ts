import { isAdmin } from "@/lib/admin-auth";
import { CSV_TEMPLATE } from "@/lib/import";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  return new Response(CSV_TEMPLATE, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="sportiq-products-template.csv"' },
  });
}
