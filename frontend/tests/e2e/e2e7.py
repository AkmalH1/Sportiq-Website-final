# Concurrency: two buyers race for the last unit; admin content editing. Needs a fresh DB with SEED_DEMO_DATA=true, port 3077.
from totp_helper import totp_code  # two-factor is mandatory on production servers
import re, subprocess, threading
from playwright.sync_api import sync_playwright
B = "http://localhost:3077"
def sql(q): return subprocess.run(["mysql","-uroot","-S","/tmp/mysql.sock","sportiq_t","-N","-e",q],capture_output=True,text=True).stdout.strip()
def check(l,c):
    print(("PASS " if c else "FAIL ")+l)
    if not c: check.failed=True
check.failed=False
import urllib.request
urllib.request.urlopen(B + "/api/health").read(); urllib.request.urlopen(B + "/").read()  # first request runs migrations + seed
slug="demo-f1-paddock-polo"
sql("UPDATE variants v JOIN products p ON p.id=v.product_id SET v.stock=CASE WHEN v.size='M' THEN 1 ELSE v.stock END WHERE p.slug='%s'"%slug)
results={}
def buyer(name, br):
    pg=br.new_context(bypass_csp=True).new_page()
    pg.goto(B+"/products/"+slug,wait_until="networkidle")
    pg.locator("label",has_text="M").first.click(); pg.get_by_role("button",name="Add to cart").click(); pg.wait_for_timeout(800)
    pg.goto(B+"/checkout",wait_until="networkidle"); pg.wait_for_selector("text=Subtotal")
    pg.select_option('select[autocomplete="country"]',"LK") if pg.locator('select[autocomplete="country"]').count() else None
    pg.fill('input[name="name"]',name); pg.fill('input[name="email"]',name+"@example.com"); pg.fill('input[name="phone"]',"0771234567")
    pg.fill('input[name="address"]',"1 Main St"); pg.fill('input[name="city"]',"Colombo")
    if pg.locator('input[name="postal"]').count(): pg.fill('input[name="postal"]',"00100")
    pg.wait_for_timeout(1200)
    results[name]=pg
with sync_playwright() as p:
    br=p.chromium.launch()
    for n in ("buyera","buyerb"): buyer(n,br)
    def go(pg):
        pg.get_by_role("button",name=re.compile("Place order",re.I)).click()
        try: pg.wait_for_url(re.compile(r".*/(pay|track-order)/.*"),timeout=15000)
        except Exception: pass
        pg.wait_for_timeout(800)
    ts=[threading.Thread(target=go,args=(pg,)) for pg in results.values()]
    # sync playwright is not thread-safe across pages; fire sequentially but without waiting between clicks
    for pg in results.values(): pg.get_by_role("button",name=re.compile("Place order",re.I)).click()
    for pg in results.values():
        try: pg.wait_for_load_state("networkidle",timeout=15000)
        except Exception: pass
        pg.wait_for_timeout(1500)
    print([pg.url for pg in results.values()]); ok=sum(1 for pg in results.values() if re.search(r"/(pay|track-order)/",pg.url))
    check("exactly one buyer got the last unit", ok==1)
    st=sql("SELECT v.stock FROM variants v JOIN products p ON p.id=v.product_id WHERE p.slug='%s' AND v.size='M'"%slug)
    check("stock never negative (0 left)", st=="0")
    check("one order row for that item", sql("SELECT COUNT(*) FROM order_items oi JOIN variants v ON v.sku=oi.sku WHERE v.size='M' AND v.product_id=(SELECT id FROM products WHERE slug='%s')"%slug)=="1")
    # admin content
    ad=br.new_context(bypass_csp=True).new_page(); ad.goto(B+"/admin/login"); ad.fill('input[name=password]',"test-password-12345"); ad.fill('input[name=code]', totp_code()); ad.get_by_role("button",name="Log in").click(); ad.wait_for_url("**/admin")
    ad.goto(B+"/admin/content",wait_until="networkidle"); check("admin content page", "faq" in ad.inner_text("main").lower())
    n0=int(sql("SELECT COUNT(*) FROM faqs"))
    form=ad.locator("form").filter(has=ad.locator('input[name="id"][value="0"]')).filter(has=ad.locator('textarea[name="answer"]')).first
    ad.locator("summary").first.click() if not form.is_visible() else None
    form.locator('input[name="question"]').fill("Do you ship to Kandy?"); form.locator('textarea[name="answer"]').fill("Yes, island-wide delivery.")
    form.get_by_role("button",name="Save").click(); ad.wait_for_load_state("networkidle"); ad.wait_for_timeout(1500)
    check("faq added in DB", int(sql("SELECT COUNT(*) FROM faqs"))==n0+1)
    pg=br.new_context(bypass_csp=True).new_page(); pg.goto(B+"/",wait_until="networkidle"); pg.wait_for_timeout(1000)
    check("faq shows on home", "Do you ship to Kandy?" in pg.content())
    slug0=sql("SELECT slug FROM collections LIMIT 1")
    r=pg.goto(B+"/collections/"+slug0,wait_until="networkidle"); check("collection page renders", r.status==200)
    r=pg.goto(B+"/collections/does-not-exist"); check("missing collection 404", r.status==404)
    br.close()
print("FAILED" if check.failed else "ALL PASSED")
