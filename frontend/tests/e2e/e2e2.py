import re, sys, struct, zlib
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

B = "http://localhost:3077"
def check(label, cond):
    print(("PASS " if cond else "FAIL ") + label)
    if not cond: check.failed = True
check.failed = False

def png(path):
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    raw = b"".join(b"\x00" + bytes([200, 100, 20]) * 8 for _ in range(8))
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 8, 8, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))
png("/tmp/t.png")

def fill_customer(pg, **kw):
    pg.fill('input[name="name"]', "Test Buyer")
    pg.fill('input[name="email"]', kw.get("email", "buyer@example.com"))
    pg.fill('input[name="phone"]', "0771234567")
    if pg.locator('input[name="address"]').count():
        pg.fill('input[name="address"]', "1 Galle Road")
        pg.fill('input[name="city"]', "Colombo")

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(bypass_csp=True, viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))

    # ---- home
    pg.goto(B + "/")
    t = pg.inner_text("body")
    check("home has Caps band", "top it off" in t.lower())
    check("home sport cards include NHL and Caps", "NHL" in t and "Caps" in t)
    check("no NBA warm-ups anywhere", "warm-ups" not in t.lower())
    check("pre-order 2 to 3 weeks wording", "2 to 3 weeks" in t)
    check("whatsapp button", pg.locator('a[aria-label="Chat with us on WhatsApp"]').count() == 1)
    check("whatsapp number", "94775379088" in pg.locator('a[aria-label="Chat with us on WhatsApp"]').get_attribute("href"))

    # ---- football jersey customisation
    pg.goto(B + "/products/demo-barcelona-home-jersey")
    check("size chart button", pg.get_by_role("button", name="Size chart").count() == 1)
    pg.get_by_role("button", name="Size chart").click()
    check("size chart dialog table", pg.locator("dialog table").is_visible() and "chest" in pg.inner_text("dialog").lower())
    pg.get_by_role("button", name="Close size chart").click()
    check("customise block present", "Make it yours" in pg.content())
    pg.locator("label", has_text="M").first.click()
    pg.locator("label", has_text="Long sleeves").click()
    pg.get_by_label("Customisation (name and number)", exact=False).check()
    pg.fill('input[aria-label="Customisation wording"]', "MESSI 10")
    pg.get_by_role("button", name="Add patch 1").click()
    pg.fill('input[aria-label="Patch 1 description"]', "Champions League")
    pg.get_by_role("button", name="Add patch 2").click()
    pg.fill('input[aria-label="Patch 2 description"]', "La Liga")
    body = pg.inner_text("main")
    # 500 + 700 + 300 + 200 = 1700
    check("extras LKR 1,700 per shirt", "LKR 1,700" in body)
    check("unit price 6,250", "LKR 6,250" in body)
    pg.get_by_role("button", name="Add to cart").click()

    pg.goto(B + "/cart")
    pg.wait_for_selector("text=Order summary")
    c = pg.inner_text("main")
    check("cart shows options", "Long sleeves" in c and "MESSI 10" in c and "Patch 2: La Liga" in c)
    pg.wait_for_selector("text=Subtotal")
    check("cart subtotal 6,250", "LKR 6,250" in pg.inner_text("aside"))
    pg.get_by_role("link", name="Checkout").click()
    pg.wait_for_url("**/checkout")
    pg.wait_for_selector("text=Subtotal")
    s = pg.inner_text("aside")
    check("LK delivery 500 -> total 6,750", "LKR 6,750" in s and "LKR 500" in s)
    pg.locator("label", has_text="Store pickup").click()
    pg.wait_for_function("document.querySelector('aside').innerText.includes('Free')")
    s = pg.inner_text("aside")
    check("pickup free -> total 6,250", "Free" in s and "LKR 6,250" in s)
    check("address hidden for pickup", pg.locator('input[name="address"]').count() == 0)
    pg.select_option('select[autocomplete="country"]', "IN")
    pg.wait_for_function("document.querySelector('aside').innerText.includes('International postage')")
    s = pg.inner_text("aside")
    print(s.replace("\n", " | ")[:300])
    check("india postage shown", "International postage" in s)
    check("postal code required for abroad", pg.locator('input[name="postal"]').count() == 1)
    check("no plan choice abroad / ready", "Pre-order payment" not in s)
    # back to LK delivery and place a bank order with options
    pg.select_option('select[autocomplete="country"]', "LK")
    pg.locator("label", has_text="Delivery in Sri Lanka").click()
    fill_customer(pg)
    pg.locator("label", has_text="Bank transfer").click()
    pg.get_by_role("button", name="Place order").click()
    pg.wait_for_url(re.compile(r".*/track-order/SIQ-.*"))
    ref1 = re.search(r"SIQ-[A-Z0-9]{8}", pg.url).group(0)
    tt = pg.inner_text("main")
    check("track shows options + delivery", "MESSI 10" in tt and "Delivery in Sri Lanka" in tt and "LKR 6,750" in tt)
    print("order1", ref1)

    # ---- pre-order half payment, pickup, balance cash
    pg.goto(B + "/products/demo-nba-court-jersey")
    check("nba jersey has no customise block", "Make it yours" not in pg.content())
    pg.goto(B + "/products/demo-barcelona-home-jersey")
    pg.locator("label", has_text="3XL").click()
    pg.get_by_role("button", name="Pre-order").click()
    pg.goto(B + "/checkout")
    pg.wait_for_selector("text=Pre-order payment")
    pg.locator("label", has_text="Store pickup").click()
    check("full is recommended", "recommended" in pg.inner_text("aside").lower())
    pg.locator("label", has_text="Pay a deposit now").click()
    pg.wait_for_function("document.querySelector('aside').innerText.toLowerCase().includes('how will you pay')")
    pg.locator("label", has_text="Cash when you collect").click()
    s = pg.inner_text("aside")
    check("half: pay now 2,275, balance cash 2,275", "LKR 2,275" in s and s.count("LKR 2,275") >= 2)
    fill_customer(pg, email="half@example.com")
    pg.locator("label", has_text="Bank transfer").first.click()
    pg.get_by_role("button", name="Place order").click()
    pg.wait_for_url(re.compile(r".*/track-order/SIQ-.*"))
    ref2 = re.search(r"SIQ-[A-Z0-9]{8}", pg.url).group(0)
    print("order2", ref2)
    check("track half plan text", "balance in cash at pickup" in pg.inner_text("main"))
    pg.fill('input[name="bankRef"]', "BANKREF-0001") if pg.locator('input[name="bankRef"]').count() else None
    open("/tmp/refs.txt", "w").write(ref1 + "\n" + ref2)
    ctx.storage_state(path="/tmp/state_customer.json")
    check("no page errors (customer)", not errs)
    if errs: print(errs)
    br.close()
sys.exit(1 if check.failed else 0)
