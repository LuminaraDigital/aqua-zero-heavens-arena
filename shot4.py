from playwright.sync_api import sync_playwright
import time

game = "file:///C:/Users/lumin/Downloads/Tekken%20Card%20Challenge%20(Japan)/aqua-zero-heavens-arena.html"
out = "C:/Users/lumin/Downloads/Tekken Card Challenge (Japan)/shots"

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width":1280,"height":800})
    pg.goto(game)
    time.sleep(3.5)
    pg.screenshot(path=out + "/after_title.png")

    # grab the canvas and repaint each venue directly using the page's globals
    venues = ["club", "gym", "outdoor", "heavens", "broadcast"]
    for v in venues:
        ok = pg.evaluate("""(vid) => {
          const cv = document.querySelector('canvas');
          if (!cv || typeof paintVenue !== 'function') return 'no-fn';
          const cx2 = cv.getContext('2d');
          const W = cv.width, H = cv.height;
          // stop the game loop from immediately overdrawing: we can't, so just paint
          // many frames' worth and screenshot fast. Instead: paint right now.
          paintVenue(cx2, W, H, vid, {
            crowdA: 0.3, pos: 'CENTRE', ropeSway: 0.4, t: 4.2, vignette: 0.5
          });
          return 'ok';
        }""", v)
        time.sleep(0.4)
        # freeze the loop by pausing rAF: hide via evaluate override
        pg.evaluate("() => { window.__freeze = true; window.requestAnimationFrame = () => {}; }")
        pg.evaluate("""(vid) => {
          const cv = document.querySelector('canvas');
          const cx2 = cv.getContext('2d');
          paintVenue(cx2, cv.width, cv.height, vid, {
            crowdA: 0.3, pos: 'CENTRE', ropeSway: 0.4, t: 4.2, vignette: 0.5
          });
        }""", v)
        time.sleep(0.3)
        pg.screenshot(path=f"{out}/venue_{v}.png")
        print(v, ok)
    b.close()
print("done")
