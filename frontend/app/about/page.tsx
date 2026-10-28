import type { Metadata } from "next";
import { Parallax, Reveal } from "@/components/Motion";
import { Tilt } from "@/components/Tilt";
import { getSettings, whatsappLink } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "About us", description: "The SPORTIQ story and where to find our store." };

export default async function About() {
  const s = await getSettings();
  let photos: string[] = [];
  try { photos = JSON.parse(s.store_photos); } catch {}
  const query = s.map_query || s.address;
  const trio = s.trio.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((r) => r[0]).slice(0, 3);
  const paras = s.about_body.split(/\n{2,}/).filter(Boolean);
  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink text-paper">
        <Parallax speed={0.3} className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -right-32 -top-20 h-[34rem] w-[34rem] rounded-full border border-white/10" />
          <div className="absolute right-10 top-24 h-[20rem] w-[20rem] rounded-full border border-accent/40" />
        </Parallax>
        <div className="mx-auto max-w-[1400px] px-4 py-28 lg:px-10 lg:py-40">
          <p className="eyebrow text-accent">About us</p>
          <h1 className="display mt-4 max-w-4xl text-6xl md:text-9xl">{s.about_title}</h1>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1400px] gap-12 px-4 py-24 lg:grid-cols-[1fr_1.2fr] lg:px-10">
        <Reveal><p className="display text-4xl md:text-5xl">Our story</p></Reveal>
        <Reveal delay={100}>
          <div className="max-w-2xl space-y-5 text-base leading-relaxed text-stone">
            {paras.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pb-24 lg:px-10" aria-labelledby="trio-h">
        <Reveal>
          <p className="eyebrow text-accent-dark">The team</p>
          <h2 id="trio-h" className="display mt-3 text-5xl md:text-6xl">Three brothers, one store</h2>
          <p className="mt-6 max-w-2xl text-stone">{s.trio_text}</p>
        </Reveal>
        {trio.length > 0 && (
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {trio.map(([name, role], i) => (
              <li key={i}>
                <Reveal delay={i * 90}>
                  <Tilt max={10}>
                    <div className="flex aspect-[4/3] flex-col justify-end bg-ink p-6 text-paper" style={{ backgroundImage: "linear-gradient(160deg, #111 40%, #3a1d05)" }}>
                      <span className="display text-6xl text-accent" aria-hidden="true">{i + 1}</span>
                      <span className="display mt-2 text-3xl">{name}</span>
                      {role && <span className="eyebrow mt-1 text-white/70">{role}</span>}
                    </div>
                  </Tilt>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-mist">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-4 py-24 lg:grid-cols-2 lg:px-10">
          <Reveal>
            <p className="eyebrow text-accent-dark">Visit the store</p>
            <h2 className="display mt-3 text-5xl md:text-6xl">Come and try it on</h2>
            <dl className="mt-8 space-y-4 text-sm">
              <div><dt className="eyebrow text-stone">Address</dt><dd className="mt-1">{s.address || "Store address coming soon. Message us on WhatsApp for directions."}</dd></div>
              {s.opening_hours && <div><dt className="eyebrow text-stone">Opening hours</dt><dd className="mt-1 whitespace-pre-line">{s.opening_hours}</dd></div>}
              <div><dt className="eyebrow text-stone">Phone / WhatsApp</dt><dd className="mt-1"><a className="underline" href={whatsappLink("Hi SPORTIQ, I would like to visit the store.", s)}>{s.phone_display}</a></dd></div>
              {s.instagram && <div><dt className="eyebrow text-stone">Instagram</dt><dd className="mt-1">{s.instagram}</dd></div>}
            </dl>
            <p className="mt-8 text-sm text-stone">Pickup orders are collected here. Pickup is free.</p>
          </Reveal>
          <Reveal delay={120}>
            {query ? (
              <iframe
                title="SPORTIQ store location"
                src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`}
                className="h-80 w-full border border-line md:h-[26rem]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-80 items-center justify-center border border-dashed border-line text-sm text-stone md:h-[26rem]">Live map appears here once the store address is added.</div>
            )}
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-24 lg:px-10">
        <p className="eyebrow text-accent-dark">Inside the store</p>
        <h2 className="display mt-3 text-5xl md:text-6xl">Photos</h2>
        {photos.length > 0 ? (
          <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
            {photos.map((u, i) => (
              <li key={u} className={i % 3 === 1 ? "md:mt-10" : ""}>
                <Reveal delay={(i % 3) * 80}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={`SPORTIQ store photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                </Reveal>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-10 border border-dashed border-line bg-mist p-12 text-center text-sm text-stone">Store photos will appear here. Add them in Admin, Settings.</div>
        )}
      </section>
    </>
  );
}
