import { requireAdmin } from "@/lib/admin-auth";
import { listActivity } from "@/lib/ops";

export const dynamic = "force-dynamic";

export default async function Activity() {
  await requireAdmin();
  return (
    <div>
      <h1 className="display text-5xl">Activity log</h1>
      <ul className="mt-8 divide-y divide-line border-y border-line text-sm">
        {(await listActivity()).map((a) => (
          <li key={a.id} className="flex flex-wrap justify-between gap-x-6 break-words py-2.5">
            <span className="min-w-0 max-w-full break-all"><strong>{a.action}</strong> <span className="text-stone">{a.detail}</span></span>
            <span className="text-xs text-stone">{a.actor} · {a.created_at}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
