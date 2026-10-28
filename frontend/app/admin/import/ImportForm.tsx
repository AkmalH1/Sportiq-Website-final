"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { importCsvAction, type ImportState } from "../actions";

type Photos = { slug: string; files: string[] }[];
type Progress = { total: number; done: number; saved: number; skipped: number; failed: number; running: boolean; finished: boolean; errors: string[] };

/** Shrinks a photo in the browser (max 1600 px, WebP) so thousands of uploads stay fast. Falls back to the original file. */
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" }) : file;
  } catch { return file; }
}

/** ScraperX saves a product's photos as name_0.jpg, name_1.png, name_2.webp… The sheet lists only name_0, so also pick up the numbered ones next to it (main photo + up to 4 more). */
function withSiblings(find: (k: string) => File | undefined) {
  return (key: string): File[] => {
    const first = find(key);
    if (!first) return [];
    const m = /^(.*)_0\.(jpe?g|png|webp)$/i.exec(key);
    if (!m) return [first];
    const out = [first];
    for (let n = 1; n <= 4; n++) {
      const hit = ["jpg", "jpeg", "png", "webp"].map((e) => find(`${m[1]}_${n}.${e}`)).find((f) => f && f.name.toLowerCase().startsWith(m[1].split("/").pop()!.toLowerCase() + `_${n}.`));
      if (hit) out.push(hit);
    }
    return out;
  };
}

/** Finds the picked file for an Excel path such as "milan/a_0.jpg": try folder/file first, then the file name alone. */
function indexFolder(files: File[]) {
  const m = new Map<string, File>();
  for (const f of files) {
    const rel = ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).toLowerCase().split("/");
    m.set(rel.slice(-2).join("/"), f);
    if (!m.has(rel[rel.length - 1])) m.set(rel[rel.length - 1], f);
  }
  return (key: string) => m.get(key.toLowerCase()) ?? m.get(key.toLowerCase().split("/").pop()!);
}

export function ImportForm({ sports }: { sports: { slug: string; name: string }[] }) {
  const [res, action, pending] = useActionState<ImportState, FormData>(importCsvAction, null);
  const [folder, setFolder] = useState<File[]>([]);
  const [prog, setProg] = useState<Progress | null>(null);
  const stop = useRef(false);
  const startedFor = useRef<ImportState>(null);

  async function uploadPhotos(plan: Photos) {
    const find = indexFolder(folder);
    const expand = withSiblings(find);
    stop.current = false;
    const p: Progress = { total: plan.length, done: 0, saved: 0, skipped: 0, failed: 0, running: true, finished: false, errors: [] };
    const push = () => setProg({ ...p, errors: p.errors.slice(0, 20) });
    push();
    try {
      // Skip products that already have a photo, so a stopped or repeated run carries on where it left off.
      const need = new Set<string>();
      for (let i = 0; i < plan.length; i += 500) {
        const r = await fetch("/admin/photos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slugs: plan.slice(i, i + 500).map((x) => x.slug) }) });
        if (!r.ok) throw new Error("Could not check which products still need photos (are you still signed in?).");
        for (const sl of ((await r.json()) as { missing: string[] }).missing) need.add(sl);
      }
      const queue = plan.filter((x) => need.has(x.slug));
      p.skipped = plan.length - queue.length; p.done = p.skipped; push();
      const worker = async () => {
        for (;;) {
          const item = queue.shift();
          if (!item || stop.current) return;
          const picked = item.files.flatMap(expand).filter((f, i, all) => all.indexOf(f) === i).slice(0, 5);
          if (!picked.length) { p.failed++; p.done++; if (p.errors.length < 20) p.errors.push(`${item.slug}: no matching photo in the chosen folder`); push(); continue; }
          const fd = new FormData();
          fd.set("slug", item.slug);
          for (const f of picked) fd.append("files", await shrink(f));
          try {
            const r = await fetch("/admin/photos", { method: "POST", body: fd });
            const j = (await r.json().catch(() => ({}))) as { saved?: number; failed?: string[]; error?: string };
            if (!r.ok || !j.saved) { p.failed++; if (p.errors.length < 20) p.errors.push(`${item.slug}: ${j.error ?? j.failed?.[0] ?? "upload failed"}`); }
            else p.saved++;
          } catch { p.failed++; if (p.errors.length < 20) p.errors.push(`${item.slug}: network error`); }
          p.done++; push();
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      await fetch("/admin/photos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: true }) });
    } catch (e) {
      p.errors.push(e instanceof Error ? e.message : "Photo upload stopped");
    }
    p.running = false; p.finished = !stop.current;
    push();
  }

  // One click: when the import has just been saved and a photos folder was chosen, start uploading the photos straight away.
  useEffect(() => {
    if (res?.ok && !res.preview && res.photos?.length && folder.length && startedFor.current !== res) {
      startedFor.current = res;
      void uploadPhotos(res.photos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);
  // Submitted by hand (not via the form's action prop) because React 19 would clear the chosen file after "Check file",
  // leaving nothing to import when the owner then presses "Import".
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const mode = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    fd.set("mode", mode?.value === "commit" ? "commit" : "preview");
    startTransition(() => action(fd));
  }
  return (
    <form onSubmit={submit} className="mt-8 grid max-w-3xl gap-4">
      <label>
        <span className="eyebrow mb-2 block text-stone">CSV or Excel file (.csv, .xlsx)</span>
        <input type="file" name="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="field" />
      </label>

      <label>
        <span className="eyebrow mb-2 block text-stone">Photos folder (optional: the folder that holds your product images)</span>
        <input type="file" {...({ webkitdirectory: "" } as object)} multiple onChange={(e) => setFolder(Array.from(e.target.files ?? []).filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name)))} className="field" />
        {folder.length > 0 && <span className="mt-1 block text-xs text-stone">{folder.length} image file(s) found in the folder.</span>}
      </label>

      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="create_subs" defaultChecked /> Create new subcategories automatically (e.g. “retro”) instead of stopping with an error</label>

      <details className="border border-line p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Options for ScraperX Excel exports</summary>
        <p className="mt-2 text-stone">Only used when the workbook has “Product Name” and “SKU” columns. Ignored for the SPORTIQ template and CSV files.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label><span className="eyebrow mb-1 block text-stone">Category</span>
            <select name="sport" defaultValue="football" className="field">{sports.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select></label>
          <label><span className="eyebrow mb-1 block text-stone">Markup % on cost (used when Sell Price is 0)</span>
            <input name="markup_pct" type="number" min={0} max={500} step="0.1" defaultValue={0} className="field" /></label>
          <label><span className="eyebrow mb-1 block text-stone">Publish as</span>
            <select name="status" defaultValue="draft" className="field"><option value="draft">Draft (hidden until you check it)</option><option value="published">Published (live immediately)</option></select></label>
          <label><span className="eyebrow mb-1 block text-stone">Pre-order</span>
            <select name="preorder" defaultValue="yes" className="field"><option value="yes">Allow pre-order</option><option value="no">Ready stock only</option></select></label>
          <label className="sm:col-span-2"><span className="eyebrow mb-1 block text-stone">Pre-order estimate</span>
            <input name="preorder_eta" defaultValue="Arrives in 2 to 3 weeks" maxLength={120} className="field" /></label>
        </div>
      </details>

      <div className="flex flex-wrap gap-3">
        <button name="mode" value="preview" className="btn btn-ghost" disabled={pending}>{pending ? "Working…" : "1. Check file (nothing is saved)"}</button>
        {res?.ok && res.preview && (
          <button name="mode" value="commit" className="btn btn-primary" disabled={pending}>2. Import {res.planTotal ?? res.created + res.updated} product(s){folder.length ? " and upload photos" : ""}</button>
        )}
      </div>

      {res?.ok && res.preview && (
        <div role="status" className="border-l-2 border-accent bg-mist p-4 text-sm">
          <p className="font-semibold">Check passed. Nothing is saved yet: {res.created} would be created, {res.updated} updated.</p>
          <p className="mt-1 text-stone">If you change the file or the options, press “Check file” again. Press “Import” to save.</p>
          {res.notes?.map((n, i) => <p key={i} className="mt-1">{n}</p>)}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead><tr><th className="py-1 pr-3">Action</th><th className="pr-3">Product</th><th className="pr-3">LKR</th><th className="pr-3">Status</th><th>Changes</th></tr></thead>
              <tbody>
                {res.plan?.slice(0, 200).map((p) => (
                  <tr key={p.slug} className="border-t border-line align-top">
                    <td className="py-1 pr-3">{p.action}</td><td className="pr-3">{p.name}<br /><code>{p.slug}</code></td><td className="pr-3">{p.price}</td><td className="pr-3">{p.status}</td>
                    <td>{p.action === "update" ? (p.changes.length ? p.changes.join("; ") : "no changes") : "new"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {res.photos && <PhotoMatch plan={res.photos} folder={folder} />}
        </div>
      )}
      {res?.ok && !res.preview && (
        <div role="status" className="border-l-2 border-accent bg-mist p-4 text-sm">
          <p className="font-semibold">Imported. {res.created} created, {res.updated} updated.</p>
        </div>
      )}
      {prog && (
        <div role="status" className="border-l-2 border-accent bg-mist p-4 text-sm">
          <p className="font-semibold">{prog.running ? "Uploading photos… keep this page open." : prog.finished ? "Photos finished." : "Photo upload stopped."}</p>
          <p className="mt-1">{prog.done} of {prog.total} products done: {prog.saved} uploaded, {prog.skipped} already had photos, {prog.failed} failed.</p>
          <progress className="mt-2 w-full" value={prog.done} max={prog.total || 1} />
          {prog.running && <p className="mt-2"><button type="button" className="btn btn-ghost" onClick={() => { stop.current = true; }}>Stop (you can continue later)</button></p>}
          {!prog.running && !prog.finished && <p className="mt-2 text-stone">To continue, choose the same Excel and folder again, check, and import. Products that already have photos are skipped.</p>}
          {prog.errors.length > 0 && <ul className="mt-2 list-disc pl-5 text-red-800">{prog.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        </div>
      )}
      {res && !res.ok && (
        <div role="alert" className="border-l-2 border-red-600 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Nothing was imported. Fix these and upload again:</p>
          <ul className="mt-2 list-disc pl-5">
            {res.errors.slice(0, 50).map((e, i) => <li key={i}>{e.row ? `Row ${e.row}: ` : ""}{e.message}</li>)}
          </ul>
          {res.errors.length > 50 && <p className="mt-2">…and {res.errors.length - 50} more.</p>}
        </div>
      )}
    </form>
  );
}

function PhotoMatch({ plan, folder }: { plan: Photos; folder: File[] }) {
  if (!folder.length) return <p className="mt-3 text-stone">No photos folder chosen: products will be imported without photos. Choose the folder above (before pressing Check file) to upload photos in the same step.</p>;
  const find = indexFolder(folder);
  let withPhoto = 0;
  for (const p of plan) if (p.files.some((f) => find(f))) withPhoto++;
  return <p className="mt-3">Photos: {withPhoto} of {plan.length} products have at least one matching image in your folder. They upload automatically after you press Import.</p>;
}
