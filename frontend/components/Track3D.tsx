/** 3D tracking board. A parcel cube floats above the current stage. Stage names are always real text for screen readers. */
export function Cube({ small }: { small?: boolean }) {
  const h = small ? "18px" : "28px";
  return (
    <div className="[perspective:600px]" aria-hidden="true">
      <div className={`cube ${small ? "cube-sm" : ""}`} style={{ ["--h" as string]: h }}>
        <i>Q</i><i>S</i><i>Q</i><i>S</i><i /><i />
      </div>
    </div>
  );
}

export function Track3D({ stages, current }: { stages: readonly string[]; current: number }) {
  const n = stages.length;
  const pct = n > 1 ? Math.max(0, Math.min(1, current / (n - 1))) : 0;
  return (
    <div>
      {/* wide screens: tilted 3D board */}
      <div className="board3d relative hidden pt-24 md:block" aria-hidden="true">
        <div className="absolute top-0 z-10 -translate-x-1/2 transition-[left] duration-700" style={{ left: `${((Math.max(current, 0) + 0.5) / n) * 100}%` }}>
          <div className="bob relative">
            <Cube />
            <span className="pulse-ring absolute left-1/2 top-[88px] h-6 w-6 -translate-x-1/2 rounded-full border-2 border-accent" />
          </div>
        </div>
        <div className="board3d-plane">
          <div className="relative grid gap-3 border border-line bg-mist p-4" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            <span className="absolute left-4 right-4 top-1/2 h-1 -translate-y-1/2 bg-line" />
            <span className="absolute left-4 top-1/2 h-1 -translate-y-1/2 bg-accent transition-[width] duration-700" style={{ width: `calc((100% - 2rem) * ${pct})` }} />
            {stages.map((s, i) => (
              <div key={s} className={`tile3d ${i < current ? "done" : i === current ? "now" : "todo"} relative flex aspect-[4/3] flex-col items-center justify-center p-2 text-center ${i <= current ? "bg-accent text-ink" : "bg-paper text-stone"}`}>
                <span className="eyebrow !tracking-[0.15em] opacity-70">{i + 1}</span>
                <span className="display mt-1 text-lg leading-none xl:text-2xl">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* real list: the accessible version, and the layout on phones */}
      <ol className="relative mt-6 space-y-3 md:sr-only md:mt-0" aria-label="Order progress">
        {stages.map((s, i) => {
          const now = i === current;
          const done = i < current;
          return (
            <li key={s} aria-current={now ? "step" : undefined}
              className={`relative flex items-center gap-4 border p-4 transition ${now ? "border-ink bg-accent text-ink shadow-[0_10px_0_-4px_#823a03,0_18px_30px_rgba(244,114,10,0.35)]" : done ? "border-accent/50 bg-accent/10" : "border-line text-stone"}`}
              style={{ transform: now ? "perspective(700px) rotateY(-4deg) translateZ(12px)" : undefined }}>
              {now ? <div className="shrink-0"><Cube small /></div> : <span className={`flex h-9 w-9 shrink-0 items-center justify-center border text-xs font-semibold ${done ? "border-accent bg-accent text-ink" : "border-line"}`}>{done ? "✓" : i + 1}</span>}
              <span>
                <span className="display block text-2xl leading-none">{s}</span>
                {now && <span className="eyebrow mt-1 block">Current stage</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
