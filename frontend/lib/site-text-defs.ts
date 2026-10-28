/** Every piece of storefront wording the owner can edit in Admin > Site text. Pure data, no server imports. */
export type TextDef = { key: string; group: string; label: string; def: string; kind?: "text" | "long" | "lines" | "toggle"; help?: string };

const T = (group: string, key: string, label: string, def: string, kind: TextDef["kind"] = "text", help?: string): TextDef => ({ key, group, label, def, kind, help });

export const TEXT_DEFS: TextDef[] = [
  T("Homepage top banner", "hero.watermark", "Large faint word behind the headline", "SPORTIQ"),
  T("Homepage top banner", "hero.cta2_label", "Second button text", "How pre-orders work"),
  T("Homepage top banner", "hero.cta2_href", "Second button link", "/help/pre-orders"),
  T("Homepage top banner", "hero.ticker", "Scrolling strip under the banner (one phrase per line)", "Ready stock\nPre-order\nTrack every step\nGift cards\nVoucher codes", "lines", "Leave a line out to remove it. Only list things the store really offers."),
  T("Homepage top banner", "hero.photo_note", "Small caption under the banner photo (leave the original to hide)", "", "text", "The banner photo, headline, text and first button are edited in Admin > Banners."),

  T("Homepage: sports", "home.sports.eyebrow", "Small label", "Shop by sport"),
  T("Homepage: sports", "home.sports.title", "Heading", "Choose your arena"),
  T("Homepage: sports", "home.sports.viewall", "View-all tile text", "View all"),

  T("Homepage: gift cards and vouchers", "show.gift", "Show this band", "1", "toggle"),
  T("Homepage: gift cards and vouchers", "home.gift.eyebrow", "Small label", "Gift cards and vouchers"),
  T("Homepage: gift cards and vouchers", "home.gift.title", "Heading (a new line breaks the heading)", "Give the right shirt.", "long"),
  T("Homepage: gift cards and vouchers", "home.gift.body", "Text", "Not sure of the size or the team? Send a SPORTIQ gift card and let them choose. The bigger the card, the less you pay for it.", "long"),
  T("Homepage: gift cards and vouchers", "home.gift.button", "Button text", "Buy a gift card"),
  T("Homepage: gift cards and vouchers", "home.gift.voucher", "Voucher line", "Have a voucher code? Enter it at checkout to save on your order."),

  T("Homepage: manifesto band", "show.manifesto", "Show this band", "1", "toggle"),
  T("Homepage: manifesto band", "home.manifesto.eyebrow", "Small label", "The SPORTIQ manifesto"),
  T("Homepage: manifesto band", "home.manifesto.title", "Heading", "Sport is identity. Wear the side you are on.", "long"),
  T("Homepage: manifesto band", "home.manifesto.body", "Text", "We bring the shirts, the heritage and the new drops to Sri Lanka, and we tell you honestly what is in stock and what is on its way.", "long"),

  T("Homepage: shop by style", "show.styles", "Show this section", "1", "toggle", "The style cards themselves are edited in Admin > FAQs and collections."),
  T("Homepage: shop by style", "home.styles.eyebrow", "Small label", "Shop by style"),
  T("Homepage: shop by style", "home.styles.title", "Heading", "Find your look"),

  T("Homepage: caps", "show.caps", "Show this band (it also hides itself when there are no caps)", "1", "toggle"),
  T("Homepage: caps", "home.caps.eyebrow", "Small label", "Headwear"),
  T("Homepage: caps", "home.caps.title", "Heading", "Top it off."),
  T("Homepage: caps", "home.caps.button", "Button text", "Shop all caps"),

  T("Homepage: latest drops", "home.drops.eyebrow", "Small label", "New in"),
  T("Homepage: latest drops", "home.drops.title", "Heading", "Latest drops"),
  T("Homepage: latest drops", "home.drops.viewall", "View-all link text", "View all"),

  T("Homepage: pre-orders", "show.pre", "Show this band", "1", "toggle"),
  T("Homepage: pre-orders", "home.pre.eyebrow", "Small label", "Pre-orders"),
  T("Homepage: pre-orders", "home.pre.title", "Heading", "Arrives in 2 to 3 weeks. Track every step.", "long"),
  T("Homepage: pre-orders", "home.pre.body", "Text", "Every size from S to 3XL can be pre-ordered. Full payment is best. In Sri Lanka you can also pay half now and the rest in cash on delivery.", "long"),
  T("Homepage: pre-orders", "home.pre.button", "Button text", "How it works"),
  T("Homepage: pre-orders", "home.pre.stages", "Steps (one per line)", "Confirmed\nSupplier Paid\nProduction\nShipping\nArrived in Sri Lanka\nDelivery or pickup", "lines", "These are the steps shown on the home page only. The real order tracking steps are not changed."),

  T("Homepage: reviews", "show.reviews", "Show this section", "1", "toggle"),
  T("Homepage: reviews", "home.reviews.eyebrow", "Small label", "Customer reviews"),
  T("Homepage: reviews", "home.reviews.title", "Heading", "What fans say"),
  T("Homepage: reviews", "home.reviews.link", "Link text", "Write a review"),

  T("Homepage: FAQ", "show.faq", "Show this section", "1", "toggle", "The questions themselves are edited in Admin > FAQs and collections."),
  T("Homepage: FAQ", "home.faq.eyebrow", "Small label", "FAQ"),
  T("Homepage: FAQ", "home.faq.title", "Heading", "Good questions"),

  T("Footer", "footer.tagline", "Tagline", "Wear your game. Sportswear sourced for Sri Lanka, in ready stock and pre-order.", "long"),
  T("Footer", "footer.legal", "Legal notice", "All products are imported A-grade items, not official merchandise. SPORTIQ is not affiliated with or endorsed by any team, league or brand.", "long", "Keep a notice like this so customers are not misled about the products."),
  T("Footer", "footer.copyright", "Copyright line", "© SPORTIQ. All rights reserved."),

  T("Gift cards page", "gift.eyebrow", "Small label", "Digital gift cards"),
  T("Gift cards page", "gift.title", "Heading (a new line breaks the heading)", "Give the\nright shirt.", "long"),
  T("Gift cards page", "gift.intro", "Intro text", "Not sure of the size or the team? Let them choose. A SPORTIQ gift card works on everything in the store, and you pay less than it is worth.", "long"),
  T("Gift cards page", "gift.steps", "How it works (one step per line, as  Title | text)", "Choose an amount | Pick a value, or type your own. The bigger the card, the more you save: you pay less than the card is worth.\nPay securely | Pay online by card, or by bank transfer. Nothing is issued until the payment is confirmed.\nGet your code | Your gift card code appears on your order page the moment payment is confirmed. Copy it or send it straight to your friend on WhatsApp.\nSpend it | At checkout, enter the code under “Gift card or store credit”. It works on every product, ready stock or pre-order, and any unused balance stays on the card.", "lines"),
  T("Gift cards page", "gift.terms", "Good to know (one point per line; {months} becomes the validity from Settings)", "A card is valid for {months} months from the day it is issued. The expiry date is shown with the code.\nIt can be used on all products, including pre-orders, and on postage. You can use it for part of an order and pay the rest by card or bank transfer.\nIt can be used in more than one order until the balance is gone. It cannot be exchanged for cash.\nIt can be combined with a voucher code on the same order. Gift cards cannot be used to buy another gift card.\nAnyone with the code can spend it, so treat it like cash and share it only with the person it is for. Lost codes can be found from your order page with your order reference and email.\nThe money-off offer applies when you buy the card, not when you spend it. Gift card purchases are not refundable once the code has been issued.", "lines"),
];

export const TEXT_BY_KEY: Record<string, TextDef> = Object.fromEntries(TEXT_DEFS.map((d) => [d.key, d]));
export const TEXT_DEFAULTS: Record<string, string> = Object.fromEntries(TEXT_DEFS.map((d) => [d.key, d.def]));

/** Cleans one submitted value. An empty text means "use the original wording"; toggles are only ever "1" or "0". */
export function cleanText(d: TextDef, raw: string): string {
  if (d.kind === "toggle") return raw === "0" ? "0" : "1";
  const v = raw.replace(/\r\n?/g, "\n").trim();
  const cap = d.kind === "lines" ? 4000 : d.kind === "long" ? 600 : 200;
  return (d.kind === "lines" || d.kind === "long" ? v : v.replace(/\n+/g, " ")).slice(0, cap);
}

export const textLines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
