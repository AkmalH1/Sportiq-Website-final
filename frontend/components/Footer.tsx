import Link from "next/link";
import type { Sport } from "@/lib/types";
import { Wordmark } from "./Wordmark";
import { getSettings, whatsappLink } from "@/lib/settings";
import { getTexts } from "@/lib/site-text";

export async function Footer({ sports }: { sports: Sport[] }) {
  const s = await getSettings();
  const t = await getTexts();
  return (
    <footer className="border-t border-line bg-mist">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-4 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-10">
        <div>
          <p className="text-5xl"><Wordmark /></p>
          <p className="mt-4 max-w-xs text-sm text-stone">{t["footer.tagline"]}</p>
          <p className="mt-6 max-w-xs text-xs text-stone">{t["footer.legal"]} <Link href="/disclaimer" className="underline">Copyright notice</Link></p>
        </div>
        <FooterCol title="Shop" links={sports.map((s) => [s.name, `/sports/${s.slug}`])} />
        <FooterCol title="Help" links={[
          ["How pre-orders work", "/help/pre-orders"],
          ["Payment methods", "/help/payments"],
          ["Shipping and postage", "/shipping"],
          ["Returns and exchanges", "/returns"],
          ["Copyright notice", "/disclaimer"],
          ["Track an order", "/track-order"],
        ]} />
        <div>
          <FooterCol title="Store" links={[["About us", "/about"], ["Gift cards", "/gift-cards"], ["Reviews", "/reviews"], ["Cart", "/cart"], ["Search", "/search"]]} />
          <p className="mt-6 text-sm"><a className="underline hover:text-accent-dark" href={whatsappLink("", s)} target="_blank" rel="noreferrer">WhatsApp {s.phone_display}</a></p>
          {s.address && <p className="mt-2 max-w-[14rem] text-xs text-stone">{s.address}</p>}
          {s.linkedin_url && <p className="mt-2 text-sm"><a className="underline hover:text-accent-dark" href={s.linkedin_url} target="_blank" rel="noopener noreferrer">LinkedIn</a></p>}
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-stone">
        {t["footer.copyright"]}
        {s.developer_name && (
          <span className="block sm:ml-3 sm:inline">
            Website developed and secured by{" "}
            {s.developer_linkedin || s.linkedin_url
              ? <a className="underline hover:text-accent-dark" href={s.developer_linkedin || s.linkedin_url} target="_blank" rel="noopener noreferrer">{s.developer_name}</a>
              : <strong>{s.developer_name}</strong>}
          </span>
        )}
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[][] }) {
  return (
    <div>
      <h2 className="eyebrow text-accent-dark">{title}</h2>
      <ul className="mt-5 space-y-2.5 text-sm">
        {links.map(([label, href]) => (
          <li key={href}><Link href={href} className="hover:text-accent-dark">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
