/**
 * STARTER CONTENT. Copied into the database once, the first time the site starts on an empty database.
 * After that everything here lives in the database and is edited in the admin area, so changing this file does not change a live site.
 */

export const CAP_STYLES: [string, string][] = [["fitted", "Fitted"], ["snapback", "Snapback"], ["adjustable", "Adjustable"], ["dad-hats", "Dad Hats"], ["beanies", "Beanies"]];
export const CAP_CHART = [
  "Fit,Head size (cm),Notes",
  "Adjustable / snapback,54 to 62,One size fits most",
  "Fitted 7 1/8,56.8,Choose the size on the label",
  "Fitted 7 1/4,57.8,Choose the size on the label",
  "Fitted 7 3/8,58.7,Choose the size on the label",
  "# Measure around your head, just above the eyebrows and ears.",
].join("\n");


/** Starter size charts, one per subcategory. They are generic fan-fit guides. Staff can edit each one in Admin > Categories. */
const note = (t: string) => "# " + t;
export const SUB_CHARTS: Record<string, string> = {
  "football/club-jerseys": ["Size,Chest (cm),Length (cm),Shoulder (cm),Fit", "S,96,68,43,Slim", "M,102,70,45,Regular", "L,108,72,47,Regular", "XL,114,75,49,Relaxed", "2XL,120,77,51,Relaxed", "3XL,126,79,53,Relaxed", note("Fan-version club shirts. Measure a shirt you like lying flat and compare.")].join("\n"),
  "football/national-teams": ["Size,Chest (cm),Length (cm),Shoulder (cm),Fit", "S,95,67,42,Slim", "M,101,69,44,Regular", "L,107,71,46,Regular", "XL,113,74,48,Relaxed", "2XL,119,76,50,Relaxed", "3XL,125,78,52,Relaxed", note("National team shirts run slightly closer to the body than club shirts.")].join("\n"),
  "football/retro-archive": ["Size,Chest (cm),Length (cm),Sleeve (cm),Fit", "S,98,69,21,Boxy", "M,104,71,22,Boxy", "L,110,73,23,Boxy", "XL,116,76,24,Boxy", "2XL,122,78,25,Boxy", "3XL,128,80,26,Boxy", note("Retro cuts are looser and boxier than modern shirts. Size down if you like a fitted look.")].join("\n"),
  "football/training-wear": ["Size,Chest (cm),Length (cm),Fit", "S,100,68,Loose", "M,106,70,Loose", "L,112,72,Loose", "XL,118,75,Loose", "2XL,124,77,Loose", "3XL,130,79,Loose", note("Training wear has an athletic loose fit.")].join("\n"),
  "nba/jerseys": ["Size,Chest (cm),Length (cm),Armhole (cm),Fit", "S,100,72,26,Loose", "M,106,74,27,Loose", "L,112,76,28,Loose", "XL,118,79,29,Loose", "2XL,124,81,30,Loose", "3XL,130,83,31,Loose", note("Basketball jerseys are sleeveless and cut long and loose. Take your normal T-shirt size.")].join("\n"),
  "nba/shorts": ["Size,Waist (cm),Hip (cm),Length (cm)", "S,68-74,96,44", "M,74-80,102,45", "L,80-86,108,46", "XL,86-92,114,47", "2XL,92-98,120,48", "3XL,98-104,126,49", note("Elastic waistband with drawcord. Length is from waist to hem.")].join("\n"),
  "nfl/jerseys": ["Size,Chest (cm),Length (cm),Shoulder (cm),Fit", "S,106,72,50,Oversized", "M,112,74,52,Oversized", "L,118,76,54,Oversized", "XL,124,79,56,Oversized", "2XL,130,81,58,Oversized", "3XL,136,83,60,Oversized", note("NFL game jerseys are cut big to fit over shoulder pads. Most people go one size down.")].join("\n"),
  "nfl/shorts": ["Size,Waist (cm),Hip (cm),Length (cm)", "S,68-74,98,46", "M,74-80,104,47", "L,80-86,110,48", "XL,86-92,116,49", "2XL,92-98,122,50", "3XL,98-104,128,51"].join("\n"),
  "nhl/jerseys": ["Size,Chest (cm),Length (cm),Sleeve (cm),Fit", "S,108,76,60,Oversized", "M,114,78,61,Oversized", "L,120,80,62,Oversized", "XL,126,83,63,Oversized", "2XL,132,85,64,Oversized", "3XL,138,87,65,Oversized", note("Hockey jerseys are long and wide to fit over pads. Consider one size down.")].join("\n"),
  "rugby/shirts": ["Size,Chest (cm),Length (cm),Sleeve (cm),Fit", "S,98,69,23,Athletic", "M,104,71,24,Athletic", "L,110,73,25,Athletic", "XL,116,76,26,Athletic", "2XL,122,78,27,Athletic", "3XL,128,80,28,Athletic", note("Rugby shirts have a collar and a close athletic cut with stretch.")].join("\n"),
  "baseball/shirts": ["Size,Chest (cm),Length (cm),Sleeve (cm),Fit", "S,102,72,22,Relaxed", "M,108,74,23,Relaxed", "L,114,76,24,Relaxed", "XL,120,79,25,Relaxed", "2XL,126,81,26,Relaxed", "3XL,132,83,27,Relaxed", note("Button-up baseball shirts have a relaxed fit. Fasten the buttons when you measure.")].join("\n"),
  "formula-1/team-wear": ["Size,Chest (cm),Length (cm),Fit", "S,96,68,Regular", "M,102,70,Regular", "L,108,72,Regular", "XL,114,75,Regular", "2XL,120,77,Regular", "3XL,126,79,Regular"].join("\n"),
  "formula-1/polos": ["Size,Chest (cm),Length (cm),Sleeve (cm),Fit", "S,94,68,20,Slim", "M,100,70,21,Slim", "L,106,72,22,Regular", "XL,112,75,23,Regular", "2XL,118,77,24,Regular", "3XL,124,79,25,Regular", note("Polo shirts are cut closer than T-shirts.")].join("\n"),
  "formula-1/caps": ["Style,Head (cm),Fits", "Adjustable cap,55-61,One size with strap", note("Measure around your head just above the eyebrows and ears.")].join("\n"),
  "caps/fitted": ["Size,Head (cm),Head (in)", "7,55.8,22", "7 1/8,56.8,22 3/8", "7 1/4,57.7,22 3/4", "7 3/8,58.7,23 1/8", "7 1/2,59.6,23 1/2", "7 5/8,60.6,23 7/8", "7 3/4,61.5,24 1/4", note("Fitted caps have no strap. Measure around your head just above the eyebrows and ears. Between sizes? Go up one.")].join("\n"),
  "caps/snapback": ["Cap,Head (cm),Strap", "Snapback,55-62,Plastic snap, 5 positions", note("One size fits most heads. Adjust the snap at the back.")].join("\n"),
  "caps/dad-hats": ["Cap,Head (cm),Strap", "Dad hat,53-62,Metal or fabric buckle, fully adjustable", note("Soft, curved brim and unstructured crown. One size.")].join("\n"),
  "caps/adjustable": ["Cap,Head (cm),Strap", "Adjustable,54-61,Velcro or buckle strap", note("One size. Adjust the strap at the back for your fit.")].join("\n"),
  "caps/beanies": ["Beanie,Head (cm),Stretch", "One size,52-62,Stretches comfortably", note("Cuffed knit beanie. Fold the cuff for a snugger fit.")].join("\n"),
  "caps/trucker": ["Cap,Head (cm),Strap", "Trucker,55-62,Plastic snap, mesh back", note("Mesh back for airflow. One size.")].join("\n"),
};

export const DEFAULT_SPORTS: { slug: string; name: string; tagline: string; accent: string; subs: string[]; sizeSet?: string; sizeChart?: string }[] = [
  { slug: "football", name: "Football", tagline: "Club and national shirts", accent: "#f4720a", subs: ["Club Jerseys", "National Teams", "Retro Archive", "Training Wear"] },
  { slug: "nba", name: "NBA", tagline: "Pro basketball jerseys", accent: "#c8102e", subs: ["Jerseys", "Shorts"] },
  { slug: "nfl", name: "NFL", tagline: "Gridiron jerseys", accent: "#1b3a6b", subs: ["Jerseys", "Shorts"] },
  { slug: "nhl", name: "NHL", tagline: "Ice hockey jerseys", accent: "#0f5fa8", subs: ["Jerseys"] },
  { slug: "formula-1", name: "Formula 1", tagline: "Paddock style", accent: "#b01e1e", subs: ["Team Wear", "Polos", "Caps"] },
  { slug: "rugby", name: "Rugby", tagline: "Rugby shirts", accent: "#2b6e45", subs: ["Shirts"] },
  { slug: "baseball", name: "Baseball", tagline: "Baseball shirts", accent: "#2f4a8a", subs: ["Shirts"] },
  { slug: "caps", name: "Caps", tagline: "Fitted, snapback and everyday headwear", accent: "#111111", subs: CAP_STYLES.map(([, n]) => n), sizeSet: "onesize", sizeChart: CAP_CHART },
];

/** Placeholder postage estimates (LKR). The owner must replace these with real Sri Lanka Post / courier rates in Admin > Shipping. */
export const DEFAULT_ZONES = [
  { name: "South Asia", countries: "IN,PK,BD,NP,BT,MV,AF", first: 2800, extra: 1200, days: "5 to 10 working days" },
  { name: "Middle East and Asia", countries: "AE,SA,QA,KW,OM,BH,JO,LB,IL,TR,IQ,IR,SG,MY,TH,ID,PH,VN,KH,LA,MM,BN,CN,HK,TW,JP,KR,MO,MN", first: 3800, extra: 1700, days: "7 to 14 working days" },
  { name: "Europe and Oceania", countries: "GB,IE,FR,DE,IT,ES,PT,NL,BE,LU,AT,CH,SE,NO,DK,FI,IS,PL,CZ,SK,HU,RO,BG,GR,HR,SI,EE,LV,LT,MT,CY,AU,NZ,FJ", first: 4800, extra: 2200, days: "10 to 18 working days" },
  { name: "Americas and Africa", countries: "US,CA,MX,BR,AR,CL,CO,PE,ZA,KE,NG,EG,GH,MU,TZ,UG,ET,MA,DZ,TN", first: 5800, extra: 2700, days: "12 to 21 working days" },
  { name: "Rest of the world", countries: "*", first: 6500, extra: 3000, days: "14 to 28 working days" },
];


export const DEFAULT_COLLECTIONS = [
  { slug: "matchday", name: "Matchday", blurb: "Jerseys made for the stands.", from: "#111111", to: "#f4720a", match: "" },
  { slug: "retro-archive", name: "Retro Archive", blurb: "Throwback shirts and heritage cuts.", from: "#2e2418", to: "#b8903d", match: "retro" },
  { slug: "latest-drops", name: "Latest Drops", blurb: "New arrivals and pre-order windows.", from: "#14202e", to: "#4d7ea8", match: "" },
  { slug: "street", name: "Street Sport", blurb: "Sport style off the pitch.", from: "#1d1d1d", to: "#8a8a8a", match: "" },
];

export const DEFAULT_FAQS = [
  { q: "What is the difference between ready stock and pre-order?", a: "Ready stock is in Sri Lanka and ships once payment is confirmed. Pre-order is imported for you and arrives in 2 to 3 weeks. Every size shows which one applies, and pre-order is open from S to 3XL." },
  { q: "Can I pay half on a pre-order?", a: "Full payment is the best option. In Sri Lanka you can also pay half now and the balance in cash on delivery, or at the store if you pick up. Orders shipped abroad are paid in full." },
  { q: "Do you deliver outside Sri Lanka?", a: "Yes, we deliver across the world. Postage is worked out from your country and the weight of your parcel, and shown at checkout. In Sri Lanka delivery is LKR 500, and store pickup is free." },
  { q: "Can I customise a football jersey?", a: "Yes. On football jerseys you can choose long sleeves, add a name and number, and add up to three patches. Write what you want or attach an image. Prices are shown on the product page." },
  { q: "How do I track a pre-order?", a: "Use your order reference and email on the tracking page. You will see each step from Confirmed to delivery or pickup." },
  { q: "Can I return or exchange an item?", a: "We do exchanges only, not cash refunds, and where needed we can give store credit. Every request is checked by our admin team on WhatsApp. Customised shirts cannot be exchanged." },
  { q: "Are these official team products?", a: "No. Everything we sell is imported, A-grade fan-version stock, not official or licensed merchandise. SPORTIQ is independent and is not affiliated with or endorsed by any club, league, team or brand. See the copyright notice for details." },
];

export const DEFAULT_BANNERS = [
  { position: "hero", eyebrow: "Sportswear for Sri Lanka", title: "Wear your game.", body: "Jerseys and sport style from football to Formula 1. Ready stock ships now; pre-orders are tracked from supplier to your door.", cta_label: "Shop now", cta_href: "/shop", from: "#111111", to: "#f4720a" },
  { position: "slider", eyebrow: "Campaign 01", title: "Wear Your Game", body: "The matchday look, sourced for Sri Lanka.", cta_label: "Shop all", cta_href: "/shop", from: "#111111", to: "#3a1d05" },
  { position: "slider", eyebrow: "Campaign 02", title: "Retro Archive", body: "Classic shirts from eras fans never forgot.", cta_label: "Explore retro", cta_href: "/collections/retro-archive", from: "#2b1a0a", to: "#d9822b" },
  { position: "slider", eyebrow: "Campaign 03", title: "NBA and NFL", body: "American league jerseys, now pre-order from S to 3XL.", cta_label: "Shop NBA", cta_href: "/sports/nba", from: "#0b1d33", to: "#c8102e" },
  { position: "slider", eyebrow: "Campaign 04", title: "World Cup Mode", body: "Gear up for the biggest stage in football.", cta_label: "Shop football", cta_href: "/sports/football", from: "#0a2a1a", to: "#2b6e45" },
  { position: "slider", eyebrow: "Campaign 05", title: "Pre-Order Season", body: "Pre-orders arrive in 2 to 3 weeks. Track every stage to your door.", cta_label: "How it works", cta_href: "/help/pre-orders", from: "#1a1a1a", to: "#b01e1e" },
];
