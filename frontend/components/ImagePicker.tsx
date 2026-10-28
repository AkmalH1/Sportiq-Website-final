"use client";

import { useState } from "react";

/** Uploads a photo straight away and keeps its URL in a hidden field (or reports it through onChange). */
export function ImagePicker({
  name, label = "Attach a photo", value, onChange,
}: { name?: string; label?: string; value?: string; onChange?: (url: string) => void }) {
  const [url, setUrl] = useState(value ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setUrl(data.url);
      onChange?.(data.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {name && <input type="hidden" name={name} value={url} />}
      <div className="flex items-center gap-3">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Attached" className="h-14 w-14 border border-line object-cover" />
        )}
        <label className="btn btn-ghost cursor-pointer !px-4 !py-2 text-xs">
          {busy ? "Uploading…" : url ? "Change photo" : label}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {url && (
          <button type="button" className="text-xs underline text-stone" onClick={() => { setUrl(""); onChange?.(""); }}>Remove</button>
        )}
      </div>
      {err && <p role="alert" className="mt-1 text-xs text-red-700">{err}</p>}
    </div>
  );
}
