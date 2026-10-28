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
ref1, ref2 = open("/tmp/refs.txt").read().split()

with sync_playwright() as p:
    br = p.chromium.launch()
    errs = []
    # ---- customer submits bank proof for order2
    cust = br.new_context(bypass_csp=True, viewport={"width": 1280, "height": 900}); cp = cust.new_page()
    cp.on("pageerror", lambda e: errs.append(str(e)))
    cp.goto(f"{B}/track-order/{ref2}?email=half@example.com")
    cp.fill('input[name="bank_ref"]', "BANKREF-0001")
    cp.get_by_role("button", name=re.compile("submit", re.I)).click()
    cp.wait_for_selector("text=waiting for verification", timeout=8000)

    # ---- admin
    ctx = br.new_context(bypass_csp=True, viewport={"width": 1280, "height": 900}); pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(B + "/admin/login"); pg.fill('input[name=password]', "test-password-12345"); pg.fill('input[name=code]', totp_code()); pg.get_by_role("button", name="Log in").click()
    pg.wait_for_url("**/admin")
    t = pg.inner_text("main").lower()
    check("dashboard stats", "money received" in t and "owed to suppliers" in t and "pre-orders not in a batch" in t)
    for path, word in [("/admin/batches", "pre-order batches"), ("/admin/suppliers", "suppliers"), ("/admin/expenses", "expenses and profit"), ("/admin/customers", "customers"),
                       ("/admin/payments", "ledger"), ("/admin/categories", "categories"), ("/admin/shipping", "shipping rates"), ("/admin/settings", "site settings"),
                       ("/admin/reviews", "reviews"), ("/admin/exchanges", "exchanges and store credit"), ("/admin/activity", "activity log"), ("/admin/import", "bulk product import")]:
        pg.goto(B + path)
        check(f"admin page {path}", word in pg.inner_text("main").lower())

    # confirm bank payment for order2
    pg.goto(f"{B}/admin/orders/{ref2}")
    pg.get_by_role("button", name=re.compile("confirm", re.I)).click()
    pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(1500)
    pg.goto(f"{B}/admin/orders/{ref2}")
    body = pg.inner_text("main")
    check("order2 deposit credited", "success" in body)
    # stage: Collected must fail before cash
    pg.goto(f"{B}/admin/orders/{ref2}")
    stage_opts = pg.locator('select[name="stage"] option').all_inner_texts()
    check("pickup stages", "Ready for Pickup" in stage_opts and "Collected" in stage_opts and "Out for Delivery" not in stage_opts)
    pg.select_option('select[name="stage"]', "Collected"); pg.get_by_role("button", name="Update stage").click()
    pg.wait_for_selector("text=balance is still unpaid")
    check("collected blocked until cash recorded", True)
    pg.get_by_role("button", name="Record cash").click()
    pg.wait_for_selector("text=Cash recorded")
    pg.select_option('select[name="stage"]', "Collected"); pg.get_by_role("button", name="Update stage").click()
    pg.wait_for_selector("text=Stage updated")
    check("collected after cash", "Collected" in pg.inner_text("main"))

    # ---- supplier + batch + assign + advance (use order1: confirm its bank payment first)
    pg.goto(B + "/admin/suppliers")
    pg.fill('form input[name="name"] >> nth=-1', "Dealer One"); pg.locator('form:has(input[name="id"][value="0"]) button').click()
    pg.wait_for_selector("text=Supplier saved")
    pg.goto(B + "/admin/batches")
    pg.fill('input[name="name"]', "NBA drop 1"); pg.fill('input[name="payable"]', "50000")
    pg.select_option('select[name="dealer_id"]', label="Dealer One")
    pg.get_by_role("button", name="Create batch").click()
    pg.wait_for_url(re.compile(r".*/admin/batches/\d+"))
    batch_url = pg.url
    check("batch created", "nba drop 1" in pg.inner_text("h1").lower())
    pg.fill('input[name="amount"]', "20000"); pg.get_by_role("button", name="Record payment").click()
    pg.wait_for_selector("text=Supplier payment recorded")
    check("supplier paid 20,000", "20,000" in pg.inner_text("main"))
    # expense
    pg.goto(B + "/admin/expenses")
    pg.fill('input[name="amount"]', "1500"); pg.fill('input[name="description"]', "Packaging")
    pg.get_by_role("button", name="Add expense").click(); pg.wait_for_selector("text=Expense added")
    check("expense listed", "1,500" in pg.inner_text("main"))
    check("profit tile", "estimated profit" in pg.inner_text("main").lower())

    # ---- categories: rename + add subcategory + size chart
    pg.goto(B + "/admin/categories")
    pg.locator("summary", has_text="NBA").first.click()
    box = pg.locator('details:has(summary:has-text("NBA")) form:has(input[name="slug"][value="nba"])').first
    box.locator('input[name="name"]').fill("NBA Pro")
    box.locator('textarea[name="size_chart"]').fill("Size,Chest (cm)\nS,90\nM,96\n# test note")
    box.get_by_role("button", name="Save").click()
    pg.wait_for_selector("text=Category saved")
    pg.goto(B + "/")
    check("renamed category in site", "NBA Pro" in pg.inner_text("body"))
    pg.goto(B + "/products/demo-nba-court-jersey")
    pg.get_by_role("button", name="Size chart").click()
    check("subcategory chart wins over sport chart", "cut long and loose" in pg.inner_text("dialog"))
    pg.goto(B + "/admin/categories")
    pg.locator("summary", has_text="NBA Pro").first.click()
    pg.locator('details:has(summary:has-text("NBA Pro")) form:has(input[name="sport"][value="nba"]) input[name="name"]').fill("Hoodies")
    pg.locator('details:has(summary:has-text("NBA Pro")) form:has(input[name="sport"][value="nba"]) button').click()
    pg.wait_for_selector("text=Subcategory added")
    pg.goto(B + "/sports/nba")
    check("new subcategory chip", "hoodies" in pg.inner_text("main").lower())

    # ---- settings: address + map
    pg.goto(B + "/admin/settings")
    pg.fill('input[name="address"]', "No 1, Galle Road, Colombo 03")
    pg.fill('input[name="instagram"]', "@sportiq.lk")
    pg.set_input_files('input[name="photo_new"]', "/tmp/t.png")
    pg.get_by_role("button", name="Save settings").click(); pg.wait_for_selector("text=Settings saved")
    pg.goto(B + "/about")
    check("about has live map iframe", pg.locator('iframe[src*="google.com/maps"]').count() == 1)
    check("about has store photo", pg.locator('img[alt^="SPORTIQ store photo"]').count() == 1)
    check("about story", "banned" in pg.inner_text("main").lower())
    pg.goto(B + "/")
    check("footer address", "Galle Road" in pg.inner_text("footer"))

    # ---- review with photo
    pg.goto(B + "/reviews")
    check("empty reviews", "no reviews yet" in pg.inner_text("main").lower())
    cp.goto(B + "/reviews")
    cp.fill('input[name="name"]', "Nimal"); cp.fill('textarea[name="body"]', "Great quality jersey, fast delivery!")
    cp.set_input_files('input[type="file"]', "/tmp/t.png"); cp.wait_for_selector('img[alt="Attached"]')
    cp.get_by_role("button", name="Submit review").click(); cp.wait_for_selector("text=once our team approves")
    cp.goto(B + "/reviews"); check("review hidden until approved", "Great quality" not in cp.inner_text("main"))
    pg.goto(B + "/admin/reviews"); check("review in admin with photo", "Great quality" in pg.inner_text("main") and pg.locator('img[alt="Review photo"]').count() == 1)
    pg.get_by_role("button", name="Approve").click(); pg.wait_for_selector("text=Review published")
    cp.goto(B + "/reviews"); check("review visible after approval", "Great quality" in cp.inner_text("main") and cp.locator('img[alt^="Photo from"]').count() == 1)
    cp.goto(B + "/"); check("review on homepage", "Great quality" in cp.inner_text("body"))

    # ---- exchange request -> admin -> credit -> use
    cp.goto(B + "/returns")
    check("returns page rules", "exchanges only" in cp.inner_text("main").lower() and "0775379088" in cp.inner_text("main"))
    cp.fill('input[name="name"]', "Nimal"); cp.fill('input[name="contact"]', "0771112223"); cp.fill('input[name="reference"]', ref1)
    cp.fill('textarea[name="reason"]', "Size too small, need XL instead")
    cp.get_by_role("button", name="Send exchange request").click(); cp.wait_for_selector("text=Request sent")
    pg.goto(B + "/admin/exchanges"); check("exchange in admin", "Size too small" in pg.inner_text("main"))
    pg.fill('input[name="email"]', "buyer@example.com"); pg.fill('input[name="amount"]', "3000"); pg.fill('input[name="note"]', "exchange " + ref1)
    pg.get_by_role("button", name="Issue credit").click()
    pg.wait_for_selector("text=Store credit issued")
    code = re.search(r"SC-[A-Z0-9]{8}", pg.inner_text("main")).group(0)
    print("credit", code)
    open("/tmp/code.txt", "w").write(code)

    # ---- postage calculator + shipping page
    cp.goto(B + "/shipping")
    cp.select_option('select[aria-label="Country"]', "GB"); cp.get_by_role("button", name="Calculate").click()
    cp.wait_for_selector("text=postage ·")
    check("calculator", "LKR" in cp.inner_text("main") and "postage" in cp.inner_text("main"))

    # ---- caps
    cp.goto(B + "/caps")
    t = cp.inner_text("main").lower()
    check("caps page", "shop by style" in t and "shop by league" in t and "cap" in t)
    n_all = cp.locator("#grid article").count()
    cp.get_by_role("link", name=re.compile("snapback", re.I)).first.click()
    cp.wait_for_function("location.search.includes('style=snapback')")
    n_snap = cp.locator("#grid article").count()
    check(f"style filter ({n_all} -> {n_snap})", 0 < n_snap < n_all)
    cp.goto(B + "/caps?stock=ready&sort=low")
    prices = [int(x.replace(",", "")) for x in re.findall(r"LKR ([\d,]+)", cp.inner_text("#grid"))]
    check("sorted low to high", prices == sorted(prices) and len(prices) > 0)
    cp.goto(B + "/products/demo-nba-fitted-cap")
    check("cap one size", cp.locator('input[name="size"]').count() == 1 and "one size" in cp.inner_text("main").lower())
    check("cap no customise", "Make it yours" not in cp.content())
    cp.goto(B + "/sports/caps"); check("sports/caps redirects to /caps", cp.url.endswith("/caps"))
    check("no page errors", not errs)
    if errs: print(errs)
    br.close()
sys.exit(1 if check.failed else 0)
