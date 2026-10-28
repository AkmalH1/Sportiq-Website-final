export function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <li className="border border-line p-5">
      <p className="display text-4xl md:text-5xl">{value}</p>
      <p className="eyebrow mt-2 text-stone">{label}</p>
      {sub && <p className="mt-1 text-xs text-stone">{sub}</p>}
    </li>
  );
}

export function AField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="eyebrow mb-2 block text-stone">{label}</span>
      {children}
    </label>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-2xl text-sm text-stone">{children}</p>;
}

/** Download link for a CSV export (a file download, not a page, so a plain anchor is correct). */
export function ExportLink({ kind }: { kind: string }) {
  return (
    <a href={`/admin/export/${kind}`} download className="btn btn-ghost">Export CSV</a>
  );
}
