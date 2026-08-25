/* =====================================================================
   Aqua Zero Heavens Arena - spectacle paint helpers
   Luminara Digital

   anim.js owns motion intent as numbers only. This file owns the cheap
   paint that sells impact once those numbers have already decided what
   happened: sparks, dust squares, contact shadows, mat rims, and a KO
   camera punch. Callers push into a particle list during duel resolve,
   step the list each frame, and paint when they have a canvas context.

   Unlike anim.js this module MAY draw when given `cx`. It still keeps
   list mutation and paint separate so a test can assert burst counts
   without touching pixels, and a reduced-motion path can skip paint
   entirely while still resolving the turn.

   Particle entries are plain objects:
     { x, y, vx, vy, l, c, kind }
   where l is remaining life in frames, c is a CSS colour string, and
   kind is "spark" (thin line) or "dust" (soft square). No emoji, no
   images, no DOM.

   Globals assumed: none required at load. Optional Math.random only;
   pass nothing special. Safe to load anywhere in MODULE_ORDER.
   ===================================================================== */

/* ---------------------------------------------------------------------
   SPECTACLE_CONFIG - counts, colours, and fade rates in one place.
   Speeds are pixels per frame at the 960x540 duel canvas.
   --------------------------------------------------------------------- */
const SPECTACLE_CONFIG = {
  /* default burst when callers omit n / speed */
  burst: { n: 10, speed: 3.2, life: 22, gravity: 0.12, drag: 0.96 },

  /* per impact kind: count, colour, speed, life, particle kind mix */
  impact: {
    strike: { n: 14, colour: "#ffcf6a", speed: 4.2, life: 24, spark: 0.75 },
    kick:   { n: 18, colour: "#d97b3a", speed: 5.0, life: 26, spark: 0.55 },
    throw:  { n: 16, colour: "#8b7a63", speed: 2.8, life: 32, spark: 0.15 },
    sub:    { n:  6, colour: "#9b8cff", speed: 1.0, life: 36, spark: 0.20 },
    block:  { n: 10, colour: "#9be89b", speed: 4.6, life: 14, spark: 0.85 },
    ko:     { n: 28, colour: "#e03a2f", speed: 6.4, life: 34, spark: 0.70 },
  },

  /* soft floor ellipse under a fighter */
  shadow: { ryMul: 0.18, fill: "rgba(0,0,0," },

  /* venue rim sits slightly outside the contact shadow */
  rim: { pad: 10, ryMul: 0.22 },

  /* KO camera punch magnitude (pixels of shake boost) */
  koPunch: { shake: 18 },
};

/* ---------------------------------------------------------------------
   spectacleBurst - push n particle-like entries into `list`.
   Entries: { x, y, vx, vy, l, c, kind }.
   --------------------------------------------------------------------- */
function spectacleBurst(list, x, y, color, n, speed) {
  if (!list) return 0;
  const B = SPECTACLE_CONFIG.burst;
  const count = Math.max(0, Math.round(n === undefined ? B.n : n));
  const sp = speed === undefined ? B.speed : speed;
  const col = color || "#ffcf6a";
  let added = 0;
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / Math.max(1, count) + (Math.random() - 0.5) * 0.55;
    const mag = sp * (0.55 + Math.random() * 0.75);
    const isSpark = Math.random() > 0.35;
    list.push({
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      vx: Math.cos(ang) * mag,
      vy: Math.sin(ang) * mag - Math.random() * sp * 0.35,
      l: B.life * (0.7 + Math.random() * 0.5),
      c: col,
      kind: isSpark ? "spark" : "dust",
    });
    added++;
  }
  return added;
}

/* ---------------------------------------------------------------------
   spectacleStep - age and move particles; splice out the dead.
   Mutates `list` in place. Safe on empty / null.
   --------------------------------------------------------------------- */
function spectacleStep(list) {
  if (!list || !list.length) return;
  const B = SPECTACLE_CONFIG.burst;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.l -= 1;
    if (p.l <= 0) { list.splice(i, 1); continue; }
    p.x += p.vx;
    p.y += p.vy;
    p.vy += B.gravity;
    p.vx *= B.drag;
    p.vy *= B.drag;
  }
}

/* ---------------------------------------------------------------------
   spectaclePaint - draw sparks (thin strokes) and dust (soft squares).
   No-ops without a usable canvas context.
   --------------------------------------------------------------------- */
function spectaclePaint(cx, list) {
  if (!cx || !list || !list.length) return;
  // Wrap so fillStyle/strokeStyle/lineWidth/globalAlpha set below don't leak
  // into whatever the caller draws next this frame.
  cx.save();
  const lifeMax = SPECTACLE_CONFIG.burst.life;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const a = Math.max(0, Math.min(1, p.l / lifeMax));
    cx.globalAlpha = a;
    cx.fillStyle = p.c;
    cx.strokeStyle = p.c;
    if (p.kind === "spark" || p.kind === "streak") {
      const len = p.kind === "streak" ? 2.2 : 0.6;
      const width = p.kind === "streak" ? 2.2 : 1 + a;
      cx.beginPath();
      cx.moveTo(p.x, p.y);
      cx.lineTo(p.x - p.vx * len, p.y - p.vy * len);
      cx.lineWidth = width;
      cx.stroke();
      cx.fillRect(p.x - 0.6, p.y - 0.6, 1.2, 1.2);
    } else if (p.kind === "glow") {
      const s = 2 + a * 5;
      const g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
      g.addColorStop(0, p.c);
      g.addColorStop(1, "rgba(0,0,0,0)");
      cx.fillStyle = g;
      cx.beginPath();
      cx.arc(p.x, p.y, s, 0, Math.PI * 2);
      cx.fill();
    } else {
      const s = 2 + a * 4;
      cx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
    }
  }
  cx.restore();
}

/* ---------------------------------------------------------------------
   spectacleImpact - kinded burst for duel resolve paint.
   kind: strike | kick | throw | sub | block | ko
   `facing` (+1 left / -1 right) biases horizontal velocity toward the
   hit direction so the spray reads with the shot, not against it.
   --------------------------------------------------------------------- */
function spectacleImpact(list, kind, x, y, facing) {
  if (!list) return 0;
  const table = SPECTACLE_CONFIG.impact;
  const spec = table[kind] || table.strike;
  const fx = facing === undefined ? 1 : (facing < 0 ? -1 : 1);
  let added = 0;
  for (let i = 0; i < spec.n; i++) {
    const cone = (Math.random() - 0.5) * Math.PI * 0.9;
    const ang = (fx > 0 ? 0 : Math.PI) + cone;
    const mag = spec.speed * (0.5 + Math.random() * 0.8);
    const roll = Math.random();
    let kindOut = "dust";
    if (roll < spec.spark * 0.65) kindOut = "spark";
    else if (roll < spec.spark) kindOut = "streak";
    list.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: Math.cos(ang) * mag,
      vy: Math.sin(ang) * mag * 0.55 - Math.random() * spec.speed * 0.4,
      l: spec.life * (0.65 + Math.random() * 0.55),
      c: spec.colour,
      kind: kindOut,
    });
    added++;
  }
  /* a soft glow core for heavier impacts */
  if (kind === "ko" || kind === "kick" || kind === "throw") {
    list.push({ x: x, y: y, vx: 0, vy: 0, l: spec.life * 0.6, c: spec.colour, kind: "glow" });
  }
  /* KO gets a second dust ring so the finish reads heavier than a strike */
  if (kind === "ko") {
    added += spectacleBurst(list, x, y + 8, SPECTACLE_CONFIG.impact.throw.colour,
                            10, 2.4);
  }
  return added;
}

/* ---------------------------------------------------------------------
   paintContactShadow - soft ellipse under a fighter at (x, baseY).
   --------------------------------------------------------------------- */
function paintContactShadow(cx, x, baseY, width, alpha) {
  if (!cx) return;
  const w = Math.max(4, width || 40);
  const a = alpha === undefined ? 0.35 : alpha;
  if (a <= 0) return;
  const ry = w * SPECTACLE_CONFIG.shadow.ryMul;
  cx.save();
  cx.beginPath();
  cx.ellipse(x, baseY, w * 0.5, ry, 0, 0, Math.PI * 2);
  cx.fillStyle = SPECTACLE_CONFIG.shadow.fill + a + ")";
  cx.fill();
  cx.restore();
}

/* ---------------------------------------------------------------------
   paintMatRim - subtle rim ellipse matching venueRim colour.
   venueRim may be a CSS colour string or { colour / color, alpha }.
   --------------------------------------------------------------------- */
function paintMatRim(cx, x, baseY, venueRim, alpha) {
  if (!cx) return;
  let col = "#6a5a48";
  let a = alpha === undefined ? 0.22 : alpha;
  let pad = SPECTACLE_CONFIG.rim.pad;
  if (typeof venueRim === "string") {
    col = venueRim;
  } else if (venueRim && typeof venueRim === "object") {
    col = venueRim.colour || venueRim.color || col;
    if (venueRim.alpha !== undefined && alpha === undefined) a = venueRim.alpha;
    if (venueRim.pad !== undefined) pad = venueRim.pad;
  }
  if (a <= 0) return;
  const rx = 48 + pad;
  const ry = rx * SPECTACLE_CONFIG.rim.ryMul;
  cx.save();
  cx.beginPath();
  cx.ellipse(x, baseY, rx, ry, 0, 0, Math.PI * 2);
  cx.strokeStyle = col;
  cx.globalAlpha = a;
  cx.lineWidth = 1.5;
  cx.stroke();
  cx.restore();
}

/* ---------------------------------------------------------------------
   koPunch - shake boost for KO moments.
   If `shakeRef` is an object with a numeric `shake` (or `mag`) field,
   that field is increased in place and the new value is returned.
   Otherwise returns the baseline KO shake magnitude for the caller to
   apply.
   --------------------------------------------------------------------- */
function koPunch(shakeRef) {
  const boost = SPECTACLE_CONFIG.koPunch.shake;
  if (shakeRef && typeof shakeRef === "object") {
    if (typeof shakeRef.shake === "number") {
      shakeRef.shake += boost;
      return shakeRef.shake;
    }
    if (typeof shakeRef.mag === "number") {
      shakeRef.mag += boost;
      return shakeRef.mag;
    }
    shakeRef.shake = boost;
    return boost;
  }
  return boost;
}

/* ---------------------------------------------------------------------
   spectaclePop - floating damage text popup entry.
   --------------------------------------------------------------------- */
function spectaclePop(list, x, y, text, color, isCrit) {
  if (!list) return null;
  const pop = {
    x: x + (Math.random() - 0.5) * 24,
    y: y + (Math.random() - 0.5) * 16,
    vy: -2.2,
    text: String(text),
    color: color || "#e03a2f",
    life: 48,
    maxLife: 48,
    isCrit: !!isCrit,
  };
  list.push(pop);
  return pop;
}

function spectacleStepPops(list) {
  if (!list || !list.length) return;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life--;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.y += p.vy;
    p.vy *= 0.94;
  }
}

function spectaclePaintPops(cx, list) {
  if (!cx || !list || !list.length) return;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const alpha = Math.min(1, p.life / 12);
    const progress = 1 - (p.life / p.maxLife);
    const baseScale = p.isCrit ? 1.45 : 1.15;
    const popScale = progress < 0.14 ? 0.6 + (progress / 0.14) * (baseScale - 0.6) : baseScale;

    cx.save();
    cx.globalAlpha = alpha;
    const fontSize = Math.round(26 * popScale);
    cx.font = (p.isCrit ? "900 " : "700 ") + fontSize + "px 'Trebuchet MS', Arial, sans-serif";
    cx.textAlign = "center";
    cx.textBaseline = "middle";

    /* Heavy dark stroke for pop outline */
    cx.strokeStyle = "rgba(5, 6, 9, 0.9)";
    cx.lineWidth = Math.max(3, Math.round(fontSize * 0.18));
    cx.strokeText(p.text, p.x, p.y);

    cx.fillStyle = p.color;
    cx.fillText(p.text, p.x, p.y);
    cx.restore();
  }
}

