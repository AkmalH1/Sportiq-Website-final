"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import * as groups from "@/lib/subgroups";

const PATH = "/admin/categories";
const go = (msg: string, ok: boolean): never => redirect(`${PATH}?${ok ? "ok" : "err"}=${encodeURIComponent(msg)}`);

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

export async function addSubgroupAction(fd: FormData) {
  await run(fd, "Subgroup added.", (g, a) => groups.addSubgroup(g("sport"), g("sub"), g("name"), a));
}
export async function saveSubgroupAction(fd: FormData) {
  // The brands box is not trimmed per line, so read it raw.
  await run(fd, "Subgroup saved.", (g, a) => groups.saveSubgroup(Number(g("id")), { name: g("name"), brands: String(fd.get("brands") ?? ""), sort: Math.round(Number(g("sort") || 0)), active: !!fd.get("active") }, a));
}
export async function deleteSubgroupAction(fd: FormData) {
  await run(fd, "Subgroup deleted.", (g, a) => groups.deleteSubgroup(Number(g("id")), a));
}
