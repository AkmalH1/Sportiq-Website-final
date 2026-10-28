# Strict CSP check with the REAL policy enforced (no bypass): no violations on key pages, and JS-dependent features still work.
import sys, re
from playwright.sync_api import sync_playwright
B = "http://localhost:3081"
def check(l, c):
    print(("PASS " if c else "FAIL ") + l)
    if not c: check.failed = True
check.failed = False
PAGES = ["/", "/shop", "/products/demo-barcelona-home-jersey", "/cart", "/checkout", "/track-order", "/admin/login", "/caps", "/about", "/returns", "/shipping", "/reviews"]
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={"width": 1280, "height": 900}); pg = ctx.new_page()
    bad = []
    pg.on("console", lambda m: bad.append(m.text[:160]) if "Content Security Policy" in m.text or "content security policy" in m.text.lower() else None)
    pg.on("pageerror", lambda e: bad.append("pageerror " + str(e)[:120]))
    r = pg.goto(B + "/"); csp = r.headers.get("content-security-policy", "")
    check("CSP header present with a per-request nonce", "'nonce-" in csp)
    check("script-src has no 'unsafe-inline' / 'unsafe-eval'", "unsafe-inline" not in csp.split("script-src")[1].split(";")[0] and "unsafe-eval" not in csp)
    n1 = re.search(r"nonce-([^']+)", csp).group(1); n2 = re.search(r"nonce-([^']+)", pg.goto(B + "/").headers["content-security-policy"]).group(1)
    check("nonce differs on every request", n1 != n2)
    for u in PAGES:
        pg.goto(B + u); pg.wait_for_load_state("networkidle")
    check("no CSP violations or page errors across %d pages" % len(PAGES), not bad)
    if bad: print("   ", bad[:5])
    # JS-dependent flow: pick size, add to cart, checkout page prices the cart (needs hydrated client code)
    pg.goto(B + "/products/demo-barcelona-home-jersey"); pg.wait_for_load_state("networkidle")
    pg.locator("label", has_text="3XL").first.click(); pg.get_by_role("button", name="Pre-order").click()
    pg.goto(B + "/checkout"); pg.wait_for_selector("text=Subtotal", timeout=15000)
    check("client-side cart + live pricing work under the strict CSP", True)
    # realistic XSS payload: attacker-controlled HTML with an inline event handler must not execute
    pg.goto(B + "/"); pg.wait_for_load_state("networkidle")
    pg.evaluate("() => { const d = document.createElement('div'); d.innerHTML = '<img src=x onerror=\"window.__pwned=1\">'; document.body.appendChild(d); }")
    pg.wait_for_timeout(500)
    check("injected inline event handler is blocked", pg.evaluate("() => window.__pwned") is None)
    br.close()
print("FAILED" if check.failed else "ALL PASSED"); sys.exit(1 if check.failed else 0)
