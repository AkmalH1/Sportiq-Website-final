"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { saveTexts } from "@/lib/site-text";
import { TEXT_DEFS } from "@/lib/site-text-defs";

export async function saveSiteTextAction(fd: FormData) {
  const actor = await requireAdmin();
  const values: Record<string, string> = {};
  for (const d of TEXT_DEFS) {
    const all = fd.getAll(d.key).map(String);
    if (all.length) values[d.key] = all[all.length - 1]; // a toggle posts "0" then, if ticked, "1"
  }
  try {
    await saveTexts(values, actor);
  } catch (e) {
    redirect(`/admin/site-text?err=${encodeURIComponent(e instanceof Error ? e.message : "Could not save.")}`);
  }
  revalidatePath("/", "layout");
  redirect(`/admin/site-text?ok=${encodeURIComponent("Saved. The site now uses your wording.")}`);
}
