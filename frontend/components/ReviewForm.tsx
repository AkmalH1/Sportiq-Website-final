"use client";

import { useActionState, useState } from "react";
import { submitReviewAction, type FormState } from "@/app/public-actions";
import { ImagePicker } from "./ImagePicker";

export function ReviewForm({ product = "" }: { product?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitReviewAction, {});
  const [rating, setRating] = useState(5);
  const v = state.values ?? {};
  if (state.ok) return <p role="status" className="border-l-2 border-accent bg-mist p-5 text-sm">{state.ok}</p>;
  return (
    <form action={action} className="grid max-w-xl gap-4">
      <input type="hidden" name="product" value={product} />
      <input type="hidden" name="rating" value={rating} />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <input name="name" defaultValue={v.name} required maxLength={60} placeholder="Your name" className="field" aria-label="Your name" />
      <fieldset>
        <legend className="eyebrow mb-2">Rating</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)} className={`h-11 w-11 text-3xl leading-none ${n <= rating ? "text-accent" : "text-line"}`}>★</button>
          ))}
        </div>
      </fieldset>
      <textarea name="body" defaultValue={v.body} required minLength={10} maxLength={1200} rows={4} placeholder="Tell us about your order" className="field" aria-label="Your review" />
      <ImagePicker name="image" label="Add a photo (optional)" />
      {state.error && <p role="alert" className="border-l-2 border-red-600 bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      <button disabled={pending} className="btn btn-primary w-fit">{pending ? "Sending…" : "Submit review"}</button>
      <p className="text-xs text-stone">Reviews are checked by our team before they appear on the site.</p>
    </form>
  );
}
