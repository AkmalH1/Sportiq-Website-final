"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { issueCredit, setExchange, type Exchange } from "@/lib/exchanges";
import { OrderError, setStage } from "@/lib/orders";
import { resolveRecon } from "@/lib/reconcile";
import * as ops from "@/lib/ops";
import * as content from "@/lib/content";
import { deleteReview, setReviewStatus } from "@/lib/reviews";
import { SETTING_DEFAULTS } from "@/lib/settings-defaults";
import { saveImage } from "@/lib/upload";
import { safeAdminPath } from "@/lib/request-guard";
import { parseTiers } from "@/lib/promo-logic";

const go = (path: string, msg: string, ok = true): never =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${ok ? "ok" : "err"}=${encodeURIComponent(msg)}`);

type Ctx = { actor: string; get: (k: string) => string; num: (k: string) => number; fd: FormData };

/** Runs an admin action: checks the session, turns known errors into a message on the page, redirects back. */
async function run(fd: FormData, path: string | (() => string), okMsg: string, fn: (c: Ctx) => string | void | Promise<string | void>): Promise<never> {
  const actor = await requireAdmin();
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const num = (k: string) => Math.round(Number(get(k) || 0));
  let msg = okMsg;
  const where = () => (typeof path === "function" ? path() : path);
  try {
    const r = await fn({ actor, get, num, fd });
    if (typeof r === "string") msg = r;
  } catch (e) {
    if (e instanceof OrderError || e instanceof Error) return go(where(), e.message, false);
    return go(where(), "Something went wrong.", false);
  }
  revalidatePath("/", "layout");
  return go(where(), msg);
}

/* ---- batches ---- */
export async function saveBatchAction(fd: FormData) {
  const id = Number(fd.get("id") || 0);
  let target = "/admin/batches";
  await run(fd, () => target, "Batch saved.", async (c) => {
    const newId = await ops.saveBatch(id, { name: c.get("name"), dealerId: c.num("dealer_id"), eta: c.get("eta"), payable: c.num("payable"), notes: c.get("notes") }, c.actor);
    target = `/admin/batches/${newId}`;
  });
}
export async function advanceBatchAction(fd: FormData) {
  const id = Number(fd.get("id"));
  await run(fd, `/admin/batches/${id}`, "", async (c) => {
    const r = await ops.advanceBatch(id, c.get("stage"), c.get("note"), c.actor);
    return `${r.moved} order(s) moved.${r.skipped.length ? ` Skipped (payment not complete): ${r.skipped.join(", ")}.` : ""}`;
  });
}
export async function supplierPaymentAction(fd: FormData) {
  const id = Number(fd.get("id"));
  await run(fd, `/admin/batches/${id}`, "Supplier payment recorded.", async (c) => await ops.recordSupplierPayment(id, c.num("amount"), c.actor));
}
export async function assignOrdersAction(fd: FormData) {
  const back = safeAdminPath(fd.get("back"));
  await run(fd, back, "", async (c) => {
    const refs = fd.getAll("ref").map(String);
    if (refs.length === 0) throw new OrderError("Tick at least one order.");
    const n = await ops.assignOrders(refs, c.num("batch_id"), c.actor);
    return `${n} pre-order(s) updated. Ready-stock orders are not batched.`;
  });
}
export async function bulkStageAction(fd: FormData) {
  const back = safeAdminPath(fd.get("back"));
  await run(fd, back, "", async (c) => {
    const refs = fd.getAll("ref").map(String);
    if (refs.length === 0) throw new OrderError("Tick at least one order.");
    const stage = c.get("stage");
    if (!stage) throw new OrderError("Choose a stage.");
    let ok = 0;
    const bad: string[] = [];
    for (const r of refs) {
      try { await setStage(r, stage, c.get("note"), c.actor); ok++; } catch { bad.push(r); }
    }
    return `${ok} order(s) moved to ${stage}.${bad.length ? ` Could not move: ${bad.join(", ")}.` : ""}`;
  });
}

/* ---- suppliers ---- */
export async function saveDealerAction(fd: FormData) {
  await run(fd, "/admin/suppliers", "Supplier saved.", async (c) => await ops.saveDealer(c.num("id"), { name: c.get("name"), country: c.get("country"), whatsapp: c.get("whatsapp"), notes: c.get("notes") }, c.actor));
}
export async function deleteDealerAction(fd: FormData) {
  await run(fd, "/admin/suppliers", "Supplier removed.", async (c) => await ops.deleteDealer(c.num("id"), c.actor));
}

/* ---- expenses ---- */
export async function addExpenseAction(fd: FormData) {
  await run(fd, "/admin/expenses", "Expense added.", async (c) => await ops.addExpense({ category: c.get("category"), amount: c.num("amount"), date: c.get("date"), batchId: c.num("batch_id"), description: c.get("description") }, c.actor));
}
export async function deleteExpenseAction(fd: FormData) {
  await run(fd, "/admin/expenses", "Expense deleted.", async (c) => await ops.deleteExpense(c.num("id"), c.actor));
}

/* ---- categories ---- */
export async function addSportAction(fd: FormData) {
  await run(fd, "/admin/categories", "Category added.", async (c) => { await ops.addSport(c.get("name"), c.actor); });
}
export async function saveSportAction(fd: FormData) {
  await run(fd, "/admin/categories", "Category saved.", async (c) => await ops.saveSport(c.get("slug"), { name: c.get("name"), tagline: c.get("tagline"), accent: c.get("accent"), sort: c.num("sort"), active: !!fd.get("active"), chart: String(fd.get("size_chart") ?? "") }, c.actor));
}
export async function deleteSportAction(fd: FormData) {
  await run(fd, "/admin/categories", "Category deleted.", async (c) => await ops.deleteSport(c.get("slug"), c.actor));
}
export async function addSubAction(fd: FormData) {
  await run(fd, "/admin/categories", "Subcategory added.", async (c) => await ops.addSub(c.get("sport"), c.get("name"), c.actor));
}
export async function saveSubAction(fd: FormData) {
  await run(fd, "/admin/categories", "Subcategory saved.", async (c) => await ops.saveSub(c.num("id"), { name: c.get("name"), sort: c.num("sort"), active: !!fd.get("active"), chart: String(fd.get("size_chart") ?? "") }, c.actor));
}
export async function deleteSubAction(fd: FormData) {
  await run(fd, "/admin/categories", "Subcategory deleted.", async (c) => await ops.deleteSub(c.num("id"), c.actor));
}

/* ---- shipping ---- */
export async function saveZoneAction(fd: FormData) {
  await run(fd, "/admin/shipping", "Zone saved.", async (c) => await ops.saveZone(c.num("id"), { name: c.get("name"), countries: c.get("countries"), first: c.num("first"), extra: c.num("extra"), days: c.get("days") }, c.actor));
}
export async function deleteZoneAction(fd: FormData) {
  await run(fd, "/admin/shipping", "Zone deleted.", async (c) => await ops.deleteZone(c.num("id"), c.actor));
}

/* ---- settings ---- */
export async function saveSettingsAction(fd: FormData) {
  await run(fd, "/admin/settings", "Settings saved.", async (c) => {
    const values: Record<string, string> = {};
    for (const k of Object.keys(SETTING_DEFAULTS)) {
      if (k === "store_photos") continue;
      if (fd.has(k)) values[k] = String(fd.get(k) ?? "").trim();
    }
    for (const k of ["local_delivery_fee", "price_player_version", "price_sleeve_long", "price_custom", "price_patch_1", "price_patch_2", "price_patch_3"]) {
      if (k in values && !/^\d{1,7}$/.test(values[k])) throw new OrderError("Prices must be whole numbers.");
    }
    if (fd.has("balance_methods_present")) values.balance_methods = fd.getAll("balance_methods").map(String).filter((m) => ["cash_pickup", "cash_delivery", "bank", "online"].includes(m)).join(",");
    if ("deposit_percent" in values && !(/^\d{1,3}$/.test(values.deposit_percent) && Number(values.deposit_percent) >= 1 && Number(values.deposit_percent) <= 100)) throw new OrderError("Deposit must be a whole number from 1 to 100.");
    if ("giftcard_tiers" in values) {
      const pieces = values.giftcard_tiers.split(",").map((x) => x.trim()).filter(Boolean);
      if (pieces.length === 0 || parseTiers(values.giftcard_tiers).length !== pieces.length) throw new OrderError("Gift card offers must look like 5000:5,10000:8 (card value from 2000 to 100000, then percent off from 0 to 50, no repeats).");
    }
    if ("giftcard_valid_months" in values && !(/^\d{1,2}$/.test(values.giftcard_valid_months) && Number(values.giftcard_valid_months) >= 1 && Number(values.giftcard_valid_months) <= 60)) throw new OrderError("Gift card validity must be 1 to 60 months.");
    for (const k of ["linkedin_url", "developer_linkedin"]) {
      if (values[k] && !/^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/[^\s<>"']*$/i.test(values[k])) throw new OrderError("LinkedIn links must start with https://www.linkedin.com/");
    }
    values.developer_name = (values.developer_name ?? "").replace(/[^\p{L} .'-]/gu, "").slice(0, 60);
    values.whatsapp = (values.whatsapp ?? "").replace(/\D/g, "");
    if (values.whatsapp.length < 9) throw new OrderError("Enter the WhatsApp number with country code, for example 94775379088.");
    // photos: keep ticked, add new
    const current = String(((await db().prepare("SELECT value FROM settings WHERE `key`='store_photos'").get()) as { value: string } | undefined)?.value ?? "[]");
    let photos: string[] = [];
    try { photos = JSON.parse(current); } catch {}
    const keep = new Set(fd.getAll("photo_keep").map(String));
    photos = photos.filter((u) => keep.has(u));
    for (const f of fd.getAll("photo_new")) {
      if (f instanceof File && f.size > 0 && photos.length < 12) photos.push(await saveImage(f));
    }
    values.store_photos = JSON.stringify(photos);
    await ops.saveSiteSettings(values, c.actor);
  });
}

/* ---- reviews ---- */
export async function reviewAction(fd: FormData) {
  await run(fd, "/admin/reviews", "Done.", async (c) => {
    const id = c.num("id");
    const act = c.get("do");
    if (act === "delete") await deleteReview(id);
    else if (act === "approve" || act === "reject" || act === "pending") await setReviewStatus(id, act === "approve" ? "approved" : act === "reject" ? "rejected" : "pending");
    else throw new OrderError("Unknown action.");
    return act === "approve" ? "Review published." : "Review updated.";
  });
}

/* ---- exchanges and credit ---- */
export async function exchangeAction(fd: FormData) {
  await run(fd, "/admin/exchanges", "Updated.", async (c) => {
    const status = c.get("status") as Exchange["status"];
    if (!["new", "approved", "rejected", "completed"].includes(status)) throw new OrderError("Unknown status.");
    await setExchange(c.num("id"), status, c.get("note"), c.actor);
  });
}
export async function issueCreditAction(fd: FormData) {
  await run(fd, "/admin/exchanges", "", async (c) => {
    const code = await issueCredit(c.get("email"), c.num("amount"), c.get("note"), c.actor);
    return `Store credit issued. Code: ${code}. Send it to the customer.`;
  });
}


/* ---- bulk product images: file name = product slug (slug.jpg main, slug-2.jpg, slug-3.jpg extra photos) ---- */
export async function bulkImagesAction(fd: FormData) {
  await run(fd, "/admin/import", "", async () => {
    const files = fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) throw new OrderError("Choose one or more images.");
    if (files.length > 60) throw new OrderError("Upload at most 60 images at a time.");
    let main = 0, extra = 0;
    const missing: string[] = [];
    for (const f of files) {
      const m = /^(.+?)(?:-(\d))?\.(jpe?g|png|webp)$/i.exec(f.name);
      if (!m) { missing.push(f.name); continue; }
      const slugOnly = m[1].toLowerCase();
      const withNum = m[2] ? `${slugOnly}-${m[2]}` : slugOnly;
      // "slug-2.jpg" is the 2nd photo of "slug", unless a product is literally called "slug-2".
      const exact = (await db().prepare("SELECT slug FROM products WHERE slug = ?").get(withNum)) as { slug: string } | undefined;
      const parent = exact ?? (m[2] ? ((await db().prepare("SELECT slug FROM products WHERE slug = ?").get(slugOnly)) as { slug: string } | undefined) : undefined);
      if (!parent) { missing.push(f.name); continue; }
      const url = await saveImage(f);
      if (!m[2] || exact) {
        (await db().prepare("UPDATE products SET image_url = ? WHERE slug = ?").run(url, parent.slug));
        main++;
      } else {
        const row = (await db().prepare("SELECT gallery FROM products WHERE slug = ?").get(parent.slug)) as { gallery: string };
        let g: string[] = [];
        try { g = JSON.parse(row.gallery); } catch {}
        if (g.length < 6) g.push(url);
        (await db().prepare("UPDATE products SET gallery = ? WHERE slug = ?").run(JSON.stringify(g), parent.slug));
        extra++;
      }
    }
    return `${main} main image(s) and ${extra} extra photo(s) added.${missing.length ? ` No matching product for: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}.` : ""}`;
  });
}

/* ---- EMS rates ---- */
export async function saveEmsAction(fd: FormData) {
  await run(fd, "/admin/ems", "EMS rate saved.", (c) => ops.saveEmsRate({ country: c.get("country"), p250: c.num("p250"), p500: c.num("p500"), p1000: c.num("p1000"), step500: c.num("step500"), maxKg: c.num("max_kg"), note: c.get("note") }, c.actor));
}
export async function importEmsAction(fd: FormData) {
  await run(fd, "/admin/ems", "", async (c) => `${await ops.importEms(String(fd.get("paste") ?? ""), c.actor)} countries saved.`);
}
export async function deleteEmsAction(fd: FormData) {
  await run(fd, "/admin/ems", "Rate removed.", async (c) => await ops.deleteEms(c.get("country"), c.actor));
}
export async function toggleEmsAction(fd: FormData) {
  await run(fd, "/admin/ems", "EMS setting saved.", async (c) => {
    const on = c.get("ems_enabled") === "yes";
    await ops.saveSiteSettings({ ems_enabled: on ? "yes" : "no" }, c.actor);
  });
}
export async function emsSettingsAction(fd: FormData) {
  await run(fd, "/admin/ems", "Saved.", async (c) => {
    const pct = Number(c.get("ems_markup_pct") || 0);
    if (!Number.isFinite(pct) || pct < 0 || pct > 200) throw new OrderError("Extra percentage must be between 0 and 200.");
    await ops.saveSiteSettings({ ems_markup_pct: String(pct), ems_checked: c.get("ems_checked") }, c.actor);
  });
}

/* ---- site content: FAQs and collections ---- */
export async function saveFaqAction(fd: FormData) {
  await run(fd, "/admin/content", "FAQ saved.", async (c) => content.saveFaq(c.num("id"), { question: c.get("question"), answer: c.get("answer"), sort: c.num("sort"), active: !!c.fd.get("active") }, c.actor));
}
export async function deleteFaqAction(fd: FormData) {
  await run(fd, "/admin/content", "FAQ deleted.", async (c) => content.deleteFaq(c.num("id"), c.actor));
}
export async function saveCollectionAction(fd: FormData) {
  await run(fd, "/admin/content", "Collection saved.", async (c) =>
    content.saveCollection(c.get("slug"), { name: c.get("name"), blurb: c.get("blurb"), from: c.get("from"), to: c.get("to"), match: c.get("match"), sort: c.num("sort"), active: !!c.fd.get("active") }, c.actor));
}
export async function addCollectionAction(fd: FormData) {
  await run(fd, "/admin/content", "Collection added.", async (c) => content.addCollection(c.get("name"), c.actor));
}
export async function deleteCollectionAction(fd: FormData) {
  await run(fd, "/admin/content", "Collection deleted.", async (c) => content.deleteCollection(c.get("slug"), c.actor));
}

/* ---- payment reconciliation ---- */
export async function resolveReconAction(fd: FormData) {
  await run(fd, "/admin/payments", "Item resolved and recorded.", (c) => resolveRecon(c.num("id"), c.get("resolution"), c.get("note"), c.get("refund_ref"), c.actor));
}
