from playwright.sync_api import sync_playwright
import time

game = "file:///C:/Users/lumin/Downloads/Tekken%20Card%20Challenge%20(Japan)/aqua-zero-heavens-arena.html"
out = "C:/Users/lumin/Downloads/Tekken Card Challenge (Japan)/shots"

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width":1280,"height":800})
    pg.goto(game)
    time.sleep(3)
    pg.screenshot(path=out + "/after_title.png")
    b.close()
print("done")
