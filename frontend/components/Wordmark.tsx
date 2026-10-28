export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`display ${className}`} aria-label="SPORTIQ">
      <span className="text-ink">SPORTI</span>
      <span className="text-accent">Q</span>
    </span>
  );
}
