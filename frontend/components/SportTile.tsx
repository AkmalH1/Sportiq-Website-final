import Link from "next/link";
import type { Sport } from "@/lib/types";
import { SportArt } from "./SportArt";

/** One shop-by-sport tile. The whole card is the link; artwork is chosen by sport slug. */
export function SportTile({ sport, index }: { sport: Sport; index: number }) {
  return (
    <Link href={`/sports/${sport.slug}`} className="sport-tile group" aria-label={`Shop ${sport.name}. ${sport.tagline}`}>
      <span className="eyebrow text-white/70">{String(index + 1).padStart(2, "0")}</span>
      <SportArt slug={sport.slug} />
      <span>
        <span className="display tile-name block">{sport.name}</span>
        <span className="mt-1 block text-xs leading-snug text-white/75">{sport.tagline}</span>
        <span className="eyebrow tile-cta mt-4 pb-1 text-accent">Shop <span aria-hidden="true">&rarr;</span></span>
      </span>
    </Link>
  );
}
