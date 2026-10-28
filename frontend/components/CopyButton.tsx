"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy code" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost !px-4 !py-2 text-xs"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* clipboard blocked: the code is shown on screen to copy by hand */ }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
