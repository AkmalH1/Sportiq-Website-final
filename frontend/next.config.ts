import type { NextConfig } from "next";

// The Content-Security-Policy is set per request (with a script nonce) in proxy.ts.

const security = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // Body limits by layer (keep in step, see SECURITY.md "Request size limits"):
  //   Caddy public host 8 MB (/api/upload 5 MB, PayHere callback 16 KB) | Caddy staff host 26 MB
  //   app: bulk import file 20 MB (app/admin/actions.ts), /admin/photos request 24 MB (app/admin/photos/route.ts), image file 4 MB (lib/upload.ts)
  //   Next server actions: 25 MB (below). Public forms are capped by Caddy at 8 MB, so this value is NOT a public limit.
  // Admin uploads (CSV files, banner and product images) go through server actions.
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
  // Excel reading (read-excel-file > unzipper) must load from node_modules at runtime, not be bundled.
  serverExternalPackages: ["read-excel-file", "unzipper"],
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: security },
      // Order pages carry the customer's email in the URL: never send it on as a referrer, never cache it.
      // Fingerprinted build files and fonts never change: cache them for a year so repeat visits on mobile data are instant.
      { source: "/_next/static/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/track-order/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "no-store" }] },
      { source: "/pay/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
