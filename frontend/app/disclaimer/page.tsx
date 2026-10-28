import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { getSettings, whatsappLink } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Copyright and product notice" };

export default async function Disclaimer() {
  const s = await getSettings();
  return (
    <PageShell eyebrow="Legal" title="Copyright and product notice">
      <div className="max-w-2xl space-y-5 text-stone">
        {s.disclaimer.split(/\n{2,}/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
        <p><a className="underline" href={whatsappLink("Hi SPORTIQ, I have a copyright question.", s)} target="_blank" rel="noreferrer">Contact us on WhatsApp ({s.phone_display})</a></p>
      </div>
    </PageShell>
  );
}
