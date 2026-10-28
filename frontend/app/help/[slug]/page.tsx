import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";

const pages: Record<string, { title: string; body: string[] }> = {
  "pre-orders": {
    title: "How pre-orders work",
    body: [
      "When a size is out of ready stock, you can pre-order it. Pre-order is open for every size from S to 3XL on products that allow it. Pre-orders take 2 to 3 weeks to arrive.",
      "Full payment is recommended and gets your order moving straight away. If you prefer, in Sri Lanka you can pay half now, and the balance is paid in cash on delivery (or at the store if you pick up).",
      "Every pre-order can be tracked: Confirmed, Supplier Paid, Production, Shipping, Arrived in Sri Lanka, then delivery or pickup. Follow it any time with your order reference and email.",
      "An order is only confirmed once your payment has been verified. The arrival time is an estimate, not a guarantee.",
    ],
  },
  payments: {
    title: "Payment methods",
    body: [
      "Online: pay by card through PayHere. Your order is confirmed when PayHere notifies our server, not when you return to this site.",
      "Bank transfer: transfer the amount using your order reference, then submit your bank transaction reference on your order page. Our team verifies it against the bank record before your order moves forward.",
      "Orders that are not paid within 48 hours are cancelled and any reserved ready stock is released.",
    ],
  },

};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: pages[slug]?.title ?? "Help" };
}

async function HelpInner({ params }: Props) {
  const { slug } = await params;
  if (slug === "shipping") redirect("/shipping");
  if (slug === "returns") redirect("/returns");
  const page = pages[slug];
  if (!page) notFound();
  return (
    <PageShell eyebrow="Help" title={page.title}>
      <div className="max-w-2xl space-y-4 text-neutral-700">
        {page.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    </PageShell>
  );
}

export default async function Help(props: Props) {
  const slug = (await props.params).slug;
  if (slug !== "shipping" && slug !== "returns" && !pages[slug]) notFound();
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-12 lg:px-8" aria-busy="true"><div className="h-16 w-2/3 animate-pulse rounded-[8px] bg-mist" /></div>}>
      <HelpInner {...props} />
    </Suspense>
  );
}
