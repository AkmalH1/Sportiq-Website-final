"use client";

import { useState } from "react";

type Sub = { sport: string; sportName: string; slug: string; name: string };
type Group = { sport: string; sub: string; slug: string; name: string; brands: { slug: string; name: string }[] };

/** Subcategory, subgroup and brand selects for the product form. Each list only offers what belongs under the choice above it. */
export function TaxonomyPicker({ subs, groups, sub: sub0, group: group0, brand: brand0 }: { subs: Sub[]; groups: Group[]; sub: string; group: string; brand: string }) {
  const [sub, setSub] = useState(sub0);
  const [group, setGroup] = useState(group0);
  const [brand, setBrand] = useState(brand0);
  const bySport = [...new Set(subs.map((s) => s.sport))];
  const subGroups = groups.filter((g) => g.sub === sub);
  const brands = groups.find((g) => g.slug === group)?.brands ?? [];
  const lab = "eyebrow mb-2 block text-stone";
  return (
    <>
      <label className="block"><span className={lab}>Subcategory</span>
        <select name="subcategory" value={sub} onChange={(e) => { setSub(e.target.value); setGroup(""); setBrand(""); }} className="field">
          <option value="">None</option>
          {bySport.map((sp) => <optgroup key={sp} label={subs.find((s) => s.sport === sp)?.sportName ?? sp}>{subs.filter((s) => s.sport === sp).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</optgroup>)}
        </select>
      </label>
      <label className="block"><span className={lab}>Subgroup (inside the subcategory)</span>
        <select name="subgroup" value={group} onChange={(e) => { setGroup(e.target.value); setBrand(""); }} className="field" disabled={!sub}>
          <option value="">{sub ? (subGroups.length ? "None" : "None yet. Add one in Admin, Categories") : "Choose a subcategory first"}</option>
          {subGroups.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
        </select>
      </label>
      <label className="block"><span className={lab}>Brand (from the subgroup&apos;s brand list)</span>
        <select name="brand" value={brand} onChange={(e) => setBrand(e.target.value)} className="field" disabled={!group}>
          <option value="">{group ? (brands.length ? "None" : "No brands listed for this subgroup") : "Choose a subgroup first"}</option>
          {brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
          {brand && !brands.some((b) => b.slug === brand) && <option value={brand}>{brand} (no longer in the list)</option>}
        </select>
      </label>
      {/* A disabled select is not submitted: keep the cleared values explicit so removing a subgroup really clears it. */}
      {!sub && <input type="hidden" name="subgroup" value="" />}
      {sub && !group && <input type="hidden" name="brand" value="" />}
    </>
  );
}
