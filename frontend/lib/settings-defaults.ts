/** Defaults for the Admin > Settings screen. Anything left blank here is shown as "not set yet" on the site. */
export const SETTING_DEFAULTS: Record<string, string> = {
  business_name: "SPORTIQ",
  // Pre-order half payment: percentage of the pre-order items paid up front, and how the rest may be collected.
  deposit_percent: "50",
  // Comma list of: cash_pickup, cash_delivery, bank, online. Only methods listed here are offered to customers.
  balance_methods: "cash_pickup,cash_delivery,bank,online",
  balance_note: "The balance is due before your order is handed over or delivered.",
  // Gift cards: "card value:percent off the price", comma separated. A 10000 card at 8 costs 9200. Customers may also type an amount between 2000 and 100000 and get the best tier below it.
  giftcard_tiers: "5000:5,10000:8,25000:10",
  giftcard_valid_months: "12",
  whatsapp: "94775379088", // international format, digits only
  phone_display: "0775379088",
  email: "",
  instagram: "",
  linkedin_url: "", // your LinkedIn page, shown in the footer
  developer_name: "Mohamed Akmal",
  developer_linkedin: "", // developer LinkedIn profile (optional)
  address: "",
  map_query: "",
  opening_hours: "",
  store_photos: "[]",
  about_title: "Back, because of you.",
  about_body: [
    "SPORTIQ started a few years ago with one idea: make the shirts fans really want easy to get in Sri Lanka, and be honest about stock and delivery.",
    "Along the way many of our accounts were banned. It would have been easy to stop. We came back because of our customers: the messages, the repeat orders and the people who kept asking where we went.",
    "Today we run from our own store, with ready stock on the shelf and pre-orders that arrive in 2 to 3 weeks. Every pre-order can be tracked, and every order is handled by the same small team you talk to on WhatsApp.",
  ].join("\n\n"),
  // Default size chart for apparel. Lines are comma separated. A line starting with # is a note under the table.
  size_chart_default: [
    "Size,Chest (cm),Length (cm),Fits",
    "S,96,68,Slim fit",
    "M,102,70,Regular",
    "L,108,72,Regular",
    "XL,114,75,Relaxed",
    "2XL,120,77,Relaxed",
    "3XL,126,79,Relaxed",
    "# Measurements are a guide for a fan-fit shirt. Measure a shirt you like and compare. Not sure? Message us on WhatsApp.",
  ].join("\n"),
  // One brother per line: Name | Role. Leave empty to hide the cards and keep only the sentence.
  trio: "",
  trio_text: "SPORTIQ is run by three brothers. We pick, import, pack and answer the messages ourselves.",
  disclaimer: [
    "All products sold by SPORTIQ are imported, A-grade items, offered as Fan Version or Player Version for football jerseys. They are not official or licensed merchandise.",
    "SPORTIQ is an independent retailer. We are not affiliated with, sponsored by or endorsed by any club, league, team, player, manufacturer or brand.",
    "Team, league and brand names, logos and trademarks belong to their respective owners. They are used only to describe the style of a product, and no ownership or endorsement is claimed.",
    "If you are a rights holder and have a concern about anything on this site, message us on WhatsApp and we will respond.",
  ].join("\n\n"),
  ems_enabled: "yes", // "yes" = international parcels use EMS rates, "no" = EMS is switched off and the zone table is used
  ems_checked: "",
  ems_markup_pct: "0",
  local_delivery_fee: "500",
  preorder_weeks: "2 to 3 weeks",
  price_player_version: "400", // extra charge for a Player Version football jersey (Fan Version is the listed price)
  price_sleeve_long: "500",
  price_custom: "700",
  price_patch_1: "300",
  price_patch_2: "200",
  price_patch_3: "100",
  ticker: ["Wear Your Game", "Pre-orders arrive in 2 to 3 weeks", "Track every pre-order", "We deliver worldwide", "Exchange and store credit"].join("\n"),
};
