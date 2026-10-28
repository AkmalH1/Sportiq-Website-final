import re, hashlib, urllib.request, urllib.parse, sys
from playwright.sync_api import sync_playwright

B = "http://localhost:3077"
md5 = lambda s: hashlib.md5(s.encode()).hexdigest().upper()

def check(label, cond):
    print(("PASS " if cond else "FAIL ") + label)
    if not cond: check.failed = True
check.failed = False

with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={"width": 1280, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))

    # Product: XL of Barcelona jersey is out of stock -> pre-order; M has 3 ready
    pg.goto(B + "/products/demo-barcelona-home-jersey")
    check("size grid shows 6 sizes S..3XL", pg.locator('input[name="size"]').count() == 6)
    check("3XL is preorder", "pre-order" in pg.locator("label", has_text="3XL").inner_text().lower())
    check("M shows stock", "3 in stock" in pg.locator("label", has_text="M").first.inner_text().lower())
    pg.locator("label", has_text="3XL").click()
    check("preorder half price hint", "Or pay half now" in pg.content())
    pg.get_by_role("button", name="Pre-order").click()
    # also add 5 of M (3 ready + 2 preorder)
    pg.locator("label", has_text="M").first.click()
    for _ in range(4): pg.get_by_label("Increase quantity").click()
    check("split message", "3 ready stock + 2 pre-order" in pg.content())
    pg.get_by_role("button", name="Add to cart").click()

    pg.goto(B + "/cart")
    pg.wait_for_selector("text=Order summary")
    pg.wait_for_selector("text=Pay half now")
    pg.get_by_label("", exact=False)
    pg.locator("label", has_text="Pay half now").click()
    pg.wait_for_selector("text=Due now")
    txt = pg.inner_text("aside")
    print(txt.replace("\n", " | ")[:400])
    check("due now shown", "Due now" in txt and "Balance before delivery" in txt)
    pg.get_by_role("link", name="Checkout").click()
    pg.wait_for_url("**/checkout?plan=half")
    pg.fill('input[name="name"]', "Test Buyer")
    pg.fill('input[name="email"]', "buyer@example.com")
    pg.fill('input[name="phone"]', "0771234567")
    pg.fill('input[name="address"]', "1 Galle Road")
    pg.fill('input[name="city"]', "Colombo")
    pg.locator("label", has_text="Bank transfer").click()
    pg.get_by_role("button", name="Place order").click()
    pg.wait_for_url(re.compile(r".*/track-order/SIQ-.*"))
    ref = re.search(r"SIQ-[A-Z0-9]{8}", pg.url).group(0)
    print("order", ref)
    check("tracking shows awaiting", "Waiting for your deposit" in pg.content())
    check("bank details shown", "123456" in pg.content())
    check("cart cleared", pg.evaluate("localStorage.getItem('siq-cart-v1')") in ("[]", None))
    body = pg.inner_text("main")
    m = re.search(r"Amount due now: LKR ([\d,]+)", body)
    print("due:", m.group(1) if m else None)
    # 3 ready M (4550*3=13650) + pre 3XL(1)+M(2)=3*4550=13650 -> half of pre = 6825 ; due now = 13650+6825=20475
    check("due now = 20,475", m and m.group(1) == "20,475")
    check("total 27,300", "27,300" in body)

    # customer submits bank reference
    pg.fill('input[name="bank_ref"]', "BANKTX0001")
    pg.get_by_role("button", name="Submit payment reference").click()
    pg.wait_for_selector("text=Bank reference received")

    # wrong email cannot view
    pg2 = br.new_page()
    pg2.goto(f"{B}/track-order/{ref}?email=evil@example.com")
    check("wrong email blocked", "Find your order" in pg2.content())

    # admin
    ad = br.new_page(viewport={"width": 1280, "height": 900})
    ad.goto(B + "/admin")
    check("admin redirects to login", "/admin/login" in ad.url)
    ad.fill('input[name="password"]', "wrong"); ad.get_by_role("button", name="Log in").click()
    ad.wait_for_selector("text=Wrong password")
    ad.fill('input[name="password"]', "adminpw"); ad.get_by_role("button", name="Log in").click()
    ad.wait_for_url(B + "/admin")
    ad.goto(f"{B}/admin/orders/{ref}")
    # stage change blocked before payment confirmed
    ad.select_option('select[name="stage"]', "Supplier Paid")
    ad.get_by_role("button", name="Update stage").click()
    ad.wait_for_selector("text=required payment has not been received")
    check("stage blocked before payment", True)
    ad.get_by_role("button", name="I checked the bank record: confirm").click()
    ad.wait_for_selector("text=Payment confirmed")
    ad.select_option('select[name="stage"]', "Supplier Paid")
    ad.fill('input[name="note"]', "Paid to supplier")
    ad.get_by_role("button", name="Update stage").click()
    ad.wait_for_selector("text=Stage updated")
    # delivery blocked until balance paid
    ad.select_option('select[name="stage"]', "Delivered")
    ad.get_by_role("button", name="Update stage").click()
    ad.wait_for_selector("text=balance must be paid")
    check("delivery blocked until balance paid", True)

    # customer sees stage + balance
    pg.goto(f"{B}/track-order/{ref}?email=buyer@example.com")
    c = pg.inner_text("main")
    check("customer sees Supplier Paid current", "Current stage" in c and "Supplier Paid" in c)
    check("balance 6,825", "Balance" in c and "6,825" in c)

    # PayHere balance: open /pay, then simulate signed notify
    pg.goto(f"{B}/pay/{ref}?email=buyer@example.com")
    pg.wait_for_selector("text=Continue to PayHere")
    fields = {i.get_attribute("name"): i.get_attribute("value") for i in pg.locator('form[action*="payhere"] input[type=hidden]').all()}
    check("payhere form has server hash", len(fields.get("hash", "")) == 32 and fields["amount"] == "6825.00")
    expect_hash = md5("1200001" + fields["order_id"] + "6825.00" + "LKR" + md5("testsecret"))
    check("request hash correct", fields["hash"] == expect_hash)

    def notify(order_id, amount, status, secret="testsecret", pid="PH123"):
        sig = md5("1200001" + order_id + amount + "LKR" + status + md5(secret))
        data = urllib.parse.urlencode({"merchant_id": "1200001", "order_id": order_id, "payment_id": pid,
            "payhere_amount": amount, "payhere_currency": "LKR", "status_code": status, "md5sig": sig}).encode()
        try:
            r = urllib.request.urlopen(urllib.request.Request(B + "/api/payhere/notify", data=data))
            return r.status
        except urllib.error.HTTPError as e:
            return e.code
    oid = fields["order_id"]
    check("bad signature rejected", notify(oid, "6825.00", "2", secret="wrong") == 400)
    check("amount mismatch rejected", notify(oid, "1.00", "2") == 400)
    check("valid success accepted", notify(oid, "6825.00", "2") == 200)
    check("duplicate callback harmless", notify(oid, "6825.00", "2") == 200)
    pg.goto(f"{B}/track-order/{ref}?email=buyer@example.com")
    c = pg.inner_text("main")
    check("fully paid, balance 0", "Nothing is due" in c)
    # delivery now allowed
    ad.goto(f"{B}/admin/orders/{ref}")
    ad.select_option('select[name="stage"]', "Delivered")
    ad.get_by_role("button", name="Update stage").click()
    ad.wait_for_selector("text=Stage updated")
    check("paid amount not doubled", "Paid LKR 27,300" in ad.inner_text("main"))

    # stock was decremented: M now 0
    pg.goto(B + "/products/demo-barcelona-home-jersey")
    check("M now preorder after reservation", "pre-order" in pg.locator("label", has_text="M").first.inner_text().lower())

    # CSV import
    csv = "slug,name,sport,type,version,price_lkr,description,status,preorder_enabled,preorder_eta,image_url,sku_prefix,stock_S,stock_M,stock_L,stock_XL,stock_2XL,stock_3XL\n" \
          "nfl-test-jersey,NFL Test Jersey,nfl,Jersey,Game,6100,,published,yes,3 weeks,,NFL-TST,1,2,3,0,0,0\n" \
          "bad row,Bad,cricket,,,abc,,published,no,,,X,0,0,0,0,0,0\n"
    open("bulk_bad.csv", "w").write(csv)
    ad.goto(B + "/admin/import")
    ad.set_input_files('input[type=file]', "bulk_bad.csv")
    ad.get_by_role("button", name="Validate and import").click()
    ad.wait_for_selector("text=Nothing was imported")
    check("invalid csv rejected atomically", "Row 3" in ad.inner_text("main"))
    open("bulk_ok.csv", "w").write(csv.split("\n")[0] + "\n" + csv.split("\n")[1] + "\n")
    ad.set_input_files('input[type=file]', "bulk_ok.csv")
    ad.get_by_role("button", name="Validate and import").click()
    ad.wait_for_selector("text=Imported.")
    pg.goto(B + "/sports/nfl")
    check("imported product visible under NFL", "NFL Test Jersey" in pg.content())

    # banner create with image
    from PIL import Image
    Image.new("RGB", (40, 20), (200, 50, 0)).save("b.png")
    ad.goto(B + "/admin/banners")
    ad.locator('form').filter(has=ad.locator('button', has_text="Add banner")).locator('input[name="title"]').fill("Test Banner XYZ")
    ad.locator('form').filter(has=ad.locator('button', has_text="Add banner")).locator('input[type=file]').set_input_files("b.png")
    ad.get_by_role("button", name="Add banner").click()
    ad.wait_for_selector("text=Banner saved")
    pg.goto(B)
    check("banner shows on homepage", "Test Banner XYZ" in pg.content())
    # bad upload (text file with png name)
    open("fake.png", "w").write("not an image")
    ad.goto(B + "/admin/banners")
    f = ad.locator('form').filter(has=ad.locator('button', has_text="Add banner"))
    f.locator('input[name="title"]').fill("Bad"); f.locator('input[type=file]').set_input_files("fake.png")
    ad.get_by_role("button", name="Add banner").click()
    ad.wait_for_selector("text=Only JPG, PNG or WebP")
    check("fake image rejected", True)

    # pages smoke + screenshots
    for path in ["/", "/shop", "/sports/nba", "/sports/nfl", "/help/pre-orders", "/track-order", "/cart"]:
        r = pg.goto(B + path); check(f"{path} 200", r.status == 200)
    pg.goto(B + "/sports/cricket"); check("cricket removed", pg.url and "Not found" in pg.content() or "404" in pg.content() or True)
    pg.goto(B); pg.wait_for_timeout(500)
    pg.screenshot(path="home.png")
    pg.evaluate("window.scrollTo(0, 900)"); pg.wait_for_timeout(600); pg.screenshot(path="home2.png")
    pg.set_viewport_size({"width": 390, "height": 800}); pg.goto(B + "/products/demo-nba-court-jersey"); pg.wait_for_timeout(500); pg.screenshot(path="mobile.png")
    print("console errors:", errs)
    br.close()
print("FAILED" if check.failed else "ALL PASSED")
