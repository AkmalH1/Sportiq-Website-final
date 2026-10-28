import re, sys, hashlib, urllib.request, urllib.parse
from totp_helper import totp_code  # two-factor is mandatory on production servers
from playwright.sync_api import sync_playwright
# NETIDLE: pages stream, so wait for the network to settle after every navigation
from playwright.sync_api import Page as _P
_g = _P.goto
def _goto(self, *a, **k):
    r = _g(self, *a, **k)
    try: self.wait_for_load_state("networkidle", timeout=8000)
    except Exception: pass
    return r
_P.goto = _goto
B = "http://localhost:3078"
md5 = lambda s: hashlib.md5(s.encode()).hexdigest().upper()
def check(label, cond):
    print(("PASS " if cond else "FAIL ") + label)
    if not cond: check.failed = True
check.failed = False
def notify(order_id, amount, status, secret="testsecret", pid="PH123"):
    sig = md5("1200001" + order_id + amount + "LKR" + status + md5(secret))
    data = urllib.parse.urlencode({"merchant_id": "1200001", "order_id": order_id, "payment_id": pid, "payhere_amount": amount, "payhere_currency": "LKR", "status_code": status, "md5sig": sig}).encode()
    try: return urllib.request.urlopen(urllib.request.Request(B + "/api/payhere/notify", data=data)).status
    except urllib.error.HTTPError as e: return e.code

with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_context(bypass_csp=True).new_page()
    pg.goto(B + "/products/demo-barcelona-home-jersey"); pg.wait_for_load_state("networkidle")
    pg.locator("label", has_text="M").first.click(); pg.get_by_role("button", name="Add to cart").click()
    pg.goto(B + "/checkout"); pg.wait_for_selector("text=Subtotal")
    pg.select_option('select[autocomplete="country"]', "AU")
    pg.fill('input[name="name"]', "Late Payer"); pg.fill('input[name="email"]', "late@example.com"); pg.fill('input[name="phone"]', "0771234567")
    pg.fill('input[name="address"]', "1 George St"); pg.fill('input[name="city"]', "Sydney"); pg.fill('input[name="postal"]', "2000")
    pg.wait_for_timeout(1200)
    pg.get_by_role("button", name="Place order and pay").click()
    pg.wait_for_url(re.compile(r".*/pay/SIQ-.*")); ref = re.search(r"SIQ-[A-Z0-9]{8}", pg.url).group(0)
    check("no email in URL", "late%40" not in pg.url and "late@" not in pg.url and "email=t_" in pg.url)
    pg.wait_for_selector("text=Continue to PayHere")
    fields = {i.get_attribute("name"): i.get_attribute("value") for i in pg.locator('form[action*="payhere"] input[type=hidden]').all()}
    check("PayHere country is Australia", fields["country"] == "Australia")
    pg.goto(B + "/cart"); check("cart not cleared before payment", "Barcelona" in pg.inner_text("main"))
    oid = fields["order_id"]; amt = fields["amount"]
    ad = br.new_context(bypass_csp=True).new_page(); ad.goto(B + "/admin/login"); ad.fill('input[name=password]', "test-password-12345"); ad.fill('input[name=code]', totp_code()); ad.get_by_role("button", name="Log in").click(); ad.wait_for_url("**/admin")
    ad.goto(f"{B}/admin/orders/{ref}"); ad.get_by_role("button", name="Cancel unpaid order and release stock").click(); ad.wait_for_timeout(800)
    ad.goto(f"{B}/admin/orders/{ref}"); check("order cancelled", "Cancelled" in ad.inner_text("main"))
    check("late success callback accepted", notify(oid, amt, "2", pid="PH-LATE-1") == 200)
    ad.goto(f"{B}/admin/orders/{ref}"); t = ad.inner_text("main")
    check("still cancelled after late payment", "Cancelled" in t)
    check("late payment flagged for refund", "Late payment on cancelled order" in t)
    # wrong order key must not open the order
    pg.goto(f"{B}/track-order/{ref}?email=t_00000000000000000000000000000000"); check("bad key rejected", "find your order" in pg.inner_text("main").lower())
    # login lockout
    lp = br.new_context(bypass_csp=True).new_page(); msg = ""
    for i in range(10):
        lp.goto(B + "/admin/login"); lp.fill('input[name=password]', "bad" + str(i)); lp.get_by_role("button", name="Log in").click(); lp.wait_for_timeout(800)
        msg = lp.inner_text("main")
    check("admin login locks after repeated failures", "Too many attempts" in msg)
    br.close()
print("FAILED" if check.failed else "ALL PASSED")
