export function CapIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 90" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M14 62C14 30 40 12 72 14c28 2 42 22 44 44" />
      <path d="M14 62h102c20 0 34 4 38 10-6 6-26 8-44 6-24-3-70-3-96-2z" fill="currentColor" fillOpacity="0.08" />
      <path d="M72 14v48M44 22c8 10 12 24 12 40M100 24c-6 10-8 22-8 38" strokeWidth="2" />
      <circle cx="72" cy="11" r="4" fill="currentColor" />
    </svg>
  );
}
