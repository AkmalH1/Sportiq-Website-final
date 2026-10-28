"use client";

/** Header checkbox that ticks or unticks every product checkbox (name="slug") in the same form. */
export function SelectAllBox() {
  return (
    <input
      type="checkbox"
      aria-label="Select all products"
      onChange={(e) => {
        const form = e.currentTarget.closest("form");
        form?.querySelectorAll<HTMLInputElement>('input[name="slug"]').forEach((b) => { b.checked = e.currentTarget.checked; });
      }}
    />
  );
}
