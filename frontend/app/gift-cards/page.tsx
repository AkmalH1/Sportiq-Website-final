import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { GiftBalanceForm, GiftCardForm } from "@/components/GiftCardForm";
import { giftConfig } from "@/lib/gift";
import { payhereConfig } from "@/lib/payhere";
import { giftPrice } from "@/lib/promo-logic";
import { formatLkr } from "@/lib/format";
import { getTexts } from "@/lib/site-text";
import { textLines } from "@/lib/site-text-defs";

import "@/app/home.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Gift cards",
  description: "Give the gift of the right shirt. SPORTIQ digital gift cards, delivered as soon as payment is confirmed, with money off when you buy.",
};

export default async function GiftCardsPage() {
  const cfg = await giftConfig();
  const t = await getTexts();
  const steps = textLines(t["gift.steps"]).map((l) => { const [h, ...r] = l.split("|"); return [h.trim(), r.join("|").trim()] as [string, string]; });
  const terms = textLines(t["gift.terms"]).map((x) => x.replaceAll("{months}", String(cfg.validMonths)));
    const example = cfg.tiers.length ? giftPrice(cfg.tiers[Math.min(1, cfg.tiers.length - 1)].face, cfg.tiers) : null;
  return (
    <>
      <header className="relative isolate overflow-hidden bg-ink text-paper">
        <div className="mx-auto grid max-w-[1400px] items-center gap-8 px-4 py-12 sm:py-16 lg:grid-cols-[1.2fr_1fr] lg:px-10">
          <div>
            <p className="eyebrow text-accent">{t["gift.eyebrow"]}</p>
            <h1 className="display mt-3 text-5xl sm:text-7xl md:text-8xl">{t["gift.title"].split("\n").map((l, i) => <span key={i} className="block">{l}</span>)}</h1>
            <p className="mt-5 max-w-md text-white/75">{t["gift.intro"]}</p>
            {example && example.percent > 0 && (
              <p className="mt-6 inline-block bg-accent px-3 py-2 text-sm font-semibold text-ink">Example: a {formatLkr(example.face)} card costs just {formatLkr(example.price)}</p>
            )}
          </div>
          <div aria-hidden="true" className="mx-auto w-full max-w-sm">
            <div className="gift-card-art">
              <p className="display text-3xl">SPORT<span className="text-accent">IQ</span></p>
              <p className="eyebrow absolute bottom-6 left-6 text-white/60">Gift card</p>
              <p className="display absolute bottom-5 right-6 text-4xl text-accent">{example ? formatLkr(example.face) : "LKR"}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-14 lg:px-10">
        <section aria-labelledby="how-h">
          <h2 id="how-h" className="display text-4xl md:text-5xl">How it works</h2>
          <ol className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([title, body], i) => (
              <li key={title} className="bg-paper p-6">
                <span className="display text-5xl text-accent">{i + 1}</span>
                <h3 className="mt-3 text-sm font-semibold uppercase tracking-wide">{title}</h3>
                <p className="mt-2 text-sm text-stone">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="buy" className="mt-20 scroll-mt-24" aria-labelledby="buy-h">
          <h2 id="buy-h" className="display text-4xl md:text-5xl">Buy a gift card</h2>
          <div className="mt-8">
            <GiftCardForm tiers={cfg.tiers} payhereReady={payhereConfig().configured} idem={randomUUID()} />
          </div>
        </section>

        <section className="mt-20" aria-labelledby="bal-h">
          <h2 id="bal-h" className="display text-4xl md:text-5xl">Check a balance</h2>
          <p className="mt-3 max-w-xl text-sm text-stone">Got a card? Enter the code to see what is left. To spend it, enter it at checkout.</p>
          <div className="mt-6"><GiftBalanceForm /></div>
        </section>

        <section className="mt-20 max-w-3xl" aria-labelledby="terms-h">
          <h2 id="terms-h" className="display text-4xl md:text-5xl">Good to know</h2>
          <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-stone">
            {terms.map((x) => <li key={x}>{x}</li>)}
            <li>Questions? Message us on WhatsApp, or see <Link href="/returns" className="underline">returns</Link>.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
