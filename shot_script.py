from playwright.sync_api import sync_playwright
import time, os

game = r"C:\Users\lumin\Downloads\Tekken Card Challenge (Japan)\aqua-zero-heavens-arena.html"
out = r"C:\Users\lumin\Downloads\Tekken Card Challenge (Japan)\shots"
os.makedirs(out, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width":1280,"height":800})
    pg.goto("file:///" + game.replace("\\","/"))
    time.sleep(3)
    pg.screenshot(path=out + "/01_load.png")
    # try clicking every visible button to walk through screens
    buttons = pg.query_selector_all("button, [onclick], .btn")
    print("buttons found:", len(buttons))
    for i, btn in enumerate(buttons[:6]):
        try:
            btn.click()
            time.sleep(1.5)
            pg.screenshot(path=f"{out}/screen_{i}.png")
        except Exception as e:
            print(i, "click fail:", e)
    # also click canvas regions to advance attract mode
    for i,(x,y) in enumerate([(640,600),(640,400),(640,200)]):
        pg.mouse.click(x,y); time.sleep(1.5)
        pg.screenshot(path=f"{out}/canvas_{i}.png")
    pg.screenshot(path=out + "/final.png")
    b.close()
print("done")
