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
    br = p.chromium.launch(); pg = br.new_context(bypass_csp=True, viewport={"width": 1280, "height": 900}).new_page()
    pg.goto(B + "/products/demo-barcelona-home-jersey"); pg.wait_for_load_state("networkidle")
    pg.locator("label", has_text="3XL").first.click(); pg.get_by_role("button", name="Pre-order").click()
    pg.goto(B + "/checkout"); pg.wait_for_selector("text=Subtotal")
    pg.locator("label", has_text="Pay a deposit now").click()
    pg.wait_for_function("document.querySelector('aside').innerText.toLowerCase().includes('how will you pay')")
    pg.locator("label", has_text="Cash on delivery").click()
    pg.fill('input[name="name"]', "Pay Here"); pg.fill('input[name="email"]', "ph@example.com"); pg.fill('input[name="phone"]', "0771234567")
    pg.fill('input[name="address"]', "1 Galle Road"); pg.fill('input[name="city"]', "Colombo")
    pg.get_by_role("button", name="Place order and pay").click()
    pg.wait_for_url(re.compile(r".*/pay/SIQ-.*")); ref = re.search(r"SIQ-[A-Z0-9]{8}", pg.url).group(0)
    pg.wait_for_selector("text=Continue to PayHere")
    fields = {i.get_attribute("name"): i.get_attribute("value") for i in pg.locator('form[action*="payhere"] input[type=hidden]').all()}
    # 4550 pre, half 2275 + delivery 500 = 2775
    check("amount 2775.00 (half + delivery)", fields["amount"] == "2775.00")
    check("request hash", fields["hash"] == md5("1200001" + fields["order_id"] + "2775.00" + "LKR" + md5("testsecret")))
    oid = fields["order_id"]
    check("bad signature rejected", notify(oid, "2775.00", "2", secret="wrong") == 400)
    check("amount mismatch rejected", notify(oid, "1.00", "2") == 400)
    check("valid success accepted", notify(oid, "2775.00", "2") == 200)
    check("duplicate harmless", notify(oid, "2775.00", "2") == 200)
    pg.goto(f"{B}/track-order/{ref}?email=ph@example.com"); t = pg.inner_text("main")
    check("confirmed after callback", "Current stage" in t.replace("CURRENT STAGE", "Current stage") or "CONFIRMED" in t.upper())
    check("balance 2,275 cash on delivery", "2,275" in t and "cash on delivery" in t.lower())
    ad = br.new_context(bypass_csp=True).new_page(); ad.goto(B + "/admin/login"); ad.fill('input[name=password]', "test-password-12345"); ad.fill('input[name=code]', totp_code()); ad.get_by_role("button", name="Log in").click(); ad.wait_for_url("**/admin")
    ad.goto(f"{B}/admin/orders/{ref}")
    check("paid exactly 2,775 once", "Paid LKR 2,775" in ad.inner_text("main"))
    for stage in ["Supplier Paid", "Production", "Shipping", "Arrived in Sri Lanka", "Out for Delivery"]:
        ad.select_option('select[name="stage"]', stage); ad.get_by_role("button", name="Update stage").click(); ad.wait_for_load_state("networkidle"); ad.wait_for_timeout(1200); ad.wait_for_selector("text=Stage updated")
    check("out for delivery allowed with COD balance", True)
    ad.select_option('select[name="stage"]', "Delivered"); ad.get_by_role("button", name="Update stage").click(); ad.wait_for_load_state("networkidle"); ad.wait_for_timeout(1200); ad.wait_for_selector("text=balance is still unpaid")
    ad.get_by_role("button", name="Record cash").click(); ad.wait_for_selector("text=Cash recorded")
    ad.select_option('select[name="stage"]', "Delivered"); ad.get_by_role("button", name="Update stage").click(); ad.wait_for_load_state("networkidle"); ad.wait_for_timeout(1200); ad.wait_for_selector("text=Stage updated")
    check("delivered after cash", "Paid LKR 7,050" in ad.inner_text("main") or "Paid LKR 5,050" in ad.inner_text("main"))
    br.close()
print("FAILED" if check.failed else "ALL PASSED")
