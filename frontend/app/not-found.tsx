import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export default function NotFound() {
  return (
    <PageShell eyebrow="404" title="Off the pitch">
      <p className="mb-6 text-stone">We could not find that page.</p>
      <Link href="/" className="btn btn-ghost">Back to home</Link>
    </PageShell>
  );
}
