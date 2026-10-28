import sys
from playwright.sync_api import sync_playwright
B='http://localhost:3077'
PAGES=['/','/shop','/caps','/sports/football','/products/'+sys.argv[1] if len(sys.argv)>1 else '/shop','/cart','/checkout','/about','/track-order','/returns','/shipping','/reviews','/search?q=nba']
W=[320,375,390,768,1440]
bad=0
with sync_playwright() as p:
    b=p.chromium.launch()
    for w in W:
        c=b.new_context(viewport={'width':w,'height':800},has_touch=w<800,is_mobile=w<800)
        pg=c.new_page()
        for u in PAGES:
            pg.goto(B+u); pg.wait_for_timeout(500)
            sw=pg.evaluate("document.documentElement.scrollWidth")
            small=pg.evaluate("""()=>[...document.querySelectorAll('a,button,select,input:not([type=hidden]):not(.sr-only),textarea,summary')].filter(e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!='hidden'&&!e.closest('.sr-only')&&e.className.toString().indexOf('sr-only')<0&&(r.height<40||r.width<40)&&!(e.tagName=='A'&&r.height>=40)}).slice(0,4).map(e=>(e.tagName+' '+(e.getAttribute('aria-label')||e.textContent||e.name||'').trim().slice(0,22)+' '+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height)))""") if w<800 else []
            flag='' if sw<=w else '  OVERFLOW'
            if flag: bad+=1
            print(w,u,sw,flag,small)
        c.close()
    b.close()
print('overflow pages:',bad)
