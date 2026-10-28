import { Flash } from "@/components/AdminBits";
import { AField, Hint } from "@/components/AdminUI";
import { BALANCE_METHODS, enabledBalanceMethods, type BalanceMethod } from "@/lib/balance";
import { requireAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";
import { saveSettingsAction } from "../ops-actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const s = await getSettings();
  let photos: string[] = [];
  try { photos = JSON.parse(s.store_photos); } catch {}
  const t = (k: keyof typeof s, label: string, extra = "") => (
    <AField label={label} className={extra}><input name={k} defaultValue={s[k]} className="field" /></AField>
  );
  return (
    <div>
      <h1 className="display text-5xl">Site settings</h1>
      <Hint>Everything shown on the About page, footer, WhatsApp button, delivery fee and jersey option prices. Fill in your store address and photos so the About page shows the live map.</Hint>
      <div className="mt-6"><Flash ok={sp.ok} err={sp.err} /></div>
      <form action={saveSettingsAction} className="grid max-w-4xl gap-6">
        <fieldset className="grid gap-4 border border-line p-5 sm:grid-cols-2">
          <legend className="eyebrow px-2">Contact</legend>
          {t("whatsapp", "WhatsApp number (digits, with country code)")}
          {t("phone_display", "Phone shown on the site")}
          {t("email", "Email")}
          {t("instagram", "Instagram")}
          {t("linkedin_url", "LinkedIn page link (https://www.linkedin.com/company/...)")}
          {t("developer_name", "Developer name shown in the footer")}
          {t("developer_linkedin", "Developer LinkedIn link (optional)")}
        </fieldset>
        <fieldset className="grid gap-4 border border-line p-5">
          <legend className="eyebrow px-2">Store</legend>
          {t("address", "Store address")}
          {t("map_query", "Map search (leave empty to use the address, or paste a place name)")}
          <AField label="Opening hours"><textarea name="opening_hours" rows={3} defaultValue={s.opening_hours} className="field" /></AField>
          <div>
            <p className="eyebrow mb-2 text-stone">Store photos (up to 12)</p>
            {photos.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-3">
                {photos.map((u) => (
                  <label key={u} className="text-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-24 w-32 object-cover" />
                    <input type="checkbox" name="photo_keep" value={u} defaultChecked /> keep
                  </label>
                ))}
              </div>
            )}
            <input name="photo_new" type="file" multiple accept="image/jpeg,image/png,image/webp" className="field" />
          </div>
        </fieldset>
        <fieldset className="grid gap-4 border border-line p-5">
          <legend className="eyebrow px-2">About us</legend>
          {t("about_title", "Headline")}
          <AField label="Story (blank line between paragraphs)"><textarea name="about_body" rows={10} defaultValue={s.about_body} className="field" /></AField>
        </fieldset>
        <fieldset className="grid gap-4 border border-line p-5">
          <legend className="eyebrow px-2">The three brothers (About page)</legend>
          {t("trio_text", "Sentence under the heading")}
          <AField label="One brother per line, as: Name | Role (leave empty to show no cards)"><textarea name="trio" rows={3} defaultValue={s.trio} placeholder={"Name | Role\nName | Role\nName | Role"} className="field" /></AField>
        </fieldset>
        <fieldset className="border border-line p-5">
          <legend className="eyebrow px-2">Copyright and product notice</legend>
          <AField label="Shown on the Copyright notice page (blank line between paragraphs)"><textarea name="disclaimer" rows={9} defaultValue={s.disclaimer} className="field" /></AField>
        </fieldset>
        <fieldset className="grid gap-4 border border-line p-5 sm:grid-cols-2">
          <legend className="eyebrow px-2">Prices (LKR)</legend>
          {t("local_delivery_fee", "Delivery in Sri Lanka")}
          {t("preorder_weeks", "Pre-order time (shown to customers)")}
          {t("price_player_version", "Player Version extra (football, on top of the Fan Version price)")}
          {t("price_sleeve_long", "Long sleeves")}
          {t("price_custom", "Customisation (name and number)")}
          {t("price_patch_1", "First patch")}
          {t("price_patch_2", "Second patch")}
          {t("price_patch_3", "Third patch")}
        </fieldset>
        <fieldset className="grid gap-4 border border-line p-5">
          <legend className="eyebrow px-2">Pre-order payment policy</legend>
          {t("deposit_percent", "Deposit (% of the pre-order items paid up front; ready-stock items and postage are always paid in full)")}
          <input type="hidden" name="balance_methods_present" value="1" />
          <div>
            <p className="text-sm font-semibold">How may customers pay the remaining balance?</p>
            <p className="text-xs text-stone">Only ticked methods are offered. Untick all to allow full payment only. Cash options are recorded by staff; online and bank balances use the normal payment flow.</p>
            <div className="mt-3 grid gap-2">
              {Object.entries(BALANCE_METHODS).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" name="balance_methods" value={k} defaultChecked={enabledBalanceMethods(s.balance_methods).includes(k as BalanceMethod)} /> {label}</label>
              ))}
            </div>
          </div>
          <AField label="Balance condition shown to customers (due date or when it must be paid)"><input name="balance_note" defaultValue={s.balance_note} maxLength={200} className="field" /></AField>
        </fieldset>
        <fieldset className="grid gap-4 border border-line p-5">
          <legend className="eyebrow px-2">Gift cards</legend>
          {t("giftcard_tiers", "Gift card offers: card value:percent off, separated by commas. Example 5000:5,10000:8,25000:10 means a 10,000 card costs 9,200. A custom amount gets the best offer at or below it.")}
          {t("giftcard_valid_months", "Months a gift card stays valid (1 to 60)")}
        </fieldset>
        <fieldset className="border border-line p-5">
          <legend className="eyebrow px-2">Default size chart</legend>
          <AField label="Used when a product's subcategory and category have no chart. First line is the header, a line starting with # is a note under the table.">
            <textarea name="size_chart_default" rows={9} defaultValue={s.size_chart_default} className="field font-mono text-xs" />
          </AField>
          <p className="mt-2 text-xs text-stone">The starting numbers are typical fan-fit measurements. Replace them with your supplier&apos;s real chart.</p>
        </fieldset>
        <fieldset className="border border-line p-5">
          <legend className="eyebrow px-2">Top banner messages</legend>
          <AField label="One message per line"><textarea name="ticker" rows={5} defaultValue={s.ticker} className="field" /></AField>
        </fieldset>
        <button className="btn btn-primary w-fit">Save settings</button>
      </form>
    </div>
  );
}
