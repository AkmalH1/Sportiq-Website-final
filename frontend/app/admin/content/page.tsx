import { Flash } from "@/components/AdminBits";
import { AField, Hint } from "@/components/AdminUI";
import { requireAdmin } from "@/lib/admin-auth";
import { listCollections, listFaqsAdmin, type Collection, type FaqRow } from "@/lib/content";
import { addCollectionAction, deleteCollectionAction, deleteFaqAction, saveCollectionAction, saveFaqAction } from "../ops-actions";

export const dynamic = "force-dynamic";

export default async function Content({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [faqs, collections] = await Promise.all([listFaqsAdmin(), listCollections(true)]);
  return (
    <div>
      <h1 className="display text-5xl">FAQs and collections</h1>
      <Hint>These appear on the home page. Collections are the &ldquo;Shop by style&rdquo; cards. Each links to /collections/its-slug, which lists products whose Type contains the match word (leave it empty to show everything).</Hint>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>

      <h2 className="eyebrow mt-8">Collections</h2>
      <div className="mt-4 space-y-3">
        {collections.map((c) => (
          <details key={c.slug} className="border border-line">
            <summary className="cursor-pointer p-4"><strong>{c.name}</strong> <span className="text-xs text-stone">/collections/{c.slug}{c.active ? "" : " · hidden"}</span></summary>
            <div className="border-t border-line p-4">
              <CollectionForm c={c} />
              <form action={deleteCollectionAction} className="mt-3"><input type="hidden" name="slug" value={c.slug} /><button className="text-xs underline text-stone">Delete collection</button></form>
            </div>
          </details>
        ))}
      </div>
      <form action={addCollectionAction} className="mt-4 flex flex-wrap items-end gap-3 border border-line p-4">
        <AField label="New collection name" className="min-w-60 flex-1"><input name="name" required className="field" /></AField>
        <button className="btn btn-primary">Add collection</button>
      </form>

      <h2 className="eyebrow mt-12">FAQs</h2>
      <div className="mt-4 space-y-3">
        {faqs.map((f) => (
          <details key={f.id} className="border border-line">
            <summary className="cursor-pointer p-4"><strong>{f.question}</strong>{f.active ? "" : <span className="text-xs text-stone"> · hidden</span>}</summary>
            <div className="border-t border-line p-4">
              <FaqForm f={f} />
              <form action={deleteFaqAction} className="mt-3"><input type="hidden" name="id" value={f.id} /><button className="text-xs underline text-stone">Delete FAQ</button></form>
            </div>
          </details>
        ))}
      </div>
      <h2 className="eyebrow mt-8">Add a FAQ</h2>
      <div className="mt-4 border border-line p-4"><FaqForm /></div>
    </div>
  );
}

function CollectionForm({ c }: { c: Collection }) {
  return (
    <form action={saveCollectionAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="slug" value={c.slug} />
      <AField label="Name"><input name="name" required defaultValue={c.name} className="field" /></AField>
      <AField label="Short line"><input name="blurb" defaultValue={c.blurb} className="field" /></AField>
      <AField label="Colour from"><input name="from" type="color" defaultValue={c.from} className="field h-12 p-1" /></AField>
      <AField label="Colour to"><input name="to" type="color" defaultValue={c.to} className="field h-12 p-1" /></AField>
      <AField label="Match products whose Type contains"><input name="match" defaultValue={c.match} className="field" placeholder="e.g. retro (empty = all)" /></AField>
      <AField label="Order"><input name="sort" type="number" defaultValue={c.sort} className="field" /></AField>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={c.active} /> Show on the site</label>
      <button className="btn btn-primary w-fit">Save</button>
    </form>
  );
}

function FaqForm({ f }: { f?: FaqRow }) {
  return (
    <form action={saveFaqAction} className="grid gap-4">
      <input type="hidden" name="id" value={f?.id ?? 0} />
      <AField label="Question"><input name="question" required defaultValue={f?.question} className="field" /></AField>
      <AField label="Answer"><textarea name="answer" required rows={3} defaultValue={f?.answer} className="field" /></AField>
      <div className="flex flex-wrap items-center gap-6">
        <AField label="Order"><input name="sort" type="number" defaultValue={f?.sort ?? 99} className="field w-28" /></AField>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={f ? !!f.active : true} /> Show on the site</label>
      </div>
      <button className="btn btn-primary w-fit">Save</button>
    </form>
  );
}
