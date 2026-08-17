/* =====================================================================
   Aqua Zero Heavens Arena - adventure map field skin
   Luminara Digital

   The adventure map used to be a flat tile dump: unseen cells were a
   solid near-black rect, walls were two nested fills, floors were one
   fill, and every entity was a triangle or a star dropped on top. It
   read as a spreadsheet with icons, not as a field you were walking.

   This file owns the FIELD PIXELS for that screen - the 15x15 grid,
   fog, floor bevels, wall highlights, and entity silhouettes. It does
   not own the side panel, the bottom message bar, bgFill, hot(), or
   txt(). Those stay on the page so a pause overlay, a dossier return,
   and the gym backdrop can keep sharing one chrome path.

   API SURFACE (all function declarations, so MODULE_ORDER is free):

     mapPalette(ogre)              pure colours for void / floor / wall
     paintMapField(cx, m, layout, t)
                                   tiles + soft fog + optional vignette
     paintMapEntity(cx, kind, X, Y, C, opts)
                                   exit / temple / card / pit / rival /
                                   force / player / huntingPulse
     paintMapChrome(cx, W, H, a, m, side)
                                   intentionally thin - see the comment
                                   on that function for what the page
                                   must still draw
     mapNeighborHot(m, layout)     pure {x,y,w,h,dir}[] for click-to-step

   layout is { C, ox, oy }: cell size in px and the top-left of cell
   (0,0). The live page uses C=30, ox=250, oy=28. m matches newField:
   N, g, seen, temples, cards, pits, foes, px/py, exitY, ogre, steps.

   PERFORMANCE: N is 15. A double loop plus a handful of alpha rects
   per fog cell is fine. No ImageData, no offscreen canvas, no
   Math.random - fog grain is a hash of (x,y) so the field is stable
   across frames and only the soft pulse (from t) moves.

   Globals assumed: none at top level. Paint helpers take colours from
   mapPalette (or opts) so this file does not depend on RED/GOLD/INK
   being declared yet. Safe to place anywhere in MODULE_ORDER once
   build.js lists it.
   ===================================================================== */

/* ---------------------------------------------------------------------
   Local maths. Same reason as entrance.js: do not borrow clamp from
   anim.js (a const), keep this file order-free.
   --------------------------------------------------------------------- */
function mapClamp01(n) { return n < 0 ? 0 : (n > 1 ? 1 : n); }
function mapNum(n) { const v = +n; return v === v && v !== Infinity && v !== -Infinity ? v : 0; }
/* cheap deterministic 0..1 from integer coords - fog grain, not RNG */
function mapHash01(x, y) {
  let n = ((x * 374761393) ^ (y * 668265263)) >>> 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n >>> 0) % 1000) / 1000;
}

/* ---------------------------------------------------------------------
   mapPalette - pure. ogre world shifts the whole field toward maroon
   so Heavens Gate is readable without a separate art pass.
   --------------------------------------------------------------------- */
function mapPalette(ogre) {
  if (ogre) {
    return {
      void: "#070508",
      floor: "#180e14",
      floorAlt: "#1c1018",
      floorHi: "#2a1822",
      floorLo: "#10080e",
      wall: "#2a1420",
      wallHi: "#4a2438",
      wallLo: "#1a0c14",
      fog: "#0a0608",
      fogGrain: "rgba(40,18,28,.18)",
      exit: "#e03a2f",
      exitInk: "#0a0508",
      exitDim: "#2a1420",
      grid: "#3a2030",
      panel: "#150c12",
      vignette: "rgba(8,2,6,.22)",
      ink: "#e8e6e1",
      dim: "#8b8e96",
      gold: "#d8a24a",
      red: "#e03a2f",
      grn: "#9be89b",
      blu: "#7fd4ff"
    };
  }
  return {
    void: "#07080a",
    floor: "#13161c",
    floorAlt: "#161a22",
    floorHi: "#222833",
    floorLo: "#0c0e12",
    wall: "#20242e",
    wallHi: "#3a4150",
    wallLo: "#14171e",
    fog: "#07080a",
    fogGrain: "rgba(30,34,42,.20)",
    exit: "#d8a24a",
    exitInk: "#0a0b0e",
    exitDim: "#20242e",
    grid: "#2a2d35",
    panel: "#0e1014",
    vignette: "rgba(4,5,8,.20)",
    ink: "#e8e6e1",
    dim: "#8b8e96",
    gold: "#d8a24a",
    red: "#e03a2f",
    grn: "#9be89b",
    blu: "#7fd4ff"
  };
}

/* ---------------------------------------------------------------------
   Tile painters - one cell each. Kept as local helpers so the field
   loop stays readable.
   --------------------------------------------------------------------- */
function mapPaintFogCell(cx, X, Y, cw, ch, pal, x, y, t) {
  cx.fillStyle = pal.fog;
  cx.fillRect(X, Y, cw, ch);
  /* soft patterned fog: a few alpha dots, not a flat black slab */
  const pulse = 0.85 + 0.15 * Math.sin(mapNum(t) * 0.04 + x * 0.7 + y * 0.5);
  cx.fillStyle = pal.fogGrain;
  const dots = 3 + ((x * 3 + y * 5) & 1);
  for (let i = 0; i < dots; i++) {
    const u = mapHash01(x + i * 17, y + i * 31);
    const v = mapHash01(y + i * 13, x + i * 29);
    const s = 1.5 + u * 2.5;
    cx.globalAlpha = (0.35 + v * 0.45) * pulse;
    cx.fillRect(X + 2 + u * (cw - 6), Y + 2 + v * (ch - 6), s, s);
  }
  cx.globalAlpha = 1;
}

function mapPaintFloorCell(cx, X, Y, cw, ch, pal, x, y) {
  const alt = ((x + y) & 1) === 1;
  cx.fillStyle = alt ? pal.floorAlt : pal.floor;
  cx.fillRect(X, Y, cw, ch);
  /* inset bevel: light top/left, dark bottom/right */
  const inset = 1;
  cx.fillStyle = pal.floorHi;
  cx.fillRect(X + inset, Y + inset, cw - inset * 2, 1);
  cx.fillRect(X + inset, Y + inset, 1, ch - inset * 2);
  cx.fillStyle = pal.floorLo;
  cx.fillRect(X + inset, Y + ch - inset - 1, cw - inset * 2, 1);
  cx.fillRect(X + cw - inset - 1, Y + inset, 1, ch - inset * 2);
}

function mapPaintWallCell(cx, X, Y, cw, ch, pal) {
  cx.fillStyle = pal.wall;
  cx.fillRect(X, Y, cw, ch);
  /* recessed core */
  cx.fillStyle = pal.wallLo;
  cx.fillRect(X + 3, Y + 4, cw - 6, ch - 7);
  /* top highlight edge - the one read that sells "solid" */
  cx.fillStyle = pal.wallHi;
  cx.fillRect(X + 1, Y + 1, cw - 2, 2);
  cx.fillRect(X + 1, Y + 1, 1, ch - 3);
}

function mapPaintVignetteEdge(cx, X, Y, cw, ch, pal, m, x, y) {
  /* darken a seen cell that touches unseen - soft explored rim */
  const N = m.N;
  let edge = false;
  for (let dy = -1; dy <= 1 && !edge; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) { edge = true; break; }
      if (!m.seen[ny][nx]) { edge = true; break; }
    }
  }
  if (!edge) return;
  cx.fillStyle = pal.vignette;
  cx.fillRect(X, Y, cw, ch);
}

/* ---------------------------------------------------------------------
   paintMapField - the whole grid. Entities are a separate pass.
   layout = { C, ox, oy }, t = frame counter (for fog pulse only).
   --------------------------------------------------------------------- */
function paintMapField(cx, m, layout, t) {
  if (!cx || !m || !layout) return;
  const C = mapNum(layout.C) || 30;
  const ox = mapNum(layout.ox);
  const oy = mapNum(layout.oy);
  const N = m.N | 0;
  const pal = mapPalette(!!m.ogre);
  const gap = 2;
  const cw = C - gap;
  const ch = C - gap;
  const frame = mapNum(t);

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const X = ox + x * C;
      const Y = oy + y * C;
      if (!m.seen[y] || !m.seen[y][x]) {
        mapPaintFogCell(cx, X, Y, cw, ch, pal, x, y, frame);
        continue;
      }
      if (m.g[y][x]) mapPaintWallCell(cx, X, Y, cw, ch, pal);
      else mapPaintFloorCell(cx, X, Y, cw, ch, pal, x, y);
      mapPaintVignetteEdge(cx, X, Y, cw, ch, pal, m, x, y);
    }
  }

  cx.strokeStyle = pal.grid;
  cx.lineWidth = 1.5;
  cx.strokeRect(ox - 1.5, oy - 1.5, N * C + 1, N * C + 1);
  cx.lineWidth = 1;
}

/* ---------------------------------------------------------------------
   Entity silhouettes - canvas primitives only. X,Y are cell top-left
   (same as ox+x*C). C is cell size including the 2px gutter the old
   rMap left empty.
   --------------------------------------------------------------------- */
function mapEntityFillPoly(cx, pts) {
  if (!pts || pts.length < 3) return;
  cx.beginPath();
  cx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) cx.lineTo(pts[i], pts[i + 1]);
  cx.closePath();
  cx.fill();
}

function paintMapEntity(cx, kind, X, Y, C, opts) {
  if (!cx) return;
  const o = opts || {};
  const pal = o.pal || mapPalette(!!o.ogre);
  const cell = mapNum(C) || 30;
  const cw = cell - 2;
  const cx0 = X + cell / 2 - 1;
  const cy0 = Y + cell / 2 - 1;

  if (kind === "huntingPulse") {
    cx.fillStyle = "rgba(224,58,47,.28)";
    cx.fillRect(X, Y, cw, cw);
    return;
  }

  if (kind === "exit") {
    const seen = o.seen !== false;
    const ogre = !!o.ogre;
    cx.fillStyle = seen ? pal.exit : pal.exitDim;
    if (ogre) {
      /* tower: stacked blocks narrowing upward */
      cx.fillRect(X + 8, Y + 14, cw - 16, cw - 18);
      cx.fillRect(X + 10, Y + 8, cw - 20, 7);
      cx.fillRect(X + 12, Y + 3, cw - 24, 6);
      cx.fillStyle = seen ? pal.exitInk : pal.wallLo;
      cx.fillRect(X + 13, Y + 18, 4, cw - 22);
    } else {
      /* door slab with a small lintel */
      cx.fillRect(X + 5, Y + 4, cw - 10, cw - 8);
      cx.fillStyle = seen ? pal.exitInk : pal.wallLo;
      cx.fillRect(X + 7, Y + 6, cw - 14, 3);
      cx.fillRect(X + 11, Y + 14, 3, 8);
    }
    if (seen && o.label !== false) {
      cx.fillStyle = pal.exitInk;
      cx.font = (ogre ? "bold 11px " : "bold 7px ") + "sans-serif";
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.fillText(ogre ? "T" : "EXIT", cx0, cy0 + 1);
    }
    return;
  }

  if (kind === "temple") {
    cx.fillStyle = pal.grn;
    /* pagoda: base, mid roof, peak */
    cx.fillRect(X + 7, Y + 14, cw - 14, cw - 18);
    cx.fillRect(X + 4, Y + 11, cw - 8, 4);
    cx.fillRect(X + 7, Y + 7, cw - 14, 4);
    cx.fillRect(X + 10, Y + 3, cw - 20, 4);
    cx.fillStyle = pal.floorLo;
    cx.fillRect(X + 12, Y + 16, 4, cw - 20);
    return;
  }

  if (kind === "card") {
    cx.fillStyle = pal.blu;
    /* tilted card diamond */
    mapEntityFillPoly(cx, [
      cx0, Y + 4,
      X + cw - 5, cy0,
      cx0, Y + cw - 4,
      X + 5, cy0
    ]);
    cx.fillStyle = pal.exitInk;
    cx.font = "bold 11px sans-serif";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.fillText("?", cx0, cy0 + 1);
    return;
  }

  if (kind === "pit") {
    cx.fillStyle = "#000000";
    cx.beginPath();
    cx.ellipse(cx0, cy0, 9, 6, 0, 0, Math.PI * 2);
    cx.fill();
    cx.strokeStyle = "#333333";
    cx.lineWidth = 1;
    cx.stroke();
    /* inner hole ring */
    cx.strokeStyle = "#1a1a1a";
    cx.beginPath();
    cx.ellipse(cx0, cy0, 5, 3.2, 0, 0, Math.PI * 2);
    cx.stroke();
    return;
  }

  if (kind === "force") {
    /* AZX Force: shield chevron, sharper than a bare triangle */
    cx.fillStyle = pal.red;
    mapEntityFillPoly(cx, [
      cx0, Y + 4,
      X + cw - 5, Y + 12,
      X + cw - 7, Y + cw - 5,
      cx0, Y + cw - 10,
      X + 5, Y + cw - 5,
      X + 3, Y + 12
    ]);
    cx.fillStyle = pal.exitInk;
    mapEntityFillPoly(cx, [
      cx0, Y + 9,
      X + cw - 9, Y + 14,
      cx0, Y + cw - 12,
      X + 7, Y + 14
    ]);
    return;
  }

  if (kind === "rival") {
    /* five-point star, slightly thicker arms than the old path */
    cx.fillStyle = pal.gold;
    cx.beginPath();
    const R = 9, r = 4;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
      const a2 = a + Math.PI / 5;
      const fn = i ? "lineTo" : "moveTo";
      cx[fn](cx0 + Math.cos(a) * R, cy0 + Math.sin(a) * R);
      cx.lineTo(cx0 + Math.cos(a2) * r, cy0 + Math.sin(a2) * r);
    }
    cx.closePath();
    cx.fill();
    cx.fillStyle = pal.exitInk;
    cx.beginPath();
    cx.arc(cx0, cy0, 2.2, 0, Math.PI * 2);
    cx.fill();
    return;
  }

  if (kind === "player") {
    const pulse = o.pulse != null ? !!o.pulse : ((mapNum(o.t) / 14 | 0) % 2) === 1;
    const pad = pulse ? 1 : 0;
    cx.fillStyle = pal.ink;
    cx.fillRect(X + 9 - pad, Y + 9 - pad, cw - 18 + pad * 2, cw - 18 + pad * 2);
    cx.strokeStyle = pal.red;
    cx.lineWidth = 2;
    cx.strokeRect(X + 5.5, Y + 5.5, cw - 11, cw - 11);
    cx.lineWidth = 1;
    return;
  }
}

/* ---------------------------------------------------------------------
   paintMapChrome - intentionally does NOT redraw the side panel.

   The page should still draw after paintMapField + entity loop:

     - bgFill(...) for the scene backdrop (before the field)
     - left panel(16,28,210,H-70) with fighter art, name, stage line,
       STEPS / HP / LEVEL / CARD POINTS / DECK / PURSE / CONTINUES,
       and the LEGEND row
     - bottom message panel + m.msg / steps remaining line
     - hunted count / "B - PAUSE   Y - DOSSIER" hint
     - hot() registration from mapNeighborHot when G.scene === S.MAP

   side may be a layout hint reserved for a future thin frame; unused.
   --------------------------------------------------------------------- */
function paintMapChrome(cx, W, H, a, m, side) {
  /* no-op body on purpose - see header comment above */
  void cx; void W; void H; void a; void m; void side;
}

/* ---------------------------------------------------------------------
   mapNeighborHot - pure. Returns clickable neighbour rects in canvas
   space. Matches the old rMap dirs: up/down/left/right. Does not skip
   walls; advMove still owns the beep-on-blocked behaviour.
   --------------------------------------------------------------------- */
function mapNeighborHot(m, layout) {
  const out = [];
  if (!m || !layout) return out;
  const C = mapNum(layout.C) || 30;
  const ox = mapNum(layout.ox);
  const oy = mapNum(layout.oy);
  const N = m.N | 0;
  const dirs = [
    ["up", 0, -1],
    ["down", 0, 1],
    ["left", -1, 0],
    ["right", 1, 0]
  ];
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i][0];
    const nx = m.px + dirs[i][1];
    const ny = m.py + dirs[i][2];
    if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
    out.push({
      x: ox + nx * C,
      y: oy + ny * C,
      w: C - 2,
      h: C - 2,
      dir: dir
    });
  }
  return out;
}
