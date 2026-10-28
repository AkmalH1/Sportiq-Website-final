import re, sys
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
B = "http://localhost:3077"
def check(label, cond):
    print(("PASS " if cond else "FAIL ") + label)
    if not cond: check.failed = True
check.failed = False
code = open("/tmp/code.txt").read().strip()

def fill(pg, email):
    pg.fill('input[name="name"]', "Credit Buyer"); pg.fill('input[name="email"]', email); pg.fill('input[name="phone"]', "0771234567")
    if pg.locator('input[name="address"]').count():
        pg.fill('input[name="address"]', "1 Galle Road"); pg.fill('input[name="city"]', "Colombo")

with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    cust = br.new_context(bypass_csp=True, viewport={"width": 1280, "height": 900}); cp = cust.new_page(); cp.on("pageerror", lambda e: errs.append(str(e)))
    # pre-order 2x 3XL barcelona (9100 pre) + pickup, full pay, with credit 3000 (locked to buyer@example.com)
    cp.goto(B + "/products/demo-barcelona-home-jersey"); cp.wait_for_load_state("networkidle"); cp.locator("label", has_text="3XL").first.click(); cp.get_by_role("button", name="Pre-order").click()
    cp.goto(B + "/checkout"); cp.wait_for_selector("text=Subtotal")
    cp.locator("label", has_text="Store pickup").click()
    cp.fill('input[aria-label="Store credit code"]', "SC-BADCODE1"); cp.get_by_role("button", name="Apply").click()
    cp.wait_for_selector("text=not valid")
    check("bad credit code message", True)
    cp.fill('input[aria-label="Store credit code"]', code); cp.get_by_role("button", name="Apply").click()
    cp.wait_for_selector("text=Store credit applied")
    s = cp.inner_text("aside"); print(s.replace("\n", " | ")[:300])
    check("credit reduces pay now", "- LKR 3,000" in s and "LKR 1,550" in s)
    fill(cp, "other@example.com"); cp.locator("label", has_text="Bank transfer").click()
    cp.get_by_role("button", name="Place order").click()
    cp.wait_for_selector("text=different email")
    check("credit locked to its email", True)
    cp.fill('input[name="email"]', "buyer@example.com")
    cp.get_by_role("button", name="Place order").click()
    cp.wait_for_url(re.compile(r".*/track-order/SIQ-.*"))
    ref = re.search(r"SIQ-[A-Z0-9]{8}", cp.url).group(0); print("order", ref)
    t = cp.inner_text("main")
    check("track shows store credit payment + due 1,550", "Store credit" in t and "1,550" in t)

    # international pre-order: full payment only
    cp.goto(B + "/products/demo-barcelona-home-jersey"); cp.wait_for_load_state("networkidle"); cp.locator("label", has_text="3XL").first.click(); cp.get_by_role("button", name="Pre-order").click()
    cp.goto(B + "/checkout"); cp.wait_for_selector("text=Subtotal")
    cp.select_option('select[autocomplete="country"]', "AU"); cp.wait_for_selector("text=International postage")
    check("abroad pre-order: full payment note", "paid in full" in cp.inner_text("aside").lower() and "Pay a deposit now" not in cp.inner_text("aside"))
    fill(cp, "au@example.com"); cp.fill('input[name="postal"]', "2000"); cp.locator("label", has_text="Bank transfer").click()
    cp.get_by_role("button", name="Place order").click(); cp.wait_for_url(re.compile(r".*/track-order/SIQ-.*"))
    ref_au = re.search(r"SIQ-[A-Z0-9]{8}", cp.url).group(0); print("au order", ref_au)
    cp.fill('input[name="bank_ref"]', "AUREF-0002"); cp.get_by_role("button", name=re.compile("submit", re.I)).click(); cp.wait_for_selector("text=waiting for verification")

    # admin: confirm au payment, batch assign, advance
    ctx = br.new_context(bypass_csp=True, viewport={"width": 1280, "height": 900}); pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(B + "/admin/login"); pg.fill('input[name=password]', "test-password-12345"); pg.fill('input[name=code]', totp_code()); pg.get_by_role("button", name="Log in").click(); pg.wait_for_url("**/admin")
    pg.goto(f"{B}/admin/orders/{ref_au}"); pg.get_by_role("button", name=re.compile("confirm", re.I)).click(); pg.wait_for_timeout(800)
    pg.goto(f"{B}/admin/orders/{ref_au}")
    check("au stages: posted", "Posted" in pg.locator('select[name="stage"]').inner_text())
    # the credit order (pickup, not fully paid) -> advance should skip it
    pg.goto(B + "/admin")
    pg.locator(f'input[value="{ref_au}"]').check(); pg.locator(f'input[value="{ref}"]').check()
    pg.select_option('select[name="batch_id"]', index=1); pg.get_by_role("button", name="Put in batch").click()
    pg.wait_for_selector("text=pre-order(s) updated")
    pg.goto(B + "/admin/batches"); pg.get_by_role("link", name="NBA drop 1").click()
    pg.select_option('select[name="stage"]', "Supplier Paid"); pg.get_by_role("button", name="Update all orders in this batch").click()
    pg.wait_for_selector("text=order(s) moved")
    msg = pg.inner_text("main"); print(msg[:300].replace("\n", " | "))
    check("batch advance moves paid, skips unpaid", "1 order(s) moved" in msg and ref in msg)
    # customer sees stage
    cp.goto(f"{B}/track-order/{ref_au}?email=au@example.com")
    check("customer sees Supplier Paid", "Supplier Paid" in cp.inner_text("main"))
    # whatsapp template link
    pg.goto(f"{B}/admin/orders/{ref_au}")
    href = pg.get_by_role("link", name=re.compile("WhatsApp customer")).get_attribute("href")
    check("whatsapp template link", "wa.me/94771234567" in href and "Supplier%20Paid" in href or "Supplier+Paid" in href or "paid%20the%20supplier" in href)
    # exports
    r = pg.request.get(B + "/admin/export/orders"); check("orders csv", r.ok and "reference" in r.text())
    r = pg.request.get(B + "/admin/export/customers"); check("customers csv", r.ok)
    r = pg.request.get(B + "/admin/export/orders", headers={}) ; 
    anon = br.new_context().request.get(B + "/admin/export/orders"); check("export needs login", anon.status == 401)
    # bulk csv import with new columns
    open("/tmp/imp.csv", "w").write("slug,name,sport,type,version,price_lkr,description,status,preorder_enabled,preorder_eta,image_url,sku_prefix,subcategory,league,customizable,weight_g,stock_S,stock_M,stock_L,stock_XL,stock_2XL,stock_3XL,stock_ONE\n"
        "imp-shirt,Import Rugby Shirt,rugby,Shirt,Fan,5000,d,published,yes,,,IMP-RGB,Shirts,,no,450,1,1,1,1,1,1,0\n"
        "imp-cap,Import Cap,caps,Cap,Std,2500,d,published,yes,,,IMP-CAP,Snapback,nba,no,200,9,9,9,9,9,9,7\n")
    pg.goto(B + "/admin/import"); pg.set_input_files('input[type="file"] >> nth=0', "/tmp/imp.csv"); pg.get_by_role("button", name=re.compile("import", re.I)).first.click()
    pg.wait_for_selector("text=/[0-9]+ created/", timeout=15000)
    cp.goto(B + "/products/imp-cap"); ok_cap = False
    for _ in range(12):
        cp.wait_for_timeout(1000)
        if cp.locator('input[name="size"]').count() == 1 and "7 in stock" in cp.inner_text("main").lower(): ok_cap = True; break
    check("imported cap is one size 7 in stock", ok_cap)
    if not ok_cap: print("DBG", cp.url, cp.locator('input[name="size"]').count(), cp.inner_text("main")[:300].replace("\n"," | "))
    cp.goto(B + "/products/imp-shirt"); cp.wait_for_load_state("networkidle"); cp.wait_for_timeout(1200); check("imported shirt six sizes", cp.locator('input[name="size"]').count() == 6)
    # bulk image upload (filename = slug)
    import shutil; shutil.copy("/tmp/t.png", "/tmp/imp-cap.png")
    pg.goto(B + "/admin/import"); pg.set_input_files('input[name="images"]', "/tmp/imp-cap.png"); pg.get_by_role("button", name="Upload photos").click()
    pg.wait_for_selector("text=main image")
    check("bulk image attached", "1 main image" in pg.inner_text("main"))
    check("no page errors", not errs)
    if errs: print(errs)
    br.close()
sys.exit(1 if check.failed else 0)
