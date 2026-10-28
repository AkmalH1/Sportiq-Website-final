import { NextResponse, type NextRequest } from "next/server";
import { decideHostAccess } from "@/lib/host-policy";

/**
 * Per-request Content-Security-Policy with a script nonce (https://nextjs.org/docs/app/guides/content-security-policy).
 * Scripts may only run if they carry this request's random nonce ('strict-dynamic' then lets those trusted scripts load their own chunks),
 * so an injected <script> or inline handler is blocked even if some page ever failed to escape user text.
 * Styles keep 'unsafe-inline' because the UI sets style="" attributes (animations); that cannot execute code.
 */
/**
 * Host/path policy (see lib/host-policy.ts): runs for EVERY request, including /api and including prefetch requests
 * (a client-supplied "purpose: prefetch" header must never be a way around it).
 */
function hostRule(request: NextRequest): NextResponse | null {
  const d = decideHostAccess(request.headers.get("host"), request.nextUrl.pathname, {
    ADMIN_HOST: process.env.ADMIN_HOST,
    PAYHERE_NOTIFY_HOST: process.env.PAYHERE_NOTIFY_HOST,
  });
  if (d.action === "redirect") return new NextResponse(null, { status: 302, headers: { Location: d.to } });
  if (d.action === "deny") return new NextResponse("Not found", { status: d.status });
  return null;
}

export function proxy(request: NextRequest) {
  const blocked = hostRule(request);
  if (blocked) return blocked;
  // API routes return JSON, not HTML: no CSP nonce needed. Prefetches get no nonce either (it would make pages dynamic).
  const h = request.headers;
  if (request.nextUrl.pathname.startsWith("/api/") || h.has("next-router-prefetch") || h.get("purpose") === "prefetch") return NextResponse.next();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src https://www.google.com",
    "form-action 'self' https://www.payhere.lk https://sandbox.payhere.lk",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  // No "missing" conditions here on purpose: the host policy must run on every request (prefetch headers are attacker-controlled).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
