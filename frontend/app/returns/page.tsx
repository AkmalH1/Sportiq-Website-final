import type { Metadata } from "next";
import { ExchangeForm } from "@/components/ExchangeForm";
import { PageShell } from "@/components/PageShell";
import { getSettings, whatsappLink } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Returns and exchanges" };

export default async function Returns({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <PageShell eyebrow="Help" title="Returns and exchanges">
      <div className="max-w-2xl space-y-4 text-stone">
        <p><strong className="text-ink">Exchanges only.</strong> We do not give cash refunds. If something is not right, we can exchange it, and where an exchange is not possible we can give you store credit to use on a future order.</p>
        <p><strong className="text-ink">Every request is checked by our team.</strong> Tell us on WhatsApp or send the form below, and an admin will verify the order and the item before anything is approved.</p>
        <p>Customised shirts (names, numbers or patches) are made for you and cannot be exchanged. Items must be unworn, with tags, and in their original condition.</p>
      </div>
      <p className="mt-8"><a className="btn btn-primary" href={whatsappLink("Hi SPORTIQ, I would like to exchange an item. My order reference is: ", s)} target="_blank" rel="noreferrer">Message us on WhatsApp ({s.phone_display})</a></p>

      <h2 className="eyebrow mt-16">Or send an exchange request</h2>
      <div className="mt-6">
        {sp.sent ? <p role="status" className="max-w-xl border-l-2 border-accent bg-mist p-5 text-sm">Request sent. We will check it and contact you on the details you gave.</p> : <ExchangeForm />}
      </div>
    </PageShell>
  );
}
