"use client";

import { useRef } from "react";
import type { SizeChart } from "@/lib/sizechart";

export function SizeGuide({ chart, title }: { chart: SizeChart; title: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className="inline-flex min-h-11 items-center text-xs font-semibold uppercase tracking-widest underline underline-offset-4 hover:text-accent-dark">
        Size chart
      </button>
      <dialog
        ref={ref}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
        className="m-auto w-[min(92vw,40rem)] max-h-[85vh] overflow-auto border border-ink bg-paper p-0 text-ink backdrop:bg-black/60"
        aria-label={`${title} size chart`}
      >
        <div className="flex items-start justify-between gap-6 border-b border-line p-5">
          <div>
            <p className="eyebrow text-accent-dark">Size chart</p>
            <h2 className="display mt-1 text-3xl">{title}</h2>
          </div>
          <button type="button" onClick={() => ref.current?.close()} className="h-10 w-10 border border-line text-lg hover:bg-ink hover:text-paper" aria-label="Close size chart">×</button>
        </div>
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[22rem] text-left text-sm">
            <thead className="eyebrow border-b border-ink"><tr>{chart.headers.map((h) => <th key={h} className="py-2 pr-4">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {chart.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className={`py-2.5 pr-4 ${j === 0 ? "font-semibold" : ""}`}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
          {chart.notes.map((n) => <p key={n} className="mt-4 text-xs text-stone">{n}</p>)}
        </div>
      </dialog>
    </>
  );
}
