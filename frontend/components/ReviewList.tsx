import type { Review } from "@/lib/reviews";

export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return (
      <div className="border border-dashed border-line bg-mist p-12 text-center">
        <p className="font-semibold">No reviews yet</p>
        <p className="mt-1 text-sm text-stone">Be the first to share your order.</p>
      </div>
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {reviews.map((r) => (
        <li key={r.id} className="border border-line bg-paper p-5">
          <p className="text-accent" aria-label={`${r.rating} out of 5 stars`}>{"★".repeat(r.rating)}<span className="text-line">{"★".repeat(5 - r.rating)}</span></p>
          <p className="mt-3 text-sm leading-relaxed">{r.body}</p>
          {r.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.image_url} alt={`Photo from ${r.name}`} className="mt-4 aspect-square w-full object-cover" loading="lazy" />
          )}
          <p className="eyebrow mt-4 text-stone">{r.name}</p>
        </li>
      ))}
    </ul>
  );
}
