import os
import time
from playwright.sync_api import sync_playwright

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html_path = "file:///" + os.path.join(root, "aqua-zero-heavens-arena.html").replace("\\", "/")
shots_dir = os.path.join(root, "shots-3d")
os.makedirs(shots_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--enable-webgl", "--ignore-gpu-blocklist"])
    page = browser.new_page(viewport={"width": 1280, "height": 720})

    page.goto(html_path)
    time.sleep(2.0)
    page.screenshot(path=os.path.join(shots_dir, "01_title_3d.png"))
    print("Captured 01_title_3d.png")

    # 1. Heavens Arena
    page.evaluate("""() => {
        if (typeof startExhibitionBout === 'function') {
            startExhibitionBout(0, 1, { venue: 'heavens' });
            if (typeof beginRound === 'function' && G.duel) {
                beginRound(G.duel);
                G.duel.ph = D.CMD;
            }
        }
    }""")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(shots_dir, "03_duel_live_ring_heavens.png"))
    print("Captured 03_duel_live_ring_heavens.png")

    # 2. Club venue
    page.evaluate("""() => {
        if (typeof startExhibitionBout === 'function') {
            startExhibitionBout(2, 3, { venue: 'club' });
            if (typeof beginRound === 'function' && G.duel) {
                beginRound(G.duel);
                G.duel.ph = D.CMD;
            }
        }
    }""")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(shots_dir, "04_duel_live_ring_club.png"))
    print("Captured 04_duel_live_ring_club.png")

    # 3. Underground Cage
    page.evaluate("""() => {
        if (typeof startExhibitionBout === 'function') {
            startExhibitionBout(4, 5, { venue: 'underground' });
            if (typeof beginRound === 'function' && G.duel) {
                beginRound(G.duel);
                G.duel.ph = D.CMD;
            }
        }
    }""")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(shots_dir, "06_duel_underground_cage.png"))
    print("Captured 06_duel_underground_cage.png")

    # 4. Rooftop Skyline
    page.evaluate("""() => {
        if (typeof startExhibitionBout === 'function') {
            startExhibitionBout(6, 7, { venue: 'rooftop' });
            if (typeof beginRound === 'function' && G.duel) {
                beginRound(G.duel);
                G.duel.ph = D.CMD;
            }
        }
    }""")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(shots_dir, "07_duel_rooftop_skyline.png"))
    print("Captured 07_duel_rooftop_skyline.png")

    # 5. Void Arena
    page.evaluate("""() => {
        if (typeof startExhibitionBout === 'function') {
            startExhibitionBout(8, 9, { venue: 'void' });
            if (typeof beginRound === 'function' && G.duel) {
                beginRound(G.duel);
                G.duel.ph = D.CMD;
            }
        }
    }""")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(shots_dir, "08_duel_void_monoliths.png"))
    print("Captured 08_duel_void_monoliths.png")

    # 6. Combat Strike with 3D Sparks & Shockwave
    page.evaluate("""() => {
        if (typeof CombatFX3D !== 'undefined') {
            CombatFX3D.spawnClashSparks({ x: 0, y: 2.0, z: 0 }, 80, 0xffd700);
            CombatFX3D.spawnShockwave({ x: 0, y: 1.0, z: 0 }, 7.5, 0x22d3ee);
            if (typeof ThreeEngine !== 'undefined') ThreeEngine.triggerShake(12);
        }
    }""")
    time.sleep(0.3)
    page.screenshot(path=os.path.join(shots_dir, "09_duel_3d_combat_strike.png"))
    print("Captured 09_duel_3d_combat_strike.png")

    # 7. Trophy Room
    page.evaluate("""() => {
        if (typeof S !== 'undefined') {
            G.scene = S.TROPHY;
        }
    }""")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(shots_dir, "05_trophy_3d_room.png"))
    print("Captured 05_trophy_3d_room.png")

    browser.close()

print("Verification complete!")
