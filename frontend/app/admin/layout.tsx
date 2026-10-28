import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { logoutAction } from "./actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdmin();
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-10">
      {authed && (
        <nav aria-label="Admin" className="mb-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line pb-4">
          <span className="eyebrow text-accent-dark">Admin</span>
          <Link href="/admin" className="eyebrow hover:text-accent-dark">Orders</Link>
          <Link href="/admin/batches" className="eyebrow hover:text-accent-dark">Pre-order batches</Link>
          <Link href="/admin/suppliers" className="eyebrow hover:text-accent-dark">Suppliers</Link>
          <Link href="/admin/expenses" className="eyebrow hover:text-accent-dark">Expenses</Link>
          <Link href="/admin/customers" className="eyebrow hover:text-accent-dark">Customers</Link>
          <Link href="/admin/payments" className="eyebrow hover:text-accent-dark">Payments</Link>
          <Link href="/admin/products" className="eyebrow hover:text-accent-dark">Products</Link>
          <Link href="/admin/import" className="eyebrow hover:text-accent-dark">Bulk import</Link>
          <Link href="/admin/categories" className="eyebrow hover:text-accent-dark">Categories</Link>
          <Link href="/admin/content" className="eyebrow hover:text-accent-dark">FAQs and collections</Link>
          <Link href="/admin/banners" className="eyebrow hover:text-accent-dark">Banners</Link>
          <Link href="/admin/site-text" className="eyebrow hover:text-accent-dark">Site text</Link>
          <Link href="/admin/reviews" className="eyebrow hover:text-accent-dark">Reviews</Link>
          <Link href="/admin/exchanges" className="eyebrow hover:text-accent-dark">Exchanges and credit</Link>
          <Link href="/admin/vouchers" className="eyebrow hover:text-accent-dark">Vouchers and gift cards</Link>
          <Link href="/admin/shipping" className="eyebrow hover:text-accent-dark">Shipping</Link>
          <Link href="/admin/ems" className="eyebrow hover:text-accent-dark">EMS rates</Link>
          <Link href="/admin/settings" className="eyebrow hover:text-accent-dark">Settings</Link>
          <Link href="/admin/activity" className="eyebrow hover:text-accent-dark">Activity</Link>
          <form action={logoutAction} className="ml-auto"><button className="eyebrow hover:text-accent-dark">Log out</button></form>
        </nav>
      )}
      {children}
    </div>
  );
}
