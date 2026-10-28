import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { LookupForm } from "@/components/TrackForms";

export const metadata: Metadata = { title: "Track an order" };

export default function Page() {
  return (
    <PageShell eyebrow="Pre-order tracking" title="Track an order" narrow>
      <p className="mb-8 text-stone">Enter the reference from your confirmation and the email you used at checkout.</p>
      <LookupForm />
    </PageShell>
  );
}
