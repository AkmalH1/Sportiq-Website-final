import "./home.css";
import { listBanners, listProducts } from "@/lib/catalogue";
import { listCollections, listFaqs } from "@/lib/content";
import { listApproved } from "@/lib/reviews";
import { listSports } from "@/lib/categories";
import { giftConfig } from "@/lib/gift";
import { giftPrice } from "@/lib/promo-logic";
import { getTexts, isOn } from "@/lib/site-text";
import { textLines } from "@/lib/site-text-defs";
import { CampaignSlider } from "@/components/CampaignSlider";
import { Hero } from "@/components/Hero";
import { FaqSection, CapsBand, GiftBand, LatestDrops, ManifestoBand, PreorderExplainer, Reviews, SportGrid, StyleCards } from "@/components/Sections";

export const dynamic = "force-dynamic";

export default async function Home() {
  const t = await getTexts();
  const heroes = await listBanners("hero");
  const slides = await listBanners("slider");
  const products = await listProducts();
  const sports = await listSports();
  const styles = isOn(t, "show.styles") ? await listCollections() : [];
  const faqs = isOn(t, "show.faq") ? await listFaqs() : [];
  const gift = isOn(t, "show.gift") ? await giftConfig() : null;
  const example = gift && gift.tiers.length ? giftPrice(gift.tiers[Math.min(1, gift.tiers.length - 1)].face, gift.tiers) : null;
  return (
    <>
      <Hero banners={heroes} watermark={t["hero.watermark"]} cta2Label={t["hero.cta2_label"]} cta2Href={t["hero.cta2_href"]} ticker={textLines(t["hero.ticker"])} photoNote={t["hero.photo_note"]} />
      <SportGrid sports={sports} t={t} />
      <CampaignSlider slides={slides} />
      {gift && <GiftBand t={t} example={example ? { face: example.face, price: example.price } : null} maxPercent={Math.max(0, ...gift.tiers.map((x) => x.percent))} />}
      {isOn(t, "show.manifesto") && <ManifestoBand t={t} />}
      {isOn(t, "show.styles") && <StyleCards styles={styles} t={t} />}
      {isOn(t, "show.caps") && <CapsBand caps={await listProducts({ sport: "caps" })} t={t} />}
      <LatestDrops products={products} t={t} />
      {isOn(t, "show.pre") && <PreorderExplainer t={t} />}
      {isOn(t, "show.reviews") && <Reviews reviews={await listApproved({ limit: 6 })} t={t} />}
      {isOn(t, "show.faq") && <FaqSection faqs={faqs} t={t} />}
    </>
  );
}
