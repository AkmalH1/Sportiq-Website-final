export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return (
    <p role="status" className={`mb-6 border-l-2 p-4 text-sm ${err ? "border-red-600 bg-red-50 text-red-800" : "border-accent bg-mist"}`}>
      {err || ok}
    </p>
  );
}
