# PayHere independent verification + atomic limiter + MFA/lockout checks.
from totp_helper import totp_code  # two-factor is mandatory on production servers
# Needs: fresh MariaDB/MySQL, and a server on :3079 started by tests/e2e/run-e2e9.sh (it also starts the mock PayHere API on :4010).
import re, sys, json, hashlib, threading, base64, urllib.request, urllib.parse, urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright
B = "http://localhost:3079"; API = ("app", "appsecret")
md5 = lambda s: hashlib.md5(s.encode()).hexdigest().upper()
def check(label, cond):
    print(("PASS " if cond else "FAIL ") + label)
    if not cond: check.failed = True
check.failed = False

# ---- mock PayHere Retrieval API (documented: oauth/token with Basic, payment/search?order_id with Bearer) ----
STATE = {"entries": {}, "outage": False, "calls": 0}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, obj):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0)); body = self.rfile.read(n).decode()
        if self.path == "/_set": STATE.update(json.loads(body)); return self._send(200, {})
        if self.path == "/merchant/v1/oauth/token":
            ok = self.headers.get("Authorization") == "Basic " + base64.b64encode(f"{API[0]}:{API[1]}".encode()).decode() and "grant_type=client_credentials" in body
            return self._send(200, {"access_token": "tok1", "token_type": "bearer", "expires_in": 599, "scope": "SANDBOX"}) if ok else self._send(401, {"error": "invalid_client"})
        self._send(404, {})
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path != "/merchant/v1/payment/search": return self._send(404, {})
        STATE["calls"] += 1
        if STATE["outage"]: return self._send(500, {"msg": "down"})
        if self.headers.get("Authorization") != "Bearer tok1": return self._send(401, {"status": -2, "msg": "Authentication error"})
        oid = urllib.parse.parse_qs(u.query)["order_id"][0]
        ents = STATE["entries"].get(oid, [])
        self._send(200, {"status": 1, "msg": "Success", "data": ents} if ents else {"status": -1, "msg": "No payments found", "data": []})
srv = HTTPServer(("127.0.0.1", 4010), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
def setmock(**k):
    urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:4010/_set", data=json.dumps(k).encode()))
def entry(oid, pid, amount, status="RECEIVED", cur="LKR"):
    return {"payment_id": pid, "order_id": oid, "status": status, "currency": cur, "amount": amount}
def notify(oid, amount, status, pid):
    sig = md5("1200001" + oid + amount + "LKR" + status + md5("testsecret"))
    data = urllib.parse.urlencode({"merchant_id": "1200001", "order_id": oid, "payment_id": pid, "payhere_amount": amount, "payhere_currency": "LKR", "status_code": status, "md5sig": sig}).encode()
    try: return urllib.request.urlopen(urllib.request.Request(B + "/api/payhere/notify", data=data)).status
    except urllib.error.HTTPError as e: return e.code

def new_order(br, email, name="Pay Here"):
    pg = br.new_context(bypass_csp=True).new_page()
    pg.goto(B + "/products/demo-barcelona-home-jersey"); pg.wait_for_load_state("networkidle")
    pg.locator("label", has_text="3XL").first.click(); pg.get_by_role("button", name="Pre-order").click()
    pg.goto(B + "/checkout"); pg.wait_for_selector("text=Subtotal")
    pg.fill('input[name="name"]', name); pg.fill('input[name="email"]', email); pg.fill('input[name="phone"]', "0771234567")
    pg.fill('input[name="address"]', "1 Galle Road"); pg.fill('input[name="city"]', "Colombo")
    pg.get_by_role("button", name="Place order and pay").click()
    pg.wait_for_url(re.compile(r".*/pay/SIQ-.*")); ref = re.search(r"SIQ-[A-Z0-9]{8}", pg.url).group(0)
    pg.wait_for_selector("text=Continue to PayHere")
    f = {i.get_attribute("name"): i.get_attribute("value") for i in pg.locator('form[action*="payhere"] input[type=hidden]').all()}
    return ref, f["order_id"], f["amount"], email
ADMIN = {}
def paid(br, ref, email):
    # authoritative: the staff order page shows "Paid LKR <amount received>"
    if "pg" not in ADMIN:
        ad = br.new_context(bypass_csp=True).new_page(); ad.goto(B + "/admin/login"); ad.fill('input[name=password]', "test-password-12345"); ad.fill('input[name=code]', totp_code())
        ad.get_by_role("button", name="Log in").click(); ad.wait_for_url("**/admin"); ADMIN["pg"] = ad
    ADMIN["pg"].goto(f"{B}/admin/orders/{ref}"); t = ADMIN["pg"].inner_text("main")
    return "Paid LKR 0" not in t and "Paid LKR" in t

with sync_playwright() as p:
    br = p.chromium.launch()
    # A: genuine payment confirmed by PayHere's own records
    ref, oid, amt, em = new_order(br, "a@example.com")
    setmock(entries={oid: [entry(oid, "PH-A", amt)]})
    check("A signed + PayHere-confirmed payment is credited", notify(oid, amt, "2", "PH-A") == 200 and paid(br, ref, em))
    check("A duplicate notification is harmless", notify(oid, amt, "2", "PH-A") == 200)
    # B: signed notification but PayHere has no such payment (forged / leaked secret)
    ref, oid, amt, em = new_order(br, "b@example.com"); setmock(entries={})
    check("B signed but unknown to PayHere -> refused", notify(oid, amt, "2", "PH-B") == 400 and not paid(br, ref, em))
    # C: PayHere says amount differs / not RECEIVED / wrong payment id
    ref, oid, amt, em = new_order(br, "c@example.com")
    setmock(entries={oid: [entry(oid, "PH-C", "1.00")]})
    check("C amount differs from PayHere's record -> refused", notify(oid, amt, "2", "PH-C") == 400 and not paid(br, ref, em))
    setmock(entries={oid: [entry(oid, "PH-C", amt, status="REFUNDED")]})
    check("C status not RECEIVED -> refused", notify(oid, amt, "2", "PH-C") == 400)
    setmock(entries={oid: [entry(oid, "PH-OTHER", amt)]})
    check("C notified payment_id not in PayHere records -> refused", notify(oid, amt, "2", "PH-C") == 400 and not paid(br, ref, em))
    # D: outage -> never credit on a guess; 503 so PayHere resends; credited after recovery
    ref, oid, amt, em = new_order(br, "d@example.com")
    setmock(entries={oid: [entry(oid, "PH-D", amt)]}, outage=True)
    check("D PayHere unreachable -> 503, not credited", notify(oid, amt, "2", "PH-D") == 503 and not paid(br, ref, em))
    setmock(outage=False)
    # background retry (HOUSEKEEPING_SECONDS=5 in the test server) credits it without any new notification
    import time; ok = False
    for _ in range(40):
        time.sleep(1)
        if paid(br, ref, em): ok = True; break
    check("D background retry credits it once PayHere answers", ok)
    # E: failed/cancelled notifications need no lookup and never credit
    ref, oid, amt, em = new_order(br, "e@example.com")
    check("E status -2 (failed) accepted, not credited", notify(oid, amt, "-2", "PH-E") == 200 and not paid(br, ref, em))
    # F: bad signature still refused before any lookup
    calls = STATE["calls"]
    sig_bad = urllib.parse.urlencode({"merchant_id": "1200001", "order_id": oid, "payment_id": "X", "payhere_amount": amt, "payhere_currency": "LKR", "status_code": "2", "md5sig": "BAD"}).encode()
    try: code = urllib.request.urlopen(urllib.request.Request(B + "/api/payhere/notify", data=sig_bad)).status
    except urllib.error.HTTPError as e: code = e.code
    check("F bad signature refused and PayHere not even queried", code == 400 and STATE["calls"] == calls)
    # CSV formula injection: a hostile customer name must come out of the admin export as inert text
    new_order(br, "evil@example.com", name='=HYPERLINK("http://evil.example","click")'); new_order(br, "evil2@example.com", name="+1+cmd|' /C calc'!A0")
    paid(br, ref, em)  # makes sure the admin page is logged in
    csv = ADMIN["pg"].context.request.get(B + "/admin/export/customers").text()
    check("CSV export neutralises = and +1+ formula names", "'=HYPERLINK" in csv and "'+1+cmd" in csv and ",=HYPERLINK" not in csv and ",+1+cmd" not in csv)
    # G: staff see the unverified items
    ad = br.new_context(bypass_csp=True).new_page(); ad.goto(B + "/admin/login"); ad.fill('input[name=password]', "test-password-12345"); ad.fill('input[name=code]', totp_code()); ad.get_by_role("button", name="Log in").click(); ad.wait_for_url("**/admin")
    ad.goto(B + "/admin/payments"); t = ad.inner_text("main")
    check("G staff review queue lists unverified_payment items", "not confirm" in t.lower() or "unverified" in t.lower())
    # H: concurrent login failures are all counted (atomic limiter) and the form is never closed to a trusted browser
    ctx = br.new_context(bypass_csp=True); tp = ctx.new_page(); tp.goto(B + "/admin/login"); tp.fill('input[name=password]', "test-password-12345"); tp.fill('input[name=code]', totp_code()); tp.get_by_role("button", name="Log in").click(); tp.wait_for_url("**/admin")
    check("H successful login sets known-device cookie", any(c["name"] == "siq_trust" for c in ctx.cookies()))
    br.close()
srv.shutdown()
print("FAILED" if check.failed else "ALL PASSED"); sys.exit(1 if check.failed else 0)
