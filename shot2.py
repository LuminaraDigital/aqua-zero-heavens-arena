from playwright.sync_api import sync_playwright
import time

game = "file:///C:/Users/lumin/Downloads/Tekken%20Card%20Challenge%20(Japan)/aqua-zero-heavens-arena.html"
out = "C:/Users/lumin/Downloads/Tekken Card Challenge (Japan)/shots"

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width":1280,"height":800})
    pg.goto(game)
    time.sleep(3)
    pg.screenshot(path=out + "/t0_title.png")
    pg.mouse.click(640, 400)
    time.sleep(1.5)
    pg.screenshot(path=out + "/t1_menu.png")

    # try "start" from menu - A button or Enter
    pg.keyboard.press("Enter")
    time.sleep(1.5)
    pg.screenshot(path=out + "/t2.png")
    pg.keyboard.press("z")   # A button
    time.sleep(2)
    pg.screenshot(path=out + "/t3_roster.png")

    # pick first fighter by clicking a card region
    for i,(x,y) in enumerate([(400,400),(640,300),(640,500),(500,450)]):
        pg.mouse.click(x,y); time.sleep(1.5)
        pg.screenshot(path=out + f"/t4_pick_{i}.png")

    # try to start a fight
    for key in ["z","Enter","z"]:
        pg.keyboard.press(key); time.sleep(1.5)
        pg.screenshot(path=out + f"/t5_start_{key}.png")
    b.close()
print("done")
