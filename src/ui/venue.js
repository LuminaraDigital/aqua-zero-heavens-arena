/* =====================================================================
   Aqua Zero Heavens Arena - multi-venue arena paint
   Luminara Digital

   The duel screen used one embedded ARENA PNG (or a flat two-stop
   gradient when the slot was empty). Every mode, every stage, every
   boss fight looked like the same room. The systems already knew when
   a fight was a title bout, a ranked card, an adventure climb or the
   Heavens Gate - none of that reached the pixels behind the fighters.

   This file turns a short venue skin into composited canvas layers:
   void, crowd band, perspective mat, ropes, posts, gel and scrim. No
   huge PNGs per skin. The optional ARENA_SRC image still helps when
   present: paintVenue draws it full-frame first, then applies the
   venue-tinted scrim so the existing art is a base plate, not a lock.

   THIS MODULE MAY PAINT. Unlike src/ui/anim.js and src/ui/entrance.js,
   paintVenue and paintTitleAtmosphere take a canvas 2d context (`cx`)
   and write pixels. That is intentional: venue is the renderer half of
   the backdrop, not a motion descriptor. Pure helpers stay pure:

     VENUES              skin table (literals only)
     pickVenue(ctx)      choose a skin from fight context
     fighterGradeFilter  CSS filter string for drawFighterArt cohesion
     venueOf / venueId   resolve id <-> skin without touching canvas

   Those four (plus the VENUES object) must stay testable with no DOM
   and no canvas. Do not put createLinearGradient or fillRect inside them.

   Canvas size assumed by the paint paths: 960x540 (W/H from the page).
   Geometry is derived from the passed W/H so a test harness can pass
   other sizes; the defaults match the live arena.

   Globals assumed: none at top level. Paint functions take cx explicitly.
   ===================================================================== */

/* ---------------------------------------------------------------------
   VENUES - five skins, literals only.

   Each skin carries the colours the paint paths need. Scrim stops are
   {t,c} pairs for a vertical gradient over an optional arena image
   (and as a readable wash when there is no image). Gel is a full-frame
   rgba wash; crowd is the stands band colour (alpha comes from opts).
   --------------------------------------------------------------------- */
const VENUES = {
  club: {
    id: "club",
    name: "Night Club Ring",
    matTop: "#e8e6e1",
    matBot: "#c4c0b8",
    rope: "#d8a24a",
    postL: "#8b8e96",
    postR: "#6a6d75",
    voidTop: "#12141a",
    voidBot: "#07080a",
    gel: "rgba(34,120,180,.07)",
    crowd: "rgba(255,236,190,1)",
    rim: "rgba(120,180,220,$A)",
    scrim: [
      { t: 0, c: "rgba(5,6,9,.74)" },
      { t: 0.34, c: "rgba(5,6,9,.32)" },
      { t: 0.62, c: "rgba(5,6,9,.12)" },
      { t: 1, c: "rgba(5,6,9,.44)" }
    ]
  },
  gym: {
    id: "gym",
    name: "Concrete Gym",
    matTop: "#d2c4a8",
    matBot: "#a89878",
    rope: "#b8a070",
    postL: "#7a7060",
    postR: "#5a5248",
    voidTop: "#1a1612",
    voidBot: "#0a0806",
    gel: "rgba(180,120,40,.08)",
    crowd: "rgba(220,190,140,1)",
    rim: "rgba(200,140,60,$A)",
    scrim: [
      { t: 0, c: "rgba(12,8,4,.76)" },
      { t: 0.34, c: "rgba(12,8,4,.34)" },
      { t: 0.62, c: "rgba(12,8,4,.12)" },
      { t: 1, c: "rgba(12,8,4,.46)" }
    ]
  },
  outdoor: {
    id: "outdoor",
    name: "Floodlit Outdoor",
    matTop: "#d8ddd8",
    matBot: "#a8b0a8",
    rope: "#c8d0c8",
    postL: "#6a7870",
    postR: "#4a5850",
    voidTop: "#1a2838",
    voidBot: "#0a1018",
    gel: "rgba(60,100,140,.08)",
    crowd: "rgba(180,210,240,1)",
    rim: "rgba(140,200,255,$A)",
    scrim: [
      { t: 0, c: "rgba(8,14,22,.70)" },
      { t: 0.28, c: "rgba(8,14,22,.28)" },
      { t: 0.58, c: "rgba(8,14,22,.10)" },
      { t: 1, c: "rgba(8,14,22,.40)" }
    ]
  },
  heavens: {
    id: "heavens",
    name: "Heavens Gate",
    matTop: "#d8c8c4",
    matBot: "#9a8078",
    rope: "#e03a2f",
    postL: "#8a4a48",
    postR: "#5a2828",
    voidTop: "#150c12",
    voidBot: "#070406",
    gel: "rgba(120,10,20,.18)",
    crowd: "rgba(200,80,70,1)",
    rim: "rgba(224,58,47,$A)",
    scrim: [
      { t: 0, c: "rgba(18,4,8,.78)" },
      { t: 0.34, c: "rgba(18,4,8,.36)" },
      { t: 0.62, c: "rgba(18,4,8,.14)" },
      { t: 1, c: "rgba(18,4,8,.48)" }
    ]
  },
  broadcast: {
    id: "broadcast",
    name: "Broadcast Set",
    matTop: "#eceef0",
    matBot: "#c8ced4",
    rope: "#7fd4ff",
    postL: "#6a7888",
    postR: "#4a5868",
    voidTop: "#0e1820",
    voidBot: "#060a0e",
    gel: "rgba(40,140,160,.08)",
    crowd: "rgba(160,220,230,1)",
    rim: "rgba(34,211,238,$A)",
    scrim: [
      { t: 0, c: "rgba(4,10,14,.72)" },
      { t: 0.34, c: "rgba(4,10,14,.30)" },
      { t: 0.62, c: "rgba(4,10,14,.10)" },
      { t: 1, c: "rgba(4,10,14,.42)" }
    ]
  }
};

/* ---------------------------------------------------------------------
   Small local maths. Function declarations hoist; kept off anim.js
   clamp so MODULE_ORDER does not matter for this file.
   --------------------------------------------------------------------- */
function venueClamp01(n) {
  return n < 0 ? 0 : (n > 1 ? 1 : n);
}
function venueNum(n, fallback) {
  const v = +n;
  return v === v && v !== Infinity && v !== -Infinity ? v : (fallback || 0);
}

/* resolve a skin id or object to a VENUES entry; unknown -> club */
function venueOf(venue) {
  if (!venue) return VENUES.club;
  if (typeof venue === "string") {
    return VENUES[venue] || VENUES.club;
  }
  if (venue.id && VENUES[venue.id]) return VENUES[venue.id];
  return venue.matTop ? venue : VENUES.club;
}
function venueId(venue) {
  const v = venueOf(venue);
  return v.id || "club";
}

/* ---------------------------------------------------------------------
   pickVenue(ctx) - pure. No canvas.

   Rules (first match wins):

     1. boss or ogre truthy          -> heavens
     2. ranked truthy, or mode is
        "ranked"                     -> broadcast
     3. stage >= 10, OR mode looks
        daily-ish ("daily", starts
        with "daily")                -> outdoor
     4. stage in 4..9 (mid climb)    -> gym
     5. else                         -> club

   ctx may include: { boss, ranked, ogre, stage, mode, attract }.
   attract alone does not change the skin (brand default stays club).
   --------------------------------------------------------------------- */
function pickVenue(ctx) {
  const c = ctx || {};
  if (c.boss || c.ogre) return VENUES.heavens;
  const mode = String(c.mode || "").toLowerCase();
  if (c.ranked || mode === "ranked") return VENUES.broadcast;
  const stage = venueNum(c.stage, 0);
  const dailyish = mode === "daily" || mode.indexOf("daily") === 0;
  if (stage >= 10 || dailyish) return VENUES.outdoor;
  if (stage >= 4 && stage <= 9) return VENUES.gym;
  return VENUES.club;
}

/* CSS filter for drawFighterArt cohesion with the venue gel, or null */
function fighterGradeFilter(venue) {
  const id = venueId(venue);
  if (id === "heavens") return "contrast(1.08) saturate(1.12)";
  if (id === "broadcast") return "contrast(1.06) saturate(1.05)";
  if (id === "outdoor") return "contrast(1.04) saturate(0.96) brightness(1.03)";
  if (id === "gym") return "contrast(1.05) saturate(0.92)";
  if (id === "club") return "contrast(1.04) saturate(1.08)";
  return null;
}

/* ---------------------------------------------------------------------
   Geometry helpers - pure numbers from W/H. Used by paint paths and
   safe to call from a node test without a canvas.
   --------------------------------------------------------------------- */
function venueMatGeom(W, H) {
  const w = venueNum(W, 960);
  const h = venueNum(H, 540);
  /* perspective trapezoid: far edge narrower, near edge wider.
     Fighters foot at ~392 on the live 540 canvas. */
  const farY = h * 0.52;
  const nearY = h * 0.96;
  const farHalf = w * 0.27;
  const nearHalf = w * 0.46;
  const cx0 = w * 0.5;
  return {
    w: w,
    h: h,
    farY: farY,
    nearY: nearY,
    cx0: cx0,
    farL: cx0 - farHalf,
    farR: cx0 + farHalf,
    nearL: cx0 - nearHalf,
    nearR: cx0 + nearHalf
  };
}

/* lerp a point along the left/right apron for rope rows */
function venueApronX(g, side, u) {
  const t = venueClamp01(u);
  if (side === "L") return g.farL + (g.nearL - g.farL) * t;
  return g.farR + (g.nearR - g.farR) * t;
}
function venueApronY(g, u) {
  return g.farY + (g.nearY - g.farY) * venueClamp01(u);
}

/* ---------------------------------------------------------------------
   Painterly detail layer - the part that used to be missing.

   The layers above produce a competent flat stage: void, crowd wash,
   trapezoid, ropes. That reads as a wireframe with fills, not a room
   you are standing in. The functions below add the signature elements
   that make each venue recognisable at a glance:

     club       overhead truss with par can lamps, cone light shafts,
                haze sparkle
     gym        high window shafts, hanging lamps, dust motes
     outdoor    star field, drifting rain streaks, floodlight glare
     heavens    god-ray fan from stage rear, ember motes
     broadcast  LED wall band, camera flash pops

   plus the shared finishers: layered crowd silhouettes (two parallax
   rows), light shafts, haze pools on the mat, vignette.

   DETERMINISM: all "random" placement comes from venueHash01(i, salt).
   No Math.random anywhere in this file, so a test can pin a frame and
   replay produces identical pixels. The only movement is driven by the
   caller's t (seconds), passed in through opts.

   PERFORMANCE: nothing here allocates per frame beyond canvas path
   objects. No ImageData, no offscreen canvas, no filters. Worst venue
   (outdoor rain: 38 streaks) adds under 100 cheap ops per frame.
   --------------------------------------------------------------------- */

/* deterministic 0..1 from a slot index and a salt - placement only */
function venueHash01(i, salt) {
  let n = (((i + 1) * 374761393) ^ ((salt + 1) * 668265263)) >>> 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n >>> 0) % 1000) / 1000;
}

/* composite-friendly overlay alpha helper */
function venueOverlay(cx, W, H, fn) {
  cx.save();
  cx.globalCompositeOperation = "screen";
  fn();
  cx.restore();
}

/* ---- shared: layered crowd silhouettes -----------------------------
   Two torso+bob rows at different depths and alphas. The far row is
   higher and fainter, the near row lower, larger and slightly darker
   than the crowd wash so heads read against it. Bob is sinusoidal in t
   with a per-figure phase, capped at +-3px. */
function venuePaintCrowdPeople(cx, W, H, venue, t, crowdA) {
  const a = venueClamp01(crowdA == null ? 0.12 : crowdA);
  if (a <= 0.02) return;
  const base = venue.crowd || "rgba(255,236,190,1)";
  const tt = venueNum(t, 0);
  const horizon = H * 0.34;

  const rows = [
    { n: 30, yBase: horizon * 0.9,  scale: 0.55, dark: 0.30, speed: 1.2, spread: W * 0.96 },
    { n: 22, yBase: horizon * 1.28, scale: 0.85, dark: 0.52, speed: 1.6, spread: W * 0.92 }
  ];
  cx.save();
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const gap = W / row.n;
    for (let i = 0; i < row.n; i++) {
      const jx = (venueHash01(i, r * 7 + 1) - 0.5) * gap * 0.5;
      const x = (i + 0.5) * gap + jx;
      const bob = Math.sin(tt * row.speed + venueHash01(i, r * 7 + 2) * 6.28) * 3 * row.scale;
      const y = row.yBase + bob;
      const hw = 4.4 * row.scale;
      const hh = 5.0 * row.scale;
      const tw = 7.5 * row.scale;
      const th = 10 * row.scale;
      /* figure darker than the wash behind it so it reads as a head */
      cx.globalAlpha = Math.min(0.85, a * 2.4) * row.dark;
      cx.fillStyle = "#05070a";
      cx.beginPath();
      cx.arc(x, y - hh, hw, 0, Math.PI * 2);
      cx.fill();
      cx.beginPath();
      cx.moveTo(x - tw * 0.6, y - hh * 0.2);
      cx.lineTo(x + tw * 0.6, y - hh * 0.2);
      cx.lineTo(x + tw * 0.85, y + th);
      cx.lineTo(x - tw * 0.85, y + th);
      cx.closePath();
      cx.fill();
      /* lit rim on the head from the venue colour */
      cx.globalAlpha = Math.min(0.5, a * 1.4) * row.dark;
      cx.fillStyle = base;
      cx.beginPath();
      cx.arc(x, y - hh - hw * 0.25, hw * 0.55, Math.PI, Math.PI * 2);
      cx.fill();
    }
  }
  cx.restore();
}

/* ---- shared: volumetric light shafts ---------------------------------
   Soft cones from sources above the ring down onto the mat. Screen
   blend so they brighten whatever is beneath. */
function venuePaintLightShafts(cx, W, H, g, colour, sources) {
  if (!sources || !sources.length) return;
  venueOverlay(cx, W, H, () => {
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      const sx = s.x * W;
      const sy = s.y * H;
      const tx = (s.tx == null ? s.x : s.tx) * W;
      const ty = g.farY + (g.nearY - g.farY) * (s.ty == null ? 0.25 : s.ty);
      const halfTop = W * (s.topW == null ? 0.004 : s.topW);
      const halfBot = W * (s.botW == null ? 0.05 : s.botW);
      const a = s.a == null ? 0.10 : s.a;
      const grad = cx.createLinearGradient(sx, sy, tx, ty);
      grad.addColorStop(0, colour.replace("$A", (a * 1.6).toFixed(3)));
      grad.addColorStop(1, colour.replace("$A", "0"));
      cx.fillStyle = grad;
      cx.beginPath();
      cx.moveTo(sx - halfTop, sy);
      cx.lineTo(sx + halfTop, sy);
      cx.lineTo(tx + halfBot, ty);
      cx.lineTo(tx - halfBot, ty);
      cx.closePath();
      cx.fill();
    }
  });
}

/* ---- per-venue signature elements -------------------------------- */

/* club: overhead truss bar with par cans, warm + cool cones, haze sparkle */
function venueClubDetail(cx, W, H, g, venue, t) {
  /* truss silhouette */
  cx.save();
  cx.globalAlpha = 0.8;
  cx.fillStyle = "#0a0c10";
  cx.fillRect(W * 0.18, H * 0.045, W * 0.64, 7);
  /* hanging par cans */
  const cans = 7;
  for (let i = 0; i < cans; i++) {
    const x = W * 0.18 + (i + 0.5) * (W * 0.64) / cans;
    cx.fillRect(x - 4, H * 0.045 + 7, 8, 12);
    cx.globalAlpha = 0.9;
    cx.fillStyle = i % 2 ? venue.rope : "#7fd4ff";
    cx.beginPath();
    cx.arc(x, H * 0.045 + 22, 3.4, 0, Math.PI * 2);
    cx.fill();
    cx.fillStyle = "#0a0c10";
    cx.globalAlpha = 0.8;
  }
  cx.restore();
  /* cones */
  const tt = venueNum(t, 0);
  const wob = Math.sin(tt * 0.4) * 0.012;
  venuePaintLightShafts(cx, W, H, g, "rgba(216,162,74,$A)", [
    { x: 0.30, y: 0.06, tx: 0.36 + wob, ty: 0.22, a: 0.10, botW: 0.06 },
    { x: 0.50, y: 0.06, tx: 0.50, ty: 0.22, a: 0.13, botW: 0.09 },
    { x: 0.70, y: 0.06, tx: 0.64 - wob, ty: 0.22, a: 0.10, botW: 0.06 }
  ]);
  venuePaintLightShafts(cx, W, H, g, "rgba(127,212,255,$A)", [
    { x: 0.20, y: 0.06, tx: 0.28, ty: 0.3, a: 0.06, botW: 0.05 },
    { x: 0.80, y: 0.06, tx: 0.72, ty: 0.3, a: 0.06, botW: 0.05 }
  ]);
  /* haze sparkle in the beams */
  cx.save();
  for (let i = 0; i < 22; i++) {
    const h1 = venueHash01(i, 31);
    const h2 = venueHash01(i, 32);
    const x = W * (0.25 + h1 * 0.5);
    const y = H * (0.10 + h2 * 0.42);
    const tw = venueHash01(i, 33) * 6.28;
    const p = (Math.sin(tt * 1.7 + tw) + 1) * 0.5;
    cx.globalAlpha = 0.05 + p * 0.10;
    cx.fillStyle = "#fff6e0";
    cx.fillRect(x, y, 1.6, 1.6);
  }
  cx.restore();
}

/* gym: high side windows with shafts + hanging warehouse lamps + dust */
function venueGymDetail(cx, W, H, g, venue, t) {
  cx.save();
  /* window band, upper left */
  cx.globalAlpha = 0.5;
  cx.fillStyle = "#d8d2c0";
  for (let i = 0; i < 5; i++) {
    cx.fillRect(W * (0.06 + i * 0.065), H * 0.10, W * 0.045, H * 0.13);
  }
  /* mullions */
  cx.globalAlpha = 0.8;
  cx.fillStyle = "#2a2620";
  for (let i = 0; i < 6; i++) {
    cx.fillRect(W * (0.05 + i * 0.065), H * 0.10, 3, H * 0.13);
  }
  cx.restore();
  /* window shafts raking right-down onto the mat */
  venuePaintLightShafts(cx, W, H, g, "rgba(255,244,214,$A)", [
    { x: 0.10, y: 0.10, tx: 0.34, ty: 0.30, a: 0.09, botW: 0.07, topW: 0.02 },
    { x: 0.20, y: 0.10, tx: 0.46, ty: 0.34, a: 0.07, botW: 0.06, topW: 0.02 }
  ]);
  /* hanging lamps */
  cx.save();
  const lamps = [0.38, 0.5, 0.62];
  for (let i = 0; i < lamps.length; i++) {
    const x = W * lamps[i];
    cx.strokeStyle = "#16130e";
    cx.lineWidth = 2;
    cx.globalAlpha = 0.9;
    cx.beginPath();
    cx.moveTo(x, 0);
    cx.lineTo(x, H * 0.075);
    cx.stroke();
    cx.fillStyle = "#3a3226";
    cx.beginPath();
    cx.moveTo(x - 11, H * 0.075);
    cx.lineTo(x + 11, H * 0.075);
    cx.lineTo(x + 6, H * 0.10);
    cx.lineTo(x - 6, H * 0.10);
    cx.closePath();
    cx.fill();
    cx.fillStyle = "#ffe9b0";
    cx.globalAlpha = 0.85;
    cx.beginPath();
    cx.arc(x, H * 0.105, 3.2, 0, Math.PI * 2);
    cx.fill();
  }
  cx.restore();
  /* slow dust motes in the shafts */
  const tt = venueNum(t, 0);
  cx.save();
  for (let i = 0; i < 18; i++) {
    const x = W * (0.10 + venueHash01(i, 41) * 0.45);
    const drift = (venueHash01(i, 43) * H * 0.30 + tt * 6) % (H * 0.34);
    const y = H * 0.08 + drift;
    cx.globalAlpha = 0.05 + venueHash01(i, 42) * 0.08;
    cx.fillStyle = "#fff";
    cx.fillRect(x, y, 1.4, 1.4);
  }
  cx.restore();
}

/* outdoor: star field + floodlights with glare + drifting rain */
function venueOutdoorDetail(cx, W, H, g, venue, t) {
  const tt = venueNum(t, 0);
  /* stars, top sky band only */
  cx.save();
  for (let i = 0; i < 60; i++) {
    const x = venueHash01(i, 51) * W;
    const y = venueHash01(i, 52) * H * 0.22;
    const tw = venueHash01(i, 53) * 6.28;
    const p = (Math.sin(tt * 0.8 + tw) + 1) * 0.5;
    cx.globalAlpha = 0.10 + p * 0.35;
    cx.fillStyle = "#dfeaff";
    const s = venueHash01(i, 54) > 0.85 ? 1.8 : 1.1;
    cx.fillRect(x, y, s, s);
  }
  cx.restore();
  /* floodlight towers */
  cx.save();
  for (let i = 0; i < 2; i++) {
    const x = W * (0.08 + i * 0.84);
    cx.globalAlpha = 0.9;
    cx.strokeStyle = "#1c2732";
    cx.lineWidth = 5;
    cx.beginPath();
    cx.moveTo(x, H * 0.02);
    cx.lineTo(x, H * 0.20);
    cx.stroke();
    cx.fillStyle = "#101820";
    cx.fillRect(x - 22, H * 0.02, 44, 14);
    /* lamp heads */
    for (let l = 0; l < 4; l++) {
      cx.fillStyle = "#eaf6ff";
      cx.beginPath();
      cx.arc(x - 15 + l * 10, H * 0.02 + 7, 3, 0, Math.PI * 2);
      cx.fill();
    }
    /* glare bloom */
    const gx = cx.createRadialGradient(x, H * 0.045, 0, x, H * 0.045, 46);
    gx.addColorStop(0, "rgba(200,230,255,.30)");
    gx.addColorStop(1, "rgba(200,230,255,0)");
    cx.fillStyle = gx;
    cx.fillRect(x - 46, 0, 92, H * 0.14);
  }
  cx.restore();
  /* flood shafts across the field */
  venuePaintLightShafts(cx, W, H, g, "rgba(180,220,255,$A)", [
    { x: 0.08, y: 0.04, tx: 0.40, ty: 0.35, a: 0.10, botW: 0.10, topW: 0.015 },
    { x: 0.92, y: 0.04, tx: 0.60, ty: 0.35, a: 0.10, botW: 0.10, topW: 0.015 }
  ]);
  /* drifting rain streaks */
  cx.save();
  cx.strokeStyle = "rgba(190,220,245,.16)";
  cx.lineWidth = 1;
  const n = 38;
  const fall = (tt * 260) % (H + 40);
  for (let i = 0; i < n; i++) {
    const x0 = venueHash01(i, 61) * W;
    const y0 = (venueHash01(i, 62) * H + fall * (0.7 + venueHash01(i, 63) * 0.6)) % (H + 40) - 20;
    cx.globalAlpha = 0.10 + venueHash01(i, 64) * 0.12;
    cx.beginPath();
    cx.moveTo(x0, y0);
    cx.lineTo(x0 - 4, y0 + 14);
    cx.stroke();
  }
  cx.restore();
}

/* heavens: god-ray fan from rear + red ember motes */
function venueHeavensDetail(cx, W, H, g, venue, t) {
  const tt = venueNum(t, 0);
  /* ray fan from a point above the ring */
  venueOverlay(cx, W, H, () => {
    const rx = W * 0.5, ry = -H * 0.05;
    for (let i = 0; i < 9; i++) {
      const f = (i - 4) / 4;
      const spread = W * (0.06 + Math.abs(f) * 0.10);
      const ex = rx + f * W * 0.42;
      const ey = g.farY + (g.nearY - g.farY) * 0.3;
      const a = 0.05 + (1 - Math.abs(f)) * 0.06;
      const grad = cx.createLinearGradient(rx, ry, ex, ey);
      grad.addColorStop(0, "rgba(255,120,100," + (a * 1.8).toFixed(3) + ")");
      grad.addColorStop(1, "rgba(255,120,100,0)");
      cx.fillStyle = grad;
      cx.beginPath();
      cx.moveTo(rx - 6, ry);
      cx.lineTo(rx + 6, ry);
      cx.lineTo(ex + spread, ey);
      cx.lineTo(ex - spread, ey);
      cx.closePath();
      cx.fill();
    }
  });
  /* rising embers */
  cx.save();
  for (let i = 0; i < 20; i++) {
    const x = W * (0.15 + venueHash01(i, 71) * 0.7);
    const rise = (venueHash01(i, 72) * H + tt * (14 + venueHash01(i, 73) * 22)) % (H * 0.75);
    const y = H * 0.78 - rise;
    const fl = (Math.sin(tt * 3 + i) + 1) * 0.5;
    cx.globalAlpha = 0.10 + fl * 0.25;
    cx.fillStyle = i % 3 ? "#ff7a5c" : "#ffd27a";
    const s = 1.2 + venueHash01(i, 74) * 1.6;
    cx.fillRect(x, y, s, s);
  }
  cx.restore();
}

/* broadcast: LED wall band + camera flash pops */
function venueBroadcastDetail(cx, W, H, g, venue, t) {
  const tt = venueNum(t, 0);
  /* LED band above the crowd */
  cx.save();
  const ledY = H * 0.16, ledH = H * 0.075;
  const lg = cx.createLinearGradient(0, ledY, W, ledY + ledH);
  lg.addColorStop(0, "rgba(30,80,120,.55)");
  lg.addColorStop(0.5, "rgba(60,160,200,.5)");
  lg.addColorStop(1, "rgba(30,80,120,.55)");
  cx.fillStyle = lg;
  cx.fillRect(W * 0.06, ledY, W * 0.88, ledH);
  /* chevron pulses travelling along the band */
  for (let i = 0; i < 14; i++) {
    const ph = (i / 14 + tt * 0.12) % 1;
    const x = W * 0.06 + ph * W * 0.88;
    cx.globalAlpha = 0.20 + 0.25 * Math.sin(ph * Math.PI);
    cx.fillStyle = "#bfeaff";
    cx.beginPath();
    cx.moveTo(x, ledY + ledH * 0.2);
    cx.lineTo(x + 7, ledY + ledH * 0.5);
    cx.lineTo(x, ledY + ledH * 0.8);
    cx.lineTo(x + 3, ledY + ledH * 0.5);
    cx.closePath();
    cx.fill();
  }
  cx.restore();
  /* cool key shafts */
  venuePaintLightShafts(cx, W, H, g, "rgba(140,220,255,$A)", [
    { x: 0.35, y: 0.0, tx: 0.44, ty: 0.22, a: 0.09, botW: 0.07 },
    { x: 0.65, y: 0.0, tx: 0.56, ty: 0.22, a: 0.09, botW: 0.07 }
  ]);
  /* camera flash pops - rare, bright, tiny, deterministic slots */
  cx.save();
  for (let i = 0; i < 5; i++) {
    const slot = Math.floor(tt * 1.3) + i * 977;
    const on = venueHash01(slot, 81 + i) > 0.72;
    if (!on) continue;
    const x = W * (0.1 + venueHash01(slot, 82 + i) * 0.8);
    const y = H * (0.06 + venueHash01(slot, 83 + i) * 0.22);
    const r = 3 + venueHash01(slot, 84 + i) * 5;
    const fg = cx.createRadialGradient(x, y, 0, x, y, r * 3);
    fg.addColorStop(0, "rgba(255,255,255,.85)");
    fg.addColorStop(0.3, "rgba(255,255,255,.25)");
    fg.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = fg;
    cx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    cx.globalAlpha = 0.9;
    cx.fillStyle = "#fff";
    cx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
  }
  cx.restore();
}

/* dispatcher: venue signature layer. Safe no-op for unknown ids. */
function venuePaintSignature(cx, W, H, g, venue, t) {
  const id = venue.id || "club";
  if (id === "club") venueClubDetail(cx, W, H, g, venue, t);
  else if (id === "gym") venueGymDetail(cx, W, H, g, venue, t);
  else if (id === "outdoor") venueOutdoorDetail(cx, W, H, g, venue, t);
  else if (id === "heavens") venueHeavensDetail(cx, W, H, g, venue, t);
  else if (id === "broadcast") venueBroadcastDetail(cx, W, H, g, venue, t);
}

/* ---- shared finishers -------------------------------------------- */

/* haze pools sitting on the mat surface, matching venue rim colour */
function venuePaintHaze(cx, W, H, g, venue, t) {
  const tt = venueNum(t, 0);
  cx.save();
  const pools = [
    { fx: 0.32, fy: 0.30, r: 0.16, drift: 0.008, ph: 0.0 },
    { fx: 0.62, fy: 0.55, r: 0.20, drift: 0.011, ph: 2.1 },
    { fx: 0.48, fy: 0.80, r: 0.24, drift: 0.006, ph: 4.2 }
  ];
  for (let i = 0; i < pools.length; i++) {
    const p = pools[i];
    const x = g.cx0 + (p.fx - 0.5) * (g.nearR - g.nearL) + Math.sin(tt * 0.3 + p.ph) * W * p.drift;
    const y = g.farY + (g.nearY - g.farY) * p.fy;
    const r = W * p.r;
    const hg = cx.createRadialGradient(x, y, 0, x, y, r);
    const rim = venue.rim || "rgba(255,255,255,.1)";
    hg.addColorStop(0, rim.replace(/[\d.]+\)$/, "0.05)"));
    hg.addColorStop(1, "rgba(0,0,0,0)");
    cx.globalAlpha = 0.5;
    cx.fillStyle = hg;
    cx.fillRect(x - r, y - r * 0.5, r * 2, r);
  }
  cx.restore();
}

/* vignette corners, always last before UI */
function venuePaintVignette(cx, W, H, strength) {
  const s = strength == null ? 0.55 : strength;
  if (s <= 0.001) return;
  const corners = [
    { x: 0, y: 0 }, { x: W, y: 0 }, { x: 0, y: H }, { x: W, y: H }
  ];
  cx.save();
  for (let i = 0; i < 4; i++) {
    const c = corners[i];
    const r = Math.max(W, H) * 0.62;
    const vg = cx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    vg.addColorStop(0, "rgba(0,0,0," + (s * 0.55).toFixed(3) + ")");
    vg.addColorStop(1, "rgba(0,0,0,0)");
    cx.fillStyle = vg;
    cx.fillRect(0, 0, W, H);
  }
  cx.restore();
}
function venuePaintVoid(cx, W, H, venue) {
  const g = cx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, venue.voidTop);
  g.addColorStop(1, venue.voidBot);
  cx.fillStyle = g;
  cx.fillRect(0, 0, W, H);
  /* outdoor gets a cooler sky band across the top third */
  if (venue.id === "outdoor") {
    const sky = cx.createLinearGradient(0, 0, 0, H * 0.38);
    sky.addColorStop(0, "rgba(70,110,160,.22)");
    sky.addColorStop(1, "rgba(70,110,160,0)");
    cx.fillStyle = sky;
    cx.fillRect(0, 0, W, H * 0.38);
  }
}

function venuePaintCrowd(cx, W, H, venue, crowdA) {
  const a = venueClamp01(crowdA);
  if (a <= 0.001) return;
  const band = Math.min(190, H * 0.36);
  const base = venue.crowd || "rgba(255,236,190,1)";
  /* strip the trailing alpha from "rgba(r,g,b,1)" if present, rebuild */
  const rgb = base.replace(/\s*,\s*[\d.]+\s*\)\s*$/, ")");
  const col = rgb.indexOf("rgba") === 0
    ? rgb.replace(/\)$/, "," + a.toFixed(3) + ")")
    : base;
  const cg = cx.createLinearGradient(0, 0, 0, band);
  cg.addColorStop(0, col);
  cg.addColorStop(1, "rgba(0,0,0,0)");
  cx.fillStyle = cg;
  cx.fillRect(0, 0, W, band);
  /* subtle vertical stands suggestion - low alpha rects */
  cx.save();
  cx.globalAlpha = Math.min(0.22, a * 0.55);
  cx.fillStyle = venue.rim || "rgba(255,255,255,.12)";
  const n = 18;
  const gap = W / n;
  for (let i = 0; i < n; i++) {
    const x = i * gap + gap * 0.35;
    cx.fillRect(x, 8, Math.max(2, gap * 0.18), band * 0.72);
  }
  cx.restore();
}

function venuePaintMat(cx, g, venue) {
  const mg = cx.createLinearGradient(0, g.farY, 0, g.nearY);
  mg.addColorStop(0, venue.matTop);
  mg.addColorStop(1, venue.matBot);
  cx.beginPath();
  cx.moveTo(g.farL, g.farY);
  cx.lineTo(g.farR, g.farY);
  cx.lineTo(g.nearR, g.nearY);
  cx.lineTo(g.nearL, g.nearY);
  cx.closePath();
  cx.fillStyle = mg;
  cx.fill();
  /* centre circle suggestion - very light */
  cx.save();
  cx.globalAlpha = 0.14;
  cx.strokeStyle = venue.rim || "#fff";
  cx.lineWidth = 1.5;
  const midY = (g.farY + g.nearY) * 0.55;
  const rx = (g.nearR - g.nearL) * 0.12;
  const ry = (g.nearY - g.farY) * 0.12;
  cx.beginPath();
  cx.ellipse(g.cx0, midY, rx, ry, 0, 0, Math.PI * 2);
  cx.stroke();
  cx.restore();
  /* worn gym: soft blotches on the mat */
  if (venue.id === "gym") {
    cx.save();
    cx.globalAlpha = 0.08;
    cx.fillStyle = "#5a4030";
    cx.beginPath();
    cx.ellipse(g.cx0 - 40, midY + 20, 50, 18, 0.2, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.ellipse(g.cx0 + 70, midY - 10, 36, 14, -0.3, 0, Math.PI * 2);
    cx.fill();
    cx.restore();
  }
}

function venuePaintRopes(cx, g, venue, sway, pos) {
  const s = venueClamp01(sway == null ? 0 : sway);
  const rows = [0.08, 0.22, 0.38, 0.55];
  const posBias = pos === "CORNER" ? 1.4 : (pos === "ROPES" ? 1.0 : 0.35);
  cx.save();
  cx.strokeStyle = venue.rope;
  cx.lineCap = "round";
  for (let i = 0; i < rows.length; i++) {
    const u = rows[i];
    const y = venueApronY(g, u) + Math.sin((i + 1) * 1.7 + s * 6.2) * s * 2.2 * posBias;
    const xL = venueApronX(g, "L", u);
    const xR = venueApronX(g, "R", u);
    cx.lineWidth = 2.2 - i * 0.25;
    cx.globalAlpha = 0.78 - i * 0.06;
    cx.beginPath();
    cx.moveTo(xL, y);
    /* slight belly in the middle so ropes feel strung, not lasered */
    const midX = (xL + xR) * 0.5;
    const belly = (1 + s * 2.5) * (1.2 + i * 0.35) * posBias;
    cx.quadraticCurveTo(midX, y + belly, xR, y);
    cx.stroke();
  }
  cx.restore();
  /* corner posts */
  const postW = 7;
  const postH = (g.nearY - g.farY) * 0.62;
  const posts = [
    { x: g.farL - 2, y: g.farY - postH * 0.15, c: venue.postL },
    { x: g.farR - postW + 2, y: g.farY - postH * 0.15, c: venue.postR },
    { x: g.nearL - 4, y: g.nearY - postH * 0.85, c: venue.postL },
    { x: g.nearR - postW + 4, y: g.nearY - postH * 0.85, c: venue.postR }
  ];
  for (let p = 0; p < posts.length; p++) {
    const pt = posts[p];
    cx.fillStyle = pt.c;
    cx.fillRect(pt.x, pt.y, postW, postH * 0.9);
    cx.fillStyle = venue.rope;
    cx.fillRect(pt.x - 1, pt.y - 4, postW + 2, 5);
  }
}

function venuePaintGel(cx, W, H, venue) {
  if (!venue.gel) return;
  cx.fillStyle = venue.gel;
  cx.fillRect(0, 0, W, H);
}

function venuePaintScrim(cx, W, H, venue) {
  const stops = venue.scrim;
  if (!stops || !stops.length) return;
  const sc = cx.createLinearGradient(0, 0, 0, H);
  for (let i = 0; i < stops.length; i++) {
    sc.addColorStop(venueClamp01(stops[i].t), stops[i].c);
  }
  cx.fillStyle = sc;
  cx.fillRect(0, 0, W, H);
}

function venuePaintSpot(cx, W, H, spot) {
  if (!spot) return;
  const x = venueNum(spot.x, W * 0.5);
  const r = Math.max(1, venueNum(spot.r, 160));
  const pulse = venueNum(spot.pulse, 0);
  const rr = r * (1 + pulse);
  const sg = cx.createRadialGradient(x, H * 0.55, 0, x, H * 0.55, rr);
  sg.addColorStop(0, "rgba(232,230,225,.16)");
  sg.addColorStop(1, "rgba(232,230,225,0)");
  cx.fillStyle = sg;
  cx.fillRect(0, 0, W, H);
}

function venuePaintDim(cx, W, H, dim) {
  const d = venueClamp01(dim);
  if (d <= 0.001) return;
  cx.fillStyle = "rgba(3,4,6," + (d * 0.9).toFixed(3) + ")";
  cx.fillRect(0, 0, W, H);
}

function venuePaintBloom(cx, W, H, colour, intensity) {
  const a = venueClamp01(intensity == null ? 0.12 : intensity);
  if (a <= 0.01) return;
  cx.save();
  cx.globalCompositeOperation = "screen";
  const g = cx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.65);
  g.addColorStop(0, colour.replace("$A", (a * 1.2).toFixed(3)));
  g.addColorStop(0.5, colour.replace("$A", (a * 0.35).toFixed(3)));
  g.addColorStop(1, colour.replace("$A", "0"));
  cx.fillStyle = g;
  cx.fillRect(0, 0, W, H);
  cx.restore();
}

function venuePaintReflection(cx, W, H, yBase, alpha) {
  const a = venueClamp01(alpha == null ? 0.08 : alpha);
  if (a <= 0.01) return;
  cx.save();
  cx.globalAlpha = a;
  cx.fillStyle = "rgba(255,255,255,.03)";
  cx.beginPath();
  cx.ellipse(W * 0.5, yBase, W * 0.18, W * 0.045, 0, 0, Math.PI * 2);
  cx.fill();
  cx.restore();
}

function venueArenaReady(img) {
  return !!(img && img.complete && img.naturalWidth > 0);
}

/* ---------------------------------------------------------------------
   paintVenue(cx, W, H, venue, opts)

   Draws the full duel backdrop. opts:

     arenaImage  Image ready for drawImage - painted full frame first,
                 then venue-tinted scrim (ARENA_SRC path)
     boss        extra red wash on top of gel (even if skin is not heavens)
     dim         0..1 house-lights down
     spot        {x, r, pulse} soft radial
     crowdA      0..1 stands band strength
     pos         "CENTRE" | "ROPES" | "CORNER" - rope belly / sway bias
     ropeSway    0..1 rope motion

   Layer order:
     1. void (or arena image + scrim)
     2. crowd band
     3. mat trapezoid
     4. ropes + posts
     5. gel (+ optional boss wash)
     6. dim, spot
   --------------------------------------------------------------------- */
function paintVenue(cx, W, H, venue, opts) {
  if (!cx) return;
  const v = venueOf(venue);
  const o = opts || {};
  const w = venueNum(W, 960);
  const h = venueNum(H, 540);
  const g = venueMatGeom(w, h);

  if (venueArenaReady(o.arenaImage)) {
    cx.drawImage(o.arenaImage, 0, 0, w, h);
    venuePaintScrim(cx, w, h, v);
  } else {
    venuePaintVoid(cx, w, h, v);
  }

  const crowdA = o.crowdA == null ? 0.12 : venueNum(o.crowdA, 0);
  venuePaintCrowd(cx, w, h, v, crowdA);
  venuePaintCrowdPeople(cx, w, h, v, venueNum(o.t, 0), crowdA);

  /* signature architecture + atmosphere above the crowd, under the ring */
  venuePaintSignature(cx, w, h, g, v, venueNum(o.t, 0));
  venuePaintHaze(cx, w, h, g, v, venueNum(o.t, 0));

  /* when an arena image is present the mat/ropes are still drawn lightly
     so the skin reads without fighting the photo */
  cx.save();
  if (venueArenaReady(o.arenaImage)) cx.globalAlpha = 0.42;
  venuePaintMat(cx, g, v);
  venuePaintRopes(cx, g, v, o.ropeSway, o.pos || "CENTRE");
  cx.restore();

  venuePaintGel(cx, w, h, v);
  if (o.boss && v.id !== "heavens") {
    cx.fillStyle = "rgba(120,10,20,.14)";
    cx.fillRect(0, 0, w, h);
  }
  /* rim wash along the apron for broadcast / club cool edge */
  if (v.rim) {
    cx.save();
    cx.globalAlpha = 0.55;
    const rg = cx.createLinearGradient(0, g.farY, 0, g.nearY);
    rg.addColorStop(0, v.rim);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    cx.fillStyle = rg;
    cx.fillRect(0, g.farY - 20, w, (g.nearY - g.farY) * 0.35);
    cx.restore();
  }
  venuePaintDim(cx, w, h, o.dim);
  venuePaintSpot(cx, w, h, o.spot);
  venuePaintBloom(cx, w, h, v.rim || "rgba(120,180,220,$A)", 0.18);
  venuePaintReflection(cx, w, h, g.nearY - 4, 0.10);
  venuePaintVignette(cx, w, h, o.vignette);
}

/* ---------------------------------------------------------------------
   paintTitleAtmosphere(cx, W, H, venue, opts)

   Shared title / menu backdrop. Same void + floor language as the duel,
   but no full ring: soft spotlight, two subdued side wedges, a floor
   plane. opts may carry dim, spot, crowdA (usually low).
   --------------------------------------------------------------------- */
function paintTitleAtmosphere(cx, W, H, venue, opts) {
  if (!cx) return;
  const v = venueOf(venue);
  const o = opts || {};
  const w = venueNum(W, 960);
  const h = venueNum(H, 540);

  venuePaintVoid(cx, w, h, v);

  /* two side wedges - same idea as the old rTitle wedges, subdued */
  cx.save();
  cx.globalAlpha = 0.05;
  cx.fillStyle = "#ffffff";
  cx.beginPath();
  cx.moveTo(w * 0.19, 0);
  cx.lineTo(w * 0.45, h);
  cx.lineTo(w * 0.08, h);
  cx.closePath();
  cx.fill();
  cx.beginPath();
  cx.moveTo(w * 0.81, 0);
  cx.lineTo(w * 0.94, h);
  cx.lineTo(w * 0.58, h);
  cx.closePath();
  cx.fill();
  cx.restore();

  /* floor plane - simple perspective band, not a full mat */
  const floorTop = h * 0.62;
  const fg = cx.createLinearGradient(0, floorTop, 0, h);
  fg.addColorStop(0, "rgba(0,0,0,0)");
  fg.addColorStop(0.35, v.matBot);
  fg.addColorStop(1, v.voidBot);
  cx.save();
  cx.globalAlpha = 0.55;
  cx.fillStyle = fg;
  cx.beginPath();
  cx.moveTo(w * 0.18, floorTop);
  cx.lineTo(w * 0.82, floorTop);
  cx.lineTo(w * 1.02, h);
  cx.lineTo(w * -0.02, h);
  cx.closePath();
  cx.fill();
  cx.restore();

  /* soft horizon line */
  cx.fillStyle = "rgba(255,255,255,.05)";
  cx.fillRect(0, floorTop, w, 2);

  venuePaintGel(cx, w, h, v);
  const crowdA = o.crowdA == null ? 0.06 : venueNum(o.crowdA, 0);
  venuePaintCrowd(cx, w, h, v, crowdA);
  venuePaintCrowdPeople(cx, w, h, v, venueNum(o.t, 0), crowdA);
  venuePaintSignature(cx, w, h, venueMatGeom(w, h), v, venueNum(o.t, 0));

  const spot = o.spot || { x: w * 0.5, r: Math.min(w, h) * 0.42, pulse: 0 };
  venuePaintSpot(cx, w, h, spot);
  venuePaintBloom(cx, w, h, "rgba(120,180,220,$A)", 0.14);
  venuePaintDim(cx, w, h, o.dim);
  venuePaintVignette(cx, w, h, o.vignette == null ? 0.4 : o.vignette);
}

/* ---------------------------------------------------------------------
   Self-check - functions the page must call (concatenated globals):

     VENUES
     pickVenue
     venueOf
     venueId
     fighterGradeFilter
     venueMatGeom
     paintVenue
     paintTitleAtmosphere

   Pure (no canvas): VENUES, pickVenue, venueOf, venueId,
   fighterGradeFilter, venueMatGeom.
   Paint (need cx):  paintVenue, paintTitleAtmosphere.
   ===================================================================== */
