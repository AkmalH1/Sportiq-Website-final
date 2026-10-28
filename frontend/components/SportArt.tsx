import type { ReactNode } from "react";

/**
 * Original line illustrations for the homepage sport tiles and campaign banners.
 * Drawn in code: no team crests, league marks, kits, sponsors or photography.
 * Styling classes (art-l, art-a, ...) live in app/home.css. Looked up by sport slug, with a generic fallback.
 */

const pent = (r: number) => Array.from({ length: 5 }, (_, k) => {
  const a = (-90 + k * 72) * (Math.PI / 180);
  return [Math.cos(a) * r, Math.sin(a) * r] as const;
});

function Football() {
  const p = pent(11);
  const o = pent(30);
  return (
    <>
      <g className="art-l">
        <rect x="30" y="14" width="240" height="320" />
        <rect x="80" y="14" width="140" height="60" />
        <rect x="115" y="14" width="70" height="24" />
        <path d="M122 74 Q150 100 178 74" />
        <path d="M30 262 H270" />
        <circle cx="150" cy="262" r="46" />
      </g>
      <g transform="translate(176 168)">
        <circle r="31" className="art-fi" />
        <polygon points={p.map((q) => q.join(",")).join(" ")} className="art-fa" />
        <g className="art-l" style={{ stroke: "rgba(255,255,255,0.7)" }}>
          {p.map((q, i) => <line key={i} x1={q[0]} y1={q[1]} x2={o[i][0] * 0.78} y2={o[i][1] * 0.78} />)}
        </g>
      </g>
    </>
  );
}

function Formula1() {
  const track = "M14 276 C34 190 120 214 150 158 S214 74 286 70";
  return (
    <>
      <path d={track} className="art-d" style={{ strokeWidth: 22 }} />
      <path d={track} className="art-l" style={{ strokeWidth: 1.5, strokeDasharray: "7 9" }} />
      <path d="M30 208 C70 214 100 206 122 184" className="art-a" style={{ strokeWidth: 5, strokeDasharray: "5 5" }} />
      <path d="M22 262 C52 186 128 206 160 150 S220 82 280 78" className="art-a" style={{ strokeWidth: 1.8 }} />
      <g transform="translate(112 92)">
        <circle r="62" className="art-fi" />
        <circle r="48" className="art-l" />
        <circle r="30" className="art-a" />
        <circle r="7" className="art-fw" />
        <g className="art-l" style={{ stroke: "rgba(255,255,255,0.7)" }}>
          {[0, 1, 2, 3, 4].map((k) => {
            const a = (k * 72 - 90) * (Math.PI / 180);
            return <line key={k} x1={Math.cos(a) * 9} y1={Math.sin(a) * 9} x2={Math.cos(a) * 30} y2={Math.sin(a) * 30} />;
          })}
        </g>
      </g>
    </>
  );
}

function Basketball() {
  return (
    <>
      <g className="art-l">
        <path d="M30 14 H270" />
        <rect x="105" y="14" width="90" height="130" />
        <path d="M105 144 A45 45 0 0 0 195 144" />
        <path d="M48 14 V72 A112 112 0 0 0 252 72 V14" />
        <path d="M126 36 H174" />
      </g>
      <g className="art-a">
        <circle cx="150" cy="52" r="11" />
        <path d="M143 63 L146 86 M157 63 L154 86 M150 63 V86" style={{ strokeWidth: 1.5 }} />
        <path d="M150 36 V41" />
      </g>
      <g transform="translate(192 214)">
        <circle r="40" className="art-fi" />
        <g className="art-l" style={{ stroke: "rgba(255,255,255,0.7)" }}>
          <path d="M-40 0 H40 M0 -40 V40" />
          <path d="M-28 -28 C-12 -12 -12 12 -28 28" />
          <path d="M28 -28 C12 -12 12 12 28 28" />
        </g>
        <circle r="40" className="art-a" style={{ strokeWidth: 1, opacity: 0.6 }} />
      </g>
    </>
  );
}

function Rugby() {
  return (
    <>
      <g className="art-l">
        <path d="M24 280 H276" />
        <path d="M24 226 H276" style={{ strokeDasharray: "6 8" }} />
      </g>
      <g className="art-l" style={{ strokeWidth: 3 }}>
        <path d="M150 280 V168 M92 168 H208 M92 168 V28 M208 168 V28" />
      </g>
      <path d="M92 168 H208" className="art-a" style={{ strokeWidth: 3.5 }} />
      <g transform="translate(176 232) rotate(-32)">
        <ellipse rx="52" ry="30" className="art-fi" />
        <g className="art-l" style={{ stroke: "rgba(255,255,255,0.7)" }}>
          <path d="M-34 -14 Q0 -26 34 -14 M-34 14 Q0 26 34 14 M-52 0 H52" />
        </g>
        <path d="M-12 0 H12 M-6 -5 V5 M0 -5 V5 M6 -5 V5" className="art-a" style={{ strokeWidth: 1.8 }} />
      </g>
    </>
  );
}

function AmericanFootball() {
  return (
    <>
      <g className="art-l">
        <path d="M34 10 V300 M266 10 V300" />
        {[50, 100, 150, 200, 250].map((y) => <path key={y} d={`M34 ${y} H266`} />)}
      </g>
      <g className="art-d" style={{ strokeWidth: 3 }}>
        {[75, 125, 175, 225, 275].map((y) => <path key={y} d={`M118 ${y} h6 M176 ${y} h6`} />)}
      </g>
      <g transform="translate(150 165) rotate(-28)">
        <path d="M-62 0 Q0 -46 62 0 Q0 46 -62 0Z" className="art-fi" />
        <g className="art-l" style={{ stroke: "rgba(255,255,255,0.7)" }}>
          <path d="M-46 -14 Q-40 0 -46 14 M-40 -18 Q-33 0 -40 18 M46 -14 Q40 0 46 14 M40 -18 Q33 0 40 18" />
        </g>
        <path d="M-18 0 H18 M-12 -7 V7 M-4 -7 V7 M4 -7 V7 M12 -7 V7" className="art-a" style={{ strokeWidth: 2 }} />
      </g>
    </>
  );
}

function Baseball() {
  return (
    <>
      <g className="art-l">
        <path d="M150 262 L20 128 M150 262 L280 128" />
        <path d="M6 122 A210 210 0 0 1 294 122" />
        <path d="M150 62 L252 162 L150 262 L48 162 Z" />
        <circle cx="150" cy="162" r="13" />
      </g>
      <g className="art-fw">
        <rect x="143" y="55" width="14" height="14" transform="rotate(45 150 62)" />
        <rect x="245" y="155" width="14" height="14" transform="rotate(45 252 162)" />
        <rect x="41" y="155" width="14" height="14" transform="rotate(45 48 162)" />
      </g>
      <path d="M150 252 l10 10 -10 10 -10 -10z" className="art-fa" />
      <g transform="translate(222 82)">
        <circle r="26" className="art-fi" />
        <path d="M-16 -18 C-4 -8 -4 8 -16 18 M16 -18 C4 -8 4 8 16 18" className="art-a" style={{ strokeWidth: 1.8, strokeDasharray: "3 4" }} />
      </g>
      <g transform="translate(78 252) rotate(-38)">
        <path d="M-70 -4 L50 -9 Q64 -9 64 0 Q64 9 50 9 L-70 4 Q-76 0 -70 -4Z" className="art-fi" />
        <path d="M-70 -4 V4" className="art-a" />
      </g>
    </>
  );
}

function IceHockey() {
  return (
    <>
      <g className="art-l">
        <rect x="42" y="14" width="216" height="280" rx="58" />
        <path d="M42 150 H258" style={{ stroke: "var(--color-accent)" }} />
        <path d="M42 96 H258 M42 204 H258" style={{ strokeWidth: 3, opacity: 0.6 }} />
        <circle cx="150" cy="150" r="30" />
        <path d="M118 40 H182" />
        <path d="M126 40 A24 24 0 0 0 174 40" />
        <circle cx="96" cy="250" r="3" className="art-fw" />
        <circle cx="204" cy="250" r="3" className="art-fw" />
      </g>
      <g transform="translate(150 232)">
        <path d="M-44 0 V14 A44 14 0 0 0 44 14 V0Z" className="art-fi" />
        <ellipse rx="44" ry="14" className="art-fi" />
        <ellipse rx="44" ry="14" className="art-a" style={{ strokeWidth: 1.5, opacity: 0.8 }} />
      </g>
      <path d="M232 62 L158 214 Q154 224 140 224 H120" className="art-a" style={{ strokeWidth: 4 }} />
    </>
  );
}

function Caps() {
  return (
    <>
      <g className="art-d">
        <circle cx="150" cy="150" r="124" />
        <circle cx="150" cy="150" r="96" style={{ strokeDasharray: "3 8" }} />
      </g>
      <g transform="translate(18 62) scale(1.8)" className="art-l" style={{ strokeWidth: 1.4 }}>
        <path d="M14 62C14 30 40 12 72 14c28 2 42 22 44 44" className="art-fi" style={{ strokeWidth: 1.4 }} />
        <path d="M14 62h102c20 0 34 4 38 10-6 6-26 8-44 6-24-3-70-3-96-2z" className="art-fi" style={{ strokeWidth: 1.4 }} />
        <path d="M72 14v48M44 22c8 10 12 24 12 40M100 24c-6 10-8 22-8 38" style={{ stroke: "rgba(255,255,255,0.55)" }} />
        <circle cx="72" cy="11" r="4" className="art-fa" />
        <path d="M20 70 H112" className="art-a" style={{ strokeWidth: 1.6 }} />
      </g>
    </>
  );
}

function Generic() {
  return (
    <>
      <g className="art-d">
        <circle cx="150" cy="150" r="120" />
        <circle cx="150" cy="150" r="84" />
        <path d="M30 150 H270 M150 30 V270" />
      </g>
      <path d="M44 236 C100 110 200 110 256 64" className="art-a" />
      <circle cx="150" cy="150" r="30" className="art-fi" />
      <circle cx="150" cy="150" r="9" className="art-fa" />
    </>
  );
}

const ART: Record<string, () => ReactNode> = {
  football: Football, soccer: Football,
  "formula-1": Formula1, f1: Formula1, formula1: Formula1,
  nba: Basketball, basketball: Basketball,
  rugby: Rugby,
  nfl: AmericanFootball, "american-football": AmericanFootball,
  baseball: Baseball, mlb: Baseball,
  nhl: IceHockey, hockey: IceHockey, "ice-hockey": IceHockey,
  caps: Caps, headwear: Caps,
};

export function hasSportArt(slug: string) { return Object.prototype.hasOwnProperty.call(ART, slug); }

/** Slug from a /sports/<slug> or /caps link, used to pick artwork for campaign banners. */
export function slugFromHref(href: string | undefined): string {
  const m = /^\/sports\/([^/?#]+)/.exec(href ?? "");
  if (m) return m[1];
  if ((href ?? "").startsWith("/caps")) return "caps";
  return "";
}

export function SportArt({ slug, className = "" }: { slug: string; className?: string }) {
  const Art = hasSportArt(slug) ? ART[slug] : Generic;
  return (
    <div className={`art ${className}`} aria-hidden="true">
      <svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet" focusable="false"><Art /></svg>
    </div>
  );
}
