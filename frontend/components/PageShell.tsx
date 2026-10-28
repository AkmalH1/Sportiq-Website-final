export function PageShell({ eyebrow, title, children, narrow = false }: { eyebrow?: string; title: string; children?: React.ReactNode; narrow?: boolean }) {
  return (
    <div className={`mx-auto px-4 py-16 lg:px-10 ${narrow ? "max-w-3xl" : "max-w-[1400px]"}`}>
      {eyebrow && <p className="eyebrow text-accent-dark">{eyebrow}</p>}
      <h1 className="display mt-3 text-5xl md:text-7xl">{title}</h1>
      <div className="mt-12">{children}</div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-line bg-mist p-12 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-stone">{body}</p>
    </div>
  );
}
