"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import * as comps from "@/lib/competitions";

const PATH = "/admin/categories";
const go = (msg: string, ok: boolean): never => redirect(`${PATH}?${ok ? "ok" : "err"}=${encodeURIComponent(msg)}`);

/** Same pattern as the other admin actions: session check first, known errors shown on the page, then redirect back. */
async function run(fd: FormData, okMsg: string, fn: (get: (k: string) => string, actor: string) => Promise<void>): Promise<never> {
  const actor = await requireAdmin();
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  try {
    await fn(get, actor);
  } catch (e) {
    return go(e instanceof Error ? e.message : "Something went wrong.", false);
  }
  revalidatePath("/", "layout");
  return go(okMsg, true);
}

export async function addCompetitionAction(fd: FormData) {
  await run(fd, "Competition added.", (g, a) => comps.addCompetition(g("sport"), g("name"), a));
}
export async function saveCompetitionAction(fd: FormData) {
  await run(fd, "Competition saved.", (g, a) => comps.saveCompetition(Number(g("id")), { name: g("name"), logo: g("logo_url"), sort: Math.round(Number(g("sort") || 0)), active: !!fd.get("active") }, a));
}
export async function deleteCompetitionAction(fd: FormData) {
  await run(fd, "Competition deleted.", (g, a) => comps.deleteCompetition(Number(g("id")), a));
}
