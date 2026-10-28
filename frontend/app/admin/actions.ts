"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { clientIp, hit, limited, peek } from "@/lib/ratelimit";
import { revalidatePath } from "next/cache";
import { checkPassword, endAdminSession, isTrustedDevice, markTrustedDevice, requireAdmin, startAdminSession, totpRequired, totpSecret } from "@/lib/admin-auth";
import { alertOwner } from "@/lib/alert";
import { verifyTotp } from "@/lib/totp";
import { audit, db } from "@/lib/db";
import { SIZES } from "@/lib/config";
import { importProductRows, importProductsCsv, type ImportResult } from "@/lib/import";
import { parseCsv } from "@/lib/csv";
import { readWorkbook, cellText } from "@/lib/xlsx-read";
import { convertScraperx, isScraperx, photoPlan } from "@/lib/scraperx";
import { OrderError, cancelUnpaidOrder, confirmBankPayment, recordCash, rejectBankPayment, setStage } from "@/lib/orders";
import { saveImage } from "@/lib/upload";

export type LoginState = { error?: string };

export async function loginAction(_p: LoginState, fd: FormData): Promise<LoginState> {
  const ip = clientIp(await headers());
  const trusted = await isTrustedDevice();
  // Lockout design: nothing here can be switched off by anonymous traffic. A stranger's attempts only slow down STRANGERS.
  //  1. Per address: 8 attempts / 15 min (a stranger can only lock out their own address).
  //  2. Everyone together: failures are counted; past a threshold unknown browsers are slowed (up to 4 s each) and you are alerted,
  //     but the form is never closed. Your own known browser (signed cookie from an earlier full login) keeps normal speed.
  const globalFails = await peek("login-fail-all");
  const delay = trusted ? 500 : Math.min(4000, 500 + Math.max(0, globalFails - 20) * 50);
  await new Promise((r) => setTimeout(r, delay)); // slows down password guessing
  if (!trusted && (await limited("login:" + ip, 8, 15 * 60 * 1000))) return { error: "Too many attempts from this address. Try again in 15 minutes." };
  const fail = async (why: string) => {
    await audit("admin", "login.failed", `${why} ${ip}`);
    const total = await hit("login-fail-all", 15 * 60 * 1000);
    if (total === 100) await alertOwner("Admin login is under heavy guessing: 100 failed attempts in 15 minutes. Strangers are being slowed; your known browser is unaffected.");
    // A burst from one address is worth a phone alert.
    if ((await hit("login-alert:" + ip, 60 * 60 * 1000)) === 5) await alertOwner(`Repeated failed admin logins from ${ip}`);
    return { error: "Wrong details, or admin is not configured." } as LoginState;
  };
  if (!checkPassword(String(fd.get("password") ?? "").slice(0, 200))) return fail("password");
  if (totpRequired()) {
    const step = verifyTotp(totpSecret(), String(fd.get("code") ?? ""));
    if (step === null) return fail("code");
    // A code can be used once: a shoulder-surfed or intercepted code cannot be replayed within its window (atomic, see lib/ratelimit.ts).
    if (await limited("totp-used:" + step, 1, 120_000)) return fail("code-replay");
  }
  await audit("admin", "login.ok", ip);
  await startAdminSession(String(fd.get("staff_name") ?? ""));
  await markTrustedDevice();
  redirect("/admin");
}

export async function logoutAction() {
  await endAdminSession();
  redirect("/admin/login");
}

const back = (path: string, msg: string, ok = false): never =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${ok ? "ok" : "err"}=${encodeURIComponent(msg)}`);

/* ---------- orders ---------- */

export async function stageAction(fd: FormData) {
  const actor = await requireAdmin();
  const ref = String(fd.get("reference"));
  const path = `/admin/orders/${ref}`;
  try {
    await setStage(ref, String(fd.get("stage")), String(fd.get("note") ?? "").slice(0, 300), actor);
  } catch (e) {
    return back(path, e instanceof OrderError ? e.message : "Could not update the stage.");
  }
  revalidatePath(path);
  back(path, "Stage updated.", true);
}

export async function recordCashAction(fd: FormData) {
  const actor = await requireAdmin();
  const ref = String(fd.get("reference"));
  const path = `/admin/orders/${ref}`;
  try {
    await recordCash(ref, Number(fd.get("amount")), actor);
  } catch (e) {
    return back(path, e instanceof OrderError ? e.message : "Could not record the cash.");
  }
  revalidatePath(path);
  back(path, "Cash recorded.", true);
}

export async function confirmBankAction(fd: FormData) {
  const actor = await requireAdmin();
  const ref = String(fd.get("reference"));
  try {
    await confirmBankPayment(Number(fd.get("payment_id")), actor);
  } catch (e) {
    return back(`/admin/orders/${ref}`, e instanceof OrderError ? e.message : "Could not confirm.");
  }
  back(`/admin/orders/${ref}`, "Payment confirmed.", true);
}

export async function rejectBankAction(fd: FormData) {
  const actor = await requireAdmin();
  const ref = String(fd.get("reference"));
  try {
    await rejectBankPayment(Number(fd.get("payment_id")), String(fd.get("note") || "Could not match this payment to the bank record.").slice(0, 300), actor);
  } catch (e) {
    return back(`/admin/orders/${ref}`, e instanceof OrderError ? e.message : "Could not reject.");
  }
  back(`/admin/orders/${ref}`, "Payment rejected. The customer can submit another reference.", true);
}

export async function cancelOrderAction(fd: FormData) {
  const actor = await requireAdmin();
  const ref = String(fd.get("reference"));
  try {
    await cancelUnpaidOrder(ref, actor);
  } catch (e) {
    return back(`/admin/orders/${ref}`, e instanceof OrderError ? e.message : "Could not cancel.");
  }
  back(`/admin/orders/${ref}`, "Order cancelled and stock released.", true);
}

/* ---------- products ---------- */

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export async function saveProductAction(fd: FormData) {
  const actor = await requireAdmin();
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const original = get("original_slug");
  const name = get("name");
  const slug = original || get("slug") || slugify(name);
  const here = original ? `/admin/products/${original}` : "/admin/products/new";

  let image = get("image_url");
  const file = fd.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      image = await saveImage(file);
    } catch (e) {
      return back(here, e instanceof Error ? e.message : "Image upload failed.");
    }
  }

  const header = ["slug", "name", "sport", "type", "version", "price_lkr", "description", "status", "preorder_enabled", "preorder_eta", "image_url", "sku_prefix", "subcategory", "league", "customizable", "weight_g", ...SIZES.map((s) => `stock_${s}`), "stock_ONE", "competition", "subgroup", "brand"];
  const row = [
    slug, name, get("sport"), get("type"), get("version"), get("price_lkr"), get("description"), get("status") || "published",
    fd.get("preorder_enabled") ? "yes" : "no", get("preorder_eta"), image, get("sku_prefix"),
    get("subcategory"), get("league"), fd.get("customizable") ? "yes" : "no", get("weight_g") || "400",
    ...SIZES.map((s) => get(`stock_${s}`) || "0"),
    get("stock_ONE") || "0",
    get("competition"),
    get("subgroup"),
    get("brand"),
  ].map(csvCell);
  const result = await importProductsCsv(header.join(",") + "\n" + row.join(","), actor);
  if (!result.ok) return back(here, result.errors.map((e) => e.message).join(" "));

  // Gallery: keep the ticked existing images, add up to 6 new ones.
  const keep = fd.getAll("gallery_keep").map(String);
  const gallery = keep.filter((u) => u.startsWith("/uploads/"));
  for (const f of fd.getAll("gallery_new")) {
    if (!(f instanceof File) || f.size === 0) continue;
    if (gallery.length >= 6) break;
    try {
      gallery.push(await saveImage(f));
    } catch (e) {
      return back(`/admin/products/${slug}`, e instanceof Error ? e.message : "Gallery image upload failed.");
    }
  }
  (await db().prepare("UPDATE products SET gallery = ? WHERE slug = ?").run(JSON.stringify(gallery), slug));
  revalidatePath("/", "layout");
  redirect(`/admin/products/${slug}?ok=${encodeURIComponent("Saved.")}`);
}

/* ---------- bulk import ---------- */

export type ImportState = ImportResult | null;

export async function importCsvAction(_p: ImportState, fd: FormData): Promise<ImportState> {
  const actor = await requireAdmin();
  const fail = (message: string): ImportState => ({ ok: false, created: 0, updated: 0, errors: [{ row: 0, message }] });
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a CSV or Excel (.xlsx) file.");
  if (file.size > 20 * 1024 * 1024) return fail("File is larger than 20 MB.");
  const dryRun = String(fd.get("mode") ?? "preview") !== "commit";
  const createSubs = fd.get("create_subs") === "on";
  const buf = Buffer.from(await file.arrayBuffer());
  const isXlsx = buf.subarray(0, 2).toString("latin1") === "PK"; // real signature, not just the file name

  let result: ImportResult;
  if (!isXlsx) {
    if (/\.xlsx?$/i.test(file.name)) return fail("That file is not a valid .xlsx workbook. Old .xls files are not supported: save as .xlsx or CSV.");
    result = await importProductRows(parseCsv(buf.toString("utf8")), actor, { dryRun, createSubs });
  } else {
    let sheets;
    try { sheets = await readWorkbook(buf); } catch (e) { return fail(e instanceof Error ? e.message : "Could not read the workbook."); }
    const first = sheets.find((sh) => (sh.rows[0] ?? []).map((c) => cellText(c).toLowerCase()).includes("slug"));
    if (first) {
      // Native SPORTIQ template.
      result = await importProductRows(first.rows.map((r) => r.map(cellText)), actor, { dryRun, createSubs });
    } else if (sheets.some((sh) => isScraperx((sh.rows[0] ?? []).map(cellText)))) {
      const markup = Number(fd.get("markup_pct") || 0);
      if (!Number.isFinite(markup) || markup < 0 || markup > 500) return fail("Markup must be between 0 and 500 percent.");
      const sport = String(fd.get("sport") ?? "football");
      const conv = convertScraperx(sheets, {
        markupPct: markup, sport, status: fd.get("status") === "published" ? "published" : "draft",
        preorder: fd.get("preorder") !== "no", preorderEta: String(fd.get("preorder_eta") || "Arrives in 2 to 3 weeks").slice(0, 120),
      });
      if (conv.errors.length || !conv.rows.length) return { ok: false, created: 0, updated: 0, errors: conv.errors.length ? conv.errors : [{ row: 0, message: "No products found." }] };
      result = await importProductRows(conv.rows, actor, { dryRun, createSubs });
      result.notes = [...(result.notes ?? []), ...conv.notes];
      if (conv.photos.length) result.photos = photoPlan(conv.photos);
    } else {
      return fail('This workbook is not recognised. Use the SPORTIQ template (has a "slug" column) or a ScraperX export (has "Product Name" and "SKU").');
    }
  }
  if (result.ok && !dryRun) revalidatePath("/", "layout");
  return result;
}

/* ---------- banners ---------- */

export async function saveBannerAction(fd: FormData) {
  const actor = await requireAdmin();
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const id = Number(fd.get("id") || 0);
  const position = get("position") === "hero" ? "hero" : "slider";
  const title = get("title");
  if (!title) return back("/admin/banners", "A banner needs a title.");
  const color = (k: string, d: string) => (/^#[0-9a-fA-F]{6}$/.test(get(k)) ? get(k) : d);
  const href = get("cta_href");
  if (href && !(href.startsWith("/") && !href.startsWith("//")) && !/^https?:\/\//.test(href)) return back("/admin/banners", "Button link must start with / or https://");

  let image = get("image_url");
  const file = fd.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      image = await saveImage(file);
    } catch (e) {
      return back("/admin/banners", e instanceof Error ? e.message : "Image upload failed.");
    }
  }
  if (fd.get("remove_image")) image = "";

  const vals = [position, Number(get("sort")) || 0, get("eyebrow"), title, get("body"), get("cta_label"), href || "/shop", color("from_color", "#111111"), color("to_color", "#f4720a"), image, fd.get("active") ? 1 : 0];
  if (id) {
    (await db().prepare("UPDATE banners SET `position`=?, sort=?, eyebrow=?, title=?, body=?, cta_label=?, cta_href=?, from_color=?, to_color=?, image_url=?, active=? WHERE id=?").run(...vals, id));
    await audit(actor, "banner.update", String(id));
  } else {
    (await db().prepare("INSERT INTO banners (`position`, sort, eyebrow, title, body, cta_label, cta_href, from_color, to_color, image_url, active) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(...vals));
    await audit(actor, "banner.create", title);
  }
  revalidatePath("/", "layout");
  back("/admin/banners", "Banner saved.", true);
}

export async function deleteBannerAction(fd: FormData) {
  const actor = await requireAdmin();
  const id = Number(fd.get("id"));
  (await db().prepare("DELETE FROM banners WHERE id = ?").run(id));
  await audit(actor, "banner.delete", String(id));
  revalidatePath("/", "layout");
  back("/admin/banners", "Banner deleted.", true);
}

/* ---------- bulk product actions (delete / publish / hide) ---------- */

export async function bulkProductsAction(fd: FormData) {
  const actor = await requireAdmin();
  const intent = String(fd.get("intent") ?? "");
  const slugs = fd.getAll("slug").map(String).filter((s) => /^[a-z0-9][a-z0-9-]{0,119}$/.test(s));
  const done = (msg: string, ok = true) => back("/admin/products", msg, ok);

  if (intent === "delete_all") {
    if (String(fd.get("confirm") ?? "").trim() !== "DELETE") return done("Nothing deleted. Type DELETE in capitals to remove every product.", false);
    const n = ((await db().prepare("SELECT COUNT(*) AS n FROM products").get()) as { n: number }).n;
    await db().prepare("DELETE FROM products").run(); // variants go with them; past orders keep their own copy of name and size
    await audit(actor, "product.delete_all", String(n));
    revalidatePath("/", "layout");
    return done(`All ${n} products deleted.`);
  }
  if (slugs.length === 0) return done("Tick at least one product first.", false);
  if (slugs.length > 1000) return done("Too many at once. Select up to 1000.", false);
  const marks = slugs.map(() => "?").join(",");
  if (intent === "delete") {
    await db().prepare(`DELETE FROM products WHERE slug IN (${marks})`).run(...slugs);
    await audit(actor, "product.delete_bulk", `${slugs.length}: ${slugs.slice(0, 5).join(",")}`);
    revalidatePath("/", "layout");
    return done(`${slugs.length} product${slugs.length === 1 ? "" : "s"} deleted.`);
  }
  if (intent === "publish" || intent === "hide") {
    const status = intent === "publish" ? "published" : "draft";
    await db().prepare(`UPDATE products SET status = ? WHERE slug IN (${marks})`).run(status, ...slugs);
    await audit(actor, `product.${status}_bulk`, String(slugs.length));
    revalidatePath("/", "layout");
    return done(`${slugs.length} product${slugs.length === 1 ? "" : "s"} set to ${status}.`);
  }
  if (intent === "set_version") {
    const choice = String(fd.get("version_choice") ?? "");
    const label = ({ both: "Fan & Player", fan: "Fan only", player: "Player only" } as Record<string, string>)[choice];
    if (!label) return done("Choose which versions to offer.", false);
    await db().prepare(`UPDATE products SET version = ? WHERE slug IN (${marks})`).run(label, ...slugs);
    await audit(actor, "product.version_bulk", `${label}: ${slugs.length}`);
    revalidatePath("/", "layout");
    return done(`${slugs.length} product${slugs.length === 1 ? "" : "s"} now offer: ${label}.`);
  }
  if (intent === "set_price") {
    const price = Number(String(fd.get("new_price") ?? "").trim());
    if (!Number.isInteger(price) || price < 0 || price > 10_000_000) return done("Enter the new price as a whole number, for example 4900.", false);
    await db().prepare(`UPDATE products SET price_lkr = ? WHERE slug IN (${marks})`).run(price, ...slugs);
    await audit(actor, "product.price_bulk", `${price}: ${slugs.length}`);
    revalidatePath("/", "layout");
    return done(`Price set to ${price} for ${slugs.length} product${slugs.length === 1 ? "" : "s"}.`);
  }
  if (intent === "custom_on" || intent === "custom_off") {
    await db().prepare(`UPDATE products SET customizable = ? WHERE slug IN (${marks})`).run(intent === "custom_on" ? 1 : 0, ...slugs);
    await audit(actor, `product.${intent}_bulk`, String(slugs.length));
    revalidatePath("/", "layout");
    return done(`Name, number and patch options turned ${intent === "custom_on" ? "on" : "off"} for ${slugs.length} product${slugs.length === 1 ? "" : "s"}.`);
  }
  return done("Unknown action.", false);
}
