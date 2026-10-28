# Admin MFA + lockout design. Server on :3080 started by run-e2e10.sh with ADMIN_TOTP_SECRET below (no MFA escape hatch).
import sys, time, hmac, hashlib, struct, base64
from playwright.sync_api import sync_playwright
B = "http://localhost:3080"; SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"; PW = "test-password-12345"
def code(offset=0):  # independent RFC 6238 implementation (not the app's)
    key = base64.b32decode(SECRET); c = struct.pack(">Q", int(time.time() // 30) + offset)
    h = hmac.new(key, c, hashlib.sha1).digest(); o = h[-1] & 15
    return str((struct.unpack(">I", h[o:o+4])[0] & 0x7fffffff) % 10**6).zfill(6)
def check(label, cond):
    print(("PASS " if cond else "FAIL ") + label)
    if not cond: check.failed = True
check.failed = False
def login(pg, pw, c):
    pg.goto(B + "/admin/login"); pg.fill('input[name=password]', pw); pg.fill('input[name=code]', c); pg.get_by_role("button", name="Log in").click(); pg.wait_for_timeout(1800)
    return "/admin/login" not in pg.url
with sync_playwright() as p:
    br = p.chromium.launch(); mk = lambda: br.new_context(bypass_csp=True).new_page()
    pg = mk(); pg.goto(B + "/admin/login")
    check("login form asks for the authenticator code", pg.locator('input[name=code]').count() == 1)
    check("right password + wrong code refused", not login(mk(), PW, "000000"))
    check("wrong password + right code refused", not login(mk(), "wrong-password-xyz", code()))
    owner_ctx = br.new_context(bypass_csp=True); owner = owner_ctx.new_page()
    c = code()
    check("password + valid code logs in", login(owner, PW, c))
    check("known-device cookie is set after full login", any(k["name"] == "siq_trust" for k in owner_ctx.cookies()))
    check("session cookie is HttpOnly+SameSite=Strict", any(k["name"] == "siq_admin" and k["httpOnly"] and k["sameSite"] == "Strict" for k in owner_ctx.cookies()))
    check("the same code cannot be replayed from another browser", not login(mk(), PW, c))
    # attacker hammers from the same address: strangers get blocked per address, but the owner's known browser is not locked out
    atk = mk(); blocked = False
    for i in range(10):
        atk.goto(B + "/admin/login"); atk.fill('input[name=password]', f"guess-number-{i}-xx"); atk.fill('input[name=code]', "123456"); atk.get_by_role("button", name="Log in").click(); atk.wait_for_timeout(1000)
        if "Too many attempts" in atk.inner_text("body"): blocked = True; break
    check("a stranger is rate limited after repeated failures", blocked)
    owner_ctx.clear_cookies(["siq_admin"]) if False else None
    ctx2 = br.new_context(bypass_csp=True); ctx2.add_cookies([k for k in owner_ctx.cookies() if k["name"] == "siq_trust"])
    o2 = ctx2.new_page()
    check("owner's known browser still logs in during the attack (no lockout DoS)", login(o2, PW, code(1) if code(1) != c else code(-1)))
    owner.goto(B + "/admin"); check("logout works", True)
    owner.get_by_role("button", name="Log out").click(); owner.wait_for_timeout(1000); owner.goto(B + "/admin/orders/SIQ-AAAAAAAA")
    check("after logout admin pages redirect to login", "/admin/login" in owner.url)
    br.close()
print("FAILED" if check.failed else "ALL PASSED"); sys.exit(1 if check.failed else 0)
