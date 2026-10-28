"use client";

import { useState } from "react";
import { postageAction } from "@/app/public-actions";
import { COUNTRIES } from "@/lib/countries";
import { formatLkr } from "@/lib/format";

export function PostageCalculator() {
  const [country, setCountry] = useState("GB");
  const [items, setItems] = useState(1);
  const [res, setRes] = useState<Awaited<ReturnType<typeof postageAction>> | null>(null);
  const [busy, setBusy] = useState(false);

  async function calc() {
    setBusy(true);
    setRes(await postageAction(country, items * 400));
    setBusy(false);
  }
  return (
    <div className="max-w-xl border border-line p-6">
      <p className="eyebrow">Postage calculator</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_8rem]">
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="field" aria-label="Country">
          {COUNTRIES.filter((c) => c.code !== "LK").map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select value={items} onChange={(e) => setItems(Number(e.target.value))} className="field" aria-label="Number of shirts">
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n} shirt{n > 1 ? "s" : ""}</option>)}
        </select>
      </div>
      <button type="button" onClick={calc} disabled={busy} className="btn btn-primary mt-4">{busy ? "Calculating…" : "Calculate"}</button>
      <div aria-live="polite" className="mt-4 text-sm">
        {res?.error && <p className="text-red-700">{res.error}</p>}
        {res?.fee !== undefined && (
          <p><strong>{formatLkr(res.fee)}</strong> postage · {res.days}. <span className="text-stone">Final postage is shown at checkout.</span></p>
        )}
      </div>
    </div>
  );
}
