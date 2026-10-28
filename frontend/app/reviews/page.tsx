import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewList } from "@/components/ReviewList";
import { listApproved } from "@/lib/reviews";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer reviews" };

export default async function Reviews({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const sp = await searchParams;
  return (
    <PageShell eyebrow="Customer reviews" title="What fans say">
      <ReviewList reviews={await listApproved({ limit: 60 })} />
      <h2 className="eyebrow mt-20">Write a review</h2>
      <div className="mt-6"><ReviewForm product={sp.product ?? ""} /></div>
    </PageShell>
  );
}
