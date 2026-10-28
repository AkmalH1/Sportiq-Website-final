import { Flash } from "@/components/AdminBits";
import { requireAdmin } from "@/lib/admin-auth";
import { listForAdmin } from "@/lib/reviews";
import { reviewAction } from "../ops-actions";

export const dynamic = "force-dynamic";

export default async function ReviewsAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const list = await listForAdmin();
  return (
    <div>
      <h1 className="display text-5xl">Reviews</h1>
      <p className="mt-4 text-sm text-stone">Customer reviews appear on the site only after you approve them.</p>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>
      <ul className="space-y-4">
        {list.map((r) => (
          <li key={r.id} className="grid gap-4 border border-line p-5 md:grid-cols-[1fr_auto]">
            <div>
              <p><span className="text-accent">{"★".repeat(r.rating)}</span><span className="text-line">{"★".repeat(5 - r.rating)}</span> <strong>{r.name}</strong> <span className="eyebrow ml-2">{r.status}</span></p>
              <p className="mt-2 text-sm">{r.body}</p>
              <p className="mt-1 text-xs text-stone">{r.created_at}{r.product_slug && ` · product: ${r.product_slug}`}</p>
              {r.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={r.image_url} target="_blank" rel="noreferrer"><img src={r.image_url} alt="Review photo" className="mt-3 h-32 w-32 object-cover" /></a>
              )}
            </div>
            <form action={reviewAction} className="flex flex-wrap items-start gap-2">
              <input type="hidden" name="id" value={r.id} />
              {r.status !== "approved" && <button name="do" value="approve" className="btn btn-primary !px-4 !py-2 text-xs">Approve</button>}
              {r.status !== "rejected" && <button name="do" value="reject" className="btn btn-ghost !px-4 !py-2 text-xs">Reject</button>}
              <button name="do" value="delete" className="text-xs underline text-stone">Delete</button>
            </form>
          </li>
        ))}
        {list.length === 0 && <li className="border border-dashed border-line p-10 text-center text-stone">No reviews yet.</li>}
      </ul>
    </div>
  );
}
