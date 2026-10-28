# Payment hardening tests. Fresh DB on port 3078 with PAYHERE_MERCHANT_ID=1200001 PAYHERE_MERCHANT_SECRET=testsecret SEED_DEMO_DATA=true
from totp_helper import totp_code  # two-factor is mandatory on production servers
import re, sys, hashlib, subprocess, urllib.request, urllib.parse
from playwright.sync_api import sync_playwright
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
def sql(q): return subprocess.run(["mysql","-uroot","-S","/tmp/mysql.sock","sportiq_t2","-N","-e",q],capture_output=True,text=True).stdout.strip()
def check(l, c):
    print(("PASS " if c else "FAIL ") + l)
    if not c: check.failed = True
check.failed = False
def notify(order_id, amount, status, pid, secret="testsecret"):
    sig = md5("1200001" + order_id + amount + "LKR" + status + md5(secret))
    data = urllib.parse.urlencode({"merchant_id": "1200001", "order_id": order_id, "payment_id": pid, "payhere_amount": amount, "payhere_currency": "LKR", "status_code": status, "md5sig": sig}).encode()
    try: return urllib.request.urlopen(urllib.request.Request(B + "/api/payhere/notify", data=data)).status
    except urllib.error.HTTPError as e: return e.code
urllib.request.urlopen(B + "/").read()

def place(br, slug, size, kind, method="bank", plan=None, balance=None, email="x@example.com", double=False):
    """kind = 'Add to cart' or 'Pre-order'. Returns (page, reference)."""
    pg = br.new_context(bypass_csp=True).new_page()
    pg.goto(B + "/products/" + slug)
    pg.locator("label", has_text=size).first.click(); pg.get_by_role("button", name=kind).click()
    pg.goto(B + "/checkout"); pg.wait_for_selector("text=Subtotal")
    if plan == "half":
        pg.locator("label", has_text="Pay a deposit now").click()
        pg.wait_for_function("document.querySelector('aside').innerText.toLowerCase().includes('how will you pay')")
        pg.locator("label", has_text=balance).click()
    pg.fill('input[name="name"]', "Test Buyer"); pg.fill('input[name="email"]', email); pg.fill('input[name="phone"]', "0771234567")
    pg.fill('input[name="address"]', "1 Galle Road"); pg.fill('input[name="city"]', "Colombo")
    pg.locator("label", has_text="Bank transfer").first.click() if method == "bank" else None
    pg.wait_for_timeout(800)
    btn = pg.get_by_role("button", name=re.compile("Place order", re.I))
    if double: btn.dblclick()
    else: btn.click()
    pg.wait_for_url(re.compile(r".*/(track-order|pay)/SIQ-.*"), timeout=20000); pg.wait_for_timeout(1500)
    return pg, re.search(r"SIQ-[A-Z0-9]{8}", pg.url).group(0)

with sync_playwright() as p:
    br = p.chromium.launch()
    ad = br.new_context(bypass_csp=True).new_page()
    ad.goto(B + "/admin/login"); ad.fill('input[name=staff_name]', "Nimal Perera"); ad.fill('input[name=password]', "test-password-12345"); ad.fill('input[name=code]', totp_code()); ad.get_by_role("button", name="Log in").click(); ad.wait_for_url("**/admin")

    # --- A. double-click checkout creates one order (idempotent)
    pg, ref = place(br, "demo-barcelona-home-jersey", "M", "Add to cart", email="dbl@example.com", double=True)
    check("double submit makes one order", sql("SELECT COUNT(*) FROM orders WHERE email='dbl@example.com'") == "1")

    # --- B. bank proof with private receipt, staff identity, purpose, verified amount
    pg, ref = place(br, "demo-barcelona-home-jersey", "L", "Add to cart", email="over@example.com")
    key = re.search(r"email=(t_[a-f0-9]+)", pg.url).group(1)
    pg.fill('input[name="bank_ref"]', "REF-OVER-0001"); pg.set_input_files('input[name="proof"]', "tests/e2e/receipt.png")
    pg.get_by_role("button", name="Submit payment reference").click(); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(1500)
    pf = sql(f"SELECT p.proof_file FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.reference='{ref}' AND p.provider='bank'")
    check("receipt stored privately", bool(re.fullmatch(r"[a-f0-9]{32}\.webp", pf)))
    check("receipt not paid by itself", sql(f"SELECT payment_status FROM orders WHERE reference='{ref}'") == "pending")
    # privacy: even when a customer arrives with their raw email in the link, the page they land on after submitting uses the signed key
    pg2, ref2 = place(br, "demo-barcelona-home-jersey", "L", "Add to cart", email="raw@example.com")
    pg2.goto(f"{B}/track-order/{ref2}?email=raw@example.com"); pg2.wait_for_load_state("networkidle")
    pg2.fill('input[name="bank_ref"]', "REF-RAW-0001"); pg2.get_by_role("button", name="Submit payment reference").click(); pg2.wait_for_load_state("networkidle"); pg2.wait_for_timeout(1500)
    check("after bank proof the URL carries the signed key, not the email", "@" not in pg2.url and "email=t_" in pg2.url)
    anon = br.new_context().request
    check("receipt: anonymous refused", anon.get(f"{B}/admin/proof/{pf}").status == 401)
    r = ad.request.get(f"{B}/admin/proof/{pf}")
    check("receipt: staff can open", r.status == 200 and r.headers.get("content-type") == "image/webp" and "no-store" in r.headers.get("cache-control", ""))
    check("receipt: not in public uploads", anon.get(f"{B}/uploads/{pf}").status == 404)
    check("receipt: bad name refused", ad.request.get(f"{B}/admin/proof/..%2F..%2Fpackage.json").status == 404)
    # a PayHere attempt for the same amount, opened by the customer too
    pg.goto(f"{B}/pay/{ref}?email={key}")
    fields = {i.get_attribute("name"): i.get_attribute("value") for i in pg.locator('form[action*="payhere"] input[type=hidden]').all()}
    oid, amt = fields["order_id"], fields["amount"]
    ad.goto(f"{B}/admin/orders/{ref}"); ad.get_by_role("button", name=re.compile("confirm", re.I)).click(); ad.wait_for_load_state("networkidle"); ad.wait_for_timeout(1500)
    row = sql(f"SELECT status, verified_by, verification_source, purpose, received_amount = amount FROM payments p WHERE provider='bank' AND order_id=(SELECT id FROM orders WHERE reference='{ref}')")
    check("bank confirm records staff name, source, purpose, amount", row.split("\t") == ["success", "Nimal Perera", "staff", "full", "1"])
    check("order paid after staff verification", sql(f"SELECT payment_status FROM orders WHERE reference='{ref}'") == "paid")

    # --- C. second payment for the same order is an overpayment: capped + flagged, never silently credited
    check("late/duplicate online payment accepted by gateway protocol", notify(oid, amt, "2", "PH-OVER-1") == 200)
    check("paid never exceeds total", sql(f"SELECT paid_amount = total FROM orders WHERE reference='{ref}'") == "1")
    check("overpayment item opened", sql(f"SELECT COUNT(*) FROM reconciliation_items WHERE kind='overpayment' AND status='open' AND order_id=(SELECT id FROM orders WHERE reference='{ref}')") == "1")
    check("repeat notification harmless", notify(oid, amt, "2", "PH-OVER-1") == 200 and sql("SELECT COUNT(*) FROM reconciliation_items WHERE kind='overpayment'") == "1")
    ad.goto(B + "/admin/payments"); body = ad.inner_text("main")
    bl = body.lower(); check("admin sees exception and dashboard", "overpayment" in bl and "needs your review" in bl and "ledger" in bl)
    form = ad.locator("form").filter(has=ad.locator('input[name="refund_ref"]')).first
    form.get_by_role("button", name="Mark resolved").click(); ad.wait_for_load_state("networkidle"); ad.wait_for_timeout(1200)
    check("refund needs a reference", sql("SELECT status FROM reconciliation_items WHERE kind='overpayment'") == "open")
    ad.goto(B + "/admin/payments")
    form = ad.locator("form").filter(has=ad.locator('input[name="refund_ref"]')).first
    form.locator('input[name="refund_ref"]').fill("BANK-REFUND-77"); form.get_by_role("button", name="Mark resolved").click(); ad.wait_for_load_state("networkidle"); ad.wait_for_timeout(1200)
    check("overpayment resolved by named staff", sql("SELECT CONCAT(status,'|',resolved_by,'|',refund_ref) FROM reconciliation_items WHERE kind='overpayment'") == "resolved|Nimal Perera|BANK-REFUND-77")
    check("original payments untouched", sql(f"SELECT COUNT(*) FROM payments WHERE order_id=(SELECT id FROM orders WHERE reference='{ref}') AND status='success'") == "2")

    # --- D. wrong amount is rejected, flagged once even if the gateway retries
    pg2, ref2 = place(br, "demo-nba-court-jersey", "M", "Add to cart", method="payhere", email="mm@example.com")
    if "/pay/" in pg2.url:
        f2 = {i.get_attribute("name"): i.get_attribute("value") for i in pg2.locator('form[action*="payhere"] input[type=hidden]').all()}
        check("wrong amount rejected", notify(f2["order_id"], "1.00", "2", "PH-MM-1") == 400)
        check("wrong amount rejected again", notify(f2["order_id"], "1.00", "2", "PH-MM-2") == 400)
        check("mismatch flagged once", sql("SELECT COUNT(*) FROM reconciliation_items WHERE kind='amount_mismatch'") == "1")
        check("mismatch not credited", sql(f"SELECT paid_amount FROM orders WHERE reference='{ref2}'") == "0")
    big = urllib.parse.urlencode({"x": "a" * 9000}).encode()
    try: code = urllib.request.urlopen(urllib.request.Request(B + "/api/payhere/notify", data=big)).status
    except urllib.error.HTTPError as e: code = e.code
    check("oversized notification refused", code == 413)
    check("event log has no signature", "md5sig" not in sql("SELECT GROUP_CONCAT(payload) FROM payment_events"))

    # --- E. another customer's order cannot be opened
    other = br.new_context(bypass_csp=True).new_page(); other.goto(f"{B}/track-order/{ref}?email=t_{'0'*32}")
    check("wrong key shows no order", ref not in other.inner_text("main") or "could not" in other.inner_text("main").lower())
    other.goto(f"{B}/pay/{ref}?email=other@example.com"); check("pay page needs the order key", "not found" in other.inner_text("main").lower())

    # --- F. half payment: deposit then balance by bank transfer
    pg3, ref3 = place(br, "demo-barcelona-home-jersey", "3XL", "Pre-order", method="payhere", plan="half", balance="Bank transfer (verified", email="half2@example.com")
    f3 = {i.get_attribute("name"): i.get_attribute("value") for i in pg3.locator('form[action*="payhere"] input[type=hidden]').all()}
    check("deposit attempt purpose", sql(f"SELECT purpose FROM payments WHERE provider_order_id='{f3['order_id']}'") == "deposit")
    check("balance method saved", sql(f"SELECT balance_method FROM orders WHERE reference='{ref3}'") == "bank")
    check("deposit notification accepted", notify(f3["order_id"], f3["amount"], "2", "PH-HALF-1") == 200)
    check("order partial", sql(f"SELECT payment_status FROM orders WHERE reference='{ref3}'") == "partial")
    k3 = re.search(r"email=(t_[a-f0-9]+)", pg3.url).group(1)
    pg3.goto(f"{B}/track-order/{ref3}?email={k3}"); t = pg3.inner_text("main").lower()
    check("tracking shows balance and condition", "balance due" in t and "you chose: bank transfer" in t)
    pg3.fill('input[name="bank_ref"]', "REF-BAL-0001"); pg3.get_by_role("button", name="Submit payment reference").click(); pg3.wait_for_load_state("networkidle"); pg3.wait_for_timeout(1500)
    check("balance payment purpose", sql(f"SELECT purpose FROM payments WHERE provider='bank' AND order_id=(SELECT id FROM orders WHERE reference='{ref3}')") == "balance")
    ad.goto(f"{B}/admin/orders/{ref3}"); ad.get_by_role("button", name=re.compile("confirm", re.I)).click(); ad.wait_for_load_state("networkidle"); ad.wait_for_timeout(1500)
    check("balance verified, order fully paid", sql(f"SELECT payment_status FROM orders WHERE reference='{ref3}'") == "paid")

    # --- G. staff policy: switching off every balance method removes the deposit option
    ad.goto(B + "/admin/settings")
    for cb in ad.locator('input[name="balance_methods"]').all(): cb.uncheck()
    ad.get_by_role("button", name=re.compile("save", re.I)).first.click(); ad.wait_for_load_state("networkidle"); ad.wait_for_timeout(1200)
    chk = br.new_context(bypass_csp=True).new_page(); chk.goto(B + "/products/demo-barcelona-home-jersey")
    chk.locator("label", has_text="3XL").first.click(); chk.get_by_role("button", name="Pre-order").click(); chk.goto(B + "/checkout"); chk.wait_for_selector("text=Pre-order payment"); chk.wait_for_timeout(800)
    check("no deposit option when no balance method allowed", "Pay a deposit now" not in chk.inner_text("aside") and "Pay in full" in chk.inner_text("aside"))
    ad.goto(B + "/admin/settings")
    for cb in ad.locator('input[name="balance_methods"]').all(): cb.check()
    ad.get_by_role("button", name=re.compile("save", re.I)).first.click(); ad.wait_for_load_state("networkidle"); ad.wait_for_timeout(1200)
    check("audit log names staff", "Nimal Perera" in sql("SELECT GROUP_CONCAT(actor) FROM audit_logs"))
    br.close()
print("FAILED" if check.failed else "ALL PASSED")
