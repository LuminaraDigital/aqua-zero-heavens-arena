/* =====================================================================
   Aqua Zero Heavens Arena - spectacle paint & attack VFX engine
   Luminara Digital

   anim.js owns motion intent as numbers only. This file owns the visual
   effects and impact juice that sells combat once those numbers have
   decided what happened: procedural attack VFX (slashes, starbursts,
   rising plumes, ground shockwaves, joint lock rings, flurry crosses,
   and super auras), geometric hit sparks, status auras,
   contact shadows, mat rims, and floating damage numbers.

   Callers push into particle / VFX lists during duel resolve, step the
   lists each frame, and paint when they have a canvas context.

   Unlike anim.js this module MAY draw when given `cx`. It still keeps
   list mutation and paint separate so tests can assert burst counts
   and VFX without touching pixels, and a reduced-motion path can skip
   paint entirely while still resolving the turn.

   VFX / Particle entries are plain objects:
     { x, y, vx, vy, l, maxLife, c, kind, ... }
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

  /* Martial Arts Attack Visual FX parameters */
  vfx: {
    slash:     { life: 16, radBase: 48, arcBase: 1.45, colour: "#ffcf6a", core: "#ffffff" },
    starburst: { life: 14, rInner: 10, rOuter: 36, points: 7, colour: "#ff7b3a", core: "#fff7d6" },
    plume:     { life: 20, height: 65, width: 28, colour: "#22d3ee", core: "#e0f2fe" },
    shockwave: { life: 22, maxRx: 75, ryMul: 0.24, colour: "#f59e0b" },
    lockRings: { life: 24, radStart: 42, count: 3, colour: "#c084fc" },
    flurry:    { life: 15, size: 34, colour: "#fbbf24" },
    super:     { life: 28, rays: 12, maxR: 120, colour: "#f59e0b", core: "#ffffff" }
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
    const life = B.life * (0.7 + Math.random() * 0.5);
    list.push({
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      vx: Math.cos(ang) * mag,
      vy: Math.sin(ang) * mag - Math.random() * sp * 0.35,
      l: life,
      maxLife: life,
      c: col,
      kind: isSpark ? "spark" : "dust",
    });
    added++;
  }
  return added;
}

/* ---------------------------------------------------------------------
   spectacleStep - age and move particles/VFX; splice out the dead.
   --------------------------------------------------------------------- */
function spectacleStep(list) {
  if (!list || !list.length) return;
  const B = SPECTACLE_CONFIG.burst;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.l -= 1;
    if (p.l <= 0) { list.splice(i, 1); continue; }

    if (p.kind === "slashTrail") {
      p.radius = (p.radius || 40) + (p.dr || 1.2);
      p.arcLen = (p.arcLen || 1.2) * 0.94;
    } else if (p.kind === "starburst") {
      p.rOuter = (p.rOuter || 30) + 1.6;
      p.rot = (p.rot || 0) + (p.rotSpd || 0.04);
    } else if (p.kind === "risingPlume") {
      p.y += p.vy || -3.2;
      p.height = (p.height || 50) + 1.8;
      p.width = (p.width || 20) * 0.96;
    } else if (p.kind === "groundShockwave") {
      p.rx = (p.rx || 10) + 4.2;
      p.ry = p.rx * (p.ryMul || 0.22);
    } else if (p.kind === "lockRings") {
      p.r = Math.max(4, (p.r || 30) - 1.3);
      p.rot = (p.rot || 0) + 0.06;
    } else if (p.kind === "flurryCross") {
      p.size = (p.size || 25) + 0.8;
    } else if (p.kind === "superBurst") {
      p.r = (p.r || 10) + 5.2;
      p.rot = (p.rot || 0) + 0.03;
    } else if (p.kind === "hitSparkBlade") {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.len = (p.len || 12) * 0.94;
    } else if (p.kind === "electric") {
      p.x += (Math.random() - 0.5) * 4;
      p.y += (Math.random() - 0.5) * 4;
    } else if (p.kind === "bleed") {
      p.y += p.vy || 1.8;
      p.vy = (p.vy || 1.8) + 0.12;
      p.x += (p.vx || 0);
    } else if (p.kind === "stun") {
      p.angle = (p.angle || 0) + 0.18;
      p.x = p.cx + Math.cos(p.angle) * p.rx;
      p.y = p.cy + Math.sin(p.angle) * p.ry;
    } else if (p.kind === "steam") {
      p.y += p.vy || -1.2;
      p.x += (Math.random() - 0.5) * 0.6;
      p.size = (p.size || 4) + 0.15;
    } else if (p.kind === "ember") {
      p.y += p.vy || -1.8;
      p.x += p.vx || (Math.random() - 0.5) * 0.8;
      p.vx = (p.vx || 0) * 0.95;
    } else {
      // Standard particle update
      p.x += p.vx;
      p.y += p.vy;
      p.vy += B.gravity;
      p.vx *= B.drag;
      p.vy *= B.drag;
    }
  }
}

/* ---------------------------------------------------------------------
   spectaclePaint - draw sparks, attack VFX, and status overlays.
   --------------------------------------------------------------------- */
function spectaclePaint(cx, list) {
  if (!cx || !list || !list.length) return;
  cx.save();
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const maxL = p.maxLife || SPECTACLE_CONFIG.burst.life;
    const a = Math.max(0, Math.min(1, p.l / maxL));
    if (a <= 0) continue;

    cx.save();
    cx.globalAlpha = a;

    if (p.kind === "slashTrail") {
      // Curved crescent slash trail (Kicks / Roundhouses)
      const r = p.radius || 48;
      const startAng = p.ang - (p.arcLen || 1.4) * 0.5;
      const endAng = p.ang + (p.arcLen || 1.4) * 0.5;
      
      cx.beginPath();
      cx.arc(p.x, p.y, r, startAng, endAng);
      cx.strokeStyle = p.c || "#ffcf6a";
      cx.lineWidth = Math.max(2, 6 * a);
      cx.lineCap = "round";
      cx.stroke();

      // Hot core line
      cx.beginPath();
      cx.arc(p.x, p.y, r, startAng + 0.15, endAng - 0.15);
      cx.strokeStyle = p.core || "#ffffff";
      cx.lineWidth = Math.max(1, 2.5 * a);
      cx.stroke();

    } else if (p.kind === "starburst") {
      // Comic impact starburst (Heavy Punches / Crosses)
      const pts = p.points || 7;
      const rIn = p.rInner || 8;
      const rOut = (p.rOuter || 32) * a;
      const rot = p.rot || 0;

      cx.translate(p.x, p.y);
      cx.rotate(rot);
      cx.beginPath();
      for (let j = 0; j < pts * 2; j++) {
        const rad = (j % 2 === 0) ? rOut : rIn;
        const ang = (j * Math.PI) / pts;
        const sx = Math.cos(ang) * rad;
        const sy = Math.sin(ang) * rad;
        if (j === 0) cx.moveTo(sx, sy);
        else cx.lineTo(sx, sy);
      }
      cx.closePath();
      cx.fillStyle = p.c || "#ff7b3a";
      cx.fill();

      // Inner diamond core
      cx.fillStyle = p.core || "#ffffff";
      cx.beginPath();
      cx.arc(0, 0, rIn * 0.8, 0, Math.PI * 2);
      cx.fill();

    } else if (p.kind === "risingPlume") {
      // Vertical launcher plume (Uppercuts / Flying Knees)
      const h = (p.height || 60) * a;
      const w = (p.width || 24) * a;
      const grad = cx.createLinearGradient(p.x, p.y + 10, p.x, p.y - h);
      grad.addColorStop(0, p.c || "#22d3ee");
      grad.addColorStop(0.6, p.core || "#ffffff");
      grad.addColorStop(1, "rgba(255,255,255,0)");

      cx.fillStyle = grad;
      cx.beginPath();
      cx.moveTo(p.x - w * 0.5, p.y);
      cx.quadraticCurveTo(p.x - w * 0.3, p.y - h * 0.6, p.x, p.y - h);
      cx.quadraticCurveTo(p.x + w * 0.3, p.y - h * 0.6, p.x + w * 0.5, p.y);
      cx.closePath();
      cx.fill();

    } else if (p.kind === "groundShockwave") {
      // Mat impact shockwave (Takedowns / Slams / Throws)
      const rx = p.rx || 40;
      const ry = p.ry || 10;
      cx.beginPath();
      cx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      cx.strokeStyle = p.c || "#f59e0b";
      cx.lineWidth = Math.max(1, 4 * a);
      cx.stroke();

      // Secondary dust rim
      cx.beginPath();
      cx.ellipse(p.x, p.y, rx * 0.7, ry * 0.7, 0, 0, Math.PI * 2);
      cx.strokeStyle = "#8b7a63";
      cx.lineWidth = Math.max(1, 2 * a);
      cx.stroke();

    } else if (p.kind === "lockRings") {
      // Submission joint lock constriction rings
      const r = p.r || 24;
      const rot = p.rot || 0;
      cx.translate(p.x, p.y);
      cx.rotate(rot);
      cx.strokeStyle = p.c || "#c084fc";
      cx.lineWidth = 2.2;
      cx.beginPath();
      cx.arc(0, 0, r, 0, Math.PI * 2);
      cx.stroke();

      // Kinetic cross notches
      for (let k = 0; k < 4; k++) {
        const ka = (k * Math.PI) / 2;
        cx.beginPath();
        cx.moveTo(Math.cos(ka) * (r - 5), Math.sin(ka) * (r - 5));
        cx.lineTo(Math.cos(ka) * (r + 5), Math.sin(ka) * (r + 5));
        cx.stroke();
      }

    } else if (p.kind === "flurryCross") {
      // Rapid multi-hit flurry slash intersection
      const sz = (p.size || 28) * a;
      cx.translate(p.x, p.y);
      cx.rotate(p.ang || 0.35);
      cx.strokeStyle = p.c || "#fbbf24";
      cx.lineWidth = Math.max(1.5, 3.5 * a);
      cx.beginPath();
      cx.moveTo(-sz, -sz * 0.6);
      cx.lineTo(sz, sz * 0.6);
      cx.moveTo(-sz * 0.6, sz);
      cx.lineTo(sz * 0.6, -sz);
      cx.stroke();

      // Center flash
      cx.fillStyle = "#ffffff";
      cx.fillRect(-2, -2, 4, 4);

    } else if (p.kind === "superBurst") {
      // Signature Super radial aura rays
      const rays = p.rays || 12;
      const r = (p.r || 60) * a;
      cx.translate(p.x, p.y);
      cx.rotate(p.rot || 0);
      cx.strokeStyle = p.c || "#f59e0b";
      cx.lineWidth = Math.max(1.5, 3 * a);
      for (let ray = 0; ray < rays; ray++) {
        const rang = (ray * Math.PI * 2) / rays;
        cx.beginPath();
        cx.moveTo(Math.cos(rang) * (r * 0.2), Math.sin(rang) * (r * 0.2));
        cx.lineTo(Math.cos(rang) * r, Math.sin(rang) * r);
        cx.stroke();
      }
      cx.fillStyle = p.core || "#ffffff";
      cx.beginPath();
      cx.arc(0, 0, Math.max(2, r * 0.22), 0, Math.PI * 2);
      cx.fill();

    } else if (p.kind === "hitSparkBlade") {
      // Geometric spark blade
      const len = p.len || 14;
      const ang = Math.atan2(p.vy, p.vx);
      cx.translate(p.x, p.y);
      cx.rotate(ang);
      cx.fillStyle = p.c || "#ffcf6a";
      cx.beginPath();
      cx.moveTo(-len * 0.2, 0);
      cx.lineTo(0, -2.5 * a);
      cx.lineTo(len, 0);
      cx.lineTo(0, 2.5 * a);
      cx.closePath();
      cx.fill();

    } else if (p.kind === "electric") {
      // High-voltage filament on critical counter
      cx.strokeStyle = p.c || "#38bdf8";
      cx.lineWidth = 1.8;
      cx.beginPath();
      cx.moveTo(p.x, p.y);
      cx.lineTo(p.x + (Math.random() - 0.5) * 16, p.y + (Math.random() - 0.5) * 16);
      cx.lineTo(p.x + (Math.random() - 0.5) * 24, p.y + (Math.random() - 0.5) * 24);
      cx.stroke();

    } else if (p.kind === "bleed") {
      // Blood drip droplet
      cx.fillStyle = p.c || "#e11d48";
      cx.beginPath();
      cx.ellipse(p.x, p.y, 2, 3.5, 0, 0, Math.PI * 2);
      cx.fill();

    } else if (p.kind === "stun") {
      // Orbiting stun star / dizzy spark
      cx.fillStyle = p.c || "#fbbf24";
      cx.beginPath();
      cx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      cx.fill();

    } else if (p.kind === "steam") {
      // Winded breath steam puff
      cx.fillStyle = "rgba(240, 249, 255, 0.4)";
      cx.beginPath();
      cx.arc(p.x, p.y, p.size || 4, 0, Math.PI * 2);
      cx.fill();

    } else if (p.kind === "ember") {
      // Desperation flame ember
      cx.fillStyle = p.c || "#ef4444";
      cx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);

    } else if (p.kind === "spark" || p.kind === "streak") {
      const len = p.kind === "streak" ? 2.2 : 0.6;
      const width = p.kind === "streak" ? 2.2 : 1 + a;
      cx.fillStyle = p.c;
      cx.strokeStyle = p.c;
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
      // Dust square
      const s = 2 + a * 4;
      cx.fillStyle = p.c;
      cx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
    }

    cx.restore();
  }
  cx.restore();
}

/* ---------------------------------------------------------------------
   spectacleAttackVFX - Spawn move overlays & directional sparks
   Maps technique archetype, class, range, and flags to visual shapes.
   --------------------------------------------------------------------- */
function spectacleAttackVFX(list, tech, ev, x, y, facing, isCrit) {
  if (!list) return 0;
  const V = SPECTACLE_CONFIG.vfx;
  const cls = (tech && tech.cls) || (ev && ev.tech && ev.tech.cls) || "STRIKE";
  const flags = (tech && tech.flags) || (ev && ev.tech && ev.tech.flags) || [];
  const name = ((tech && tech.name) || (ev && ev.name) || "").toLowerCase();
  const disc = ((tech && tech.disc) || "").toLowerCase();
  const power = (tech && tech.power) || (ev && ev.dmg) || 20;
  const isSuper = !!(ev && (ev.signature || ev.isSuper));
  const fx = facing === undefined ? 1 : (facing < 0 ? -1 : 1);
  let added = 0;

  // 1. Signature / Super Detonation
  if (isSuper) {
    list.push({
      x: x, y: y,
      kind: "superBurst",
      rays: 14,
      r: 15,
      c: "#f59e0b",
      core: "#ffffff",
      l: V.super.life,
      maxLife: V.super.life,
      rot: 0
    });
    // Add electric filaments
    for (let e = 0; e < 6; e++) {
      list.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        kind: "electric",
        c: "#38bdf8",
        l: 12 + Math.floor(Math.random() * 8),
        maxLife: 18
      });
      added++;
    }
    added++;
  }

  // 2. Kicks & Slashes (Taekwondo, Muay Thai, Karate, Kickboxing roundhouses)
  const isKick = cls === "STRIKE" && (
    (tech && tech.range === "LONG") ||
    flags.indexOf("kick") >= 0 || flags.indexOf("axe") >= 0 || flags.indexOf("spin") >= 0 ||
    flags.indexOf("jump") >= 0 || flags.indexOf("leg") >= 0 ||
    name.indexOf("kick") >= 0 || name.indexOf("chagi") >= 0 || name.indexOf("roundhouse") >= 0 || name.indexOf("teep") >= 0
  );

  if (isKick) {
    const isSpin = flags.indexOf("spin") >= 0 || name.indexOf("spin") >= 0 || name.indexOf("tornado") >= 0;
    const isLow = flags.indexOf("leg") >= 0 || name.indexOf("low") >= 0;
    const baseAng = isLow ? Math.PI * 0.15 : (isSpin ? Math.PI * 0.5 : -Math.PI * 0.25);
    const ang = fx > 0 ? baseAng : Math.PI - baseAng;
    const color = disc === "muaythai" ? "#ef4444" : (disc === "taekwondo" ? "#38bdf8" : V.slash.colour);

    list.push({
      x: x, y: isLow ? y + 35 : y - 10,
      kind: "slashTrail",
      ang: ang,
      radius: V.slash.radBase * (power >= 30 ? 1.25 : 1.0),
      arcLen: isSpin ? 2.2 : V.slash.arcLen,
      c: color,
      core: V.slash.core,
      l: V.slash.life,
      maxLife: V.slash.life,
      facing: fx,
      dr: 1.5
    });
    added++;

    // Add directional spark blades along kick arc
    for (let b = 0; b < 4; b++) {
      const spd = 4 + Math.random() * 5;
      const bAng = ang + (Math.random() - 0.5) * 0.8;
      list.push({
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 12,
        vx: Math.cos(bAng) * spd,
        vy: Math.sin(bAng) * spd,
        kind: "hitSparkBlade",
        len: 14 + Math.random() * 10,
        c: color,
        l: 14 + Math.floor(Math.random() * 8),
        maxLife: 20
      });
      added++;
    }
  }

  // 3. Uppercuts, Flying Knees & Launchers
  const isLauncher = (ev && ev.launcher) || flags.indexOf("launcher") >= 0 || name.indexOf("upper") >= 0 || name.indexOf("flying") >= 0 || name.indexOf("jump") >= 0;
  if (isLauncher) {
    list.push({
      x: x, y: y + 20,
      kind: "risingPlume",
      height: V.plume.height * (power >= 30 ? 1.3 : 1.0),
      width: V.plume.width,
      vy: -4.5,
      c: isCrit ? "#ef4444" : V.plume.colour,
      core: V.plume.core,
      l: V.plume.life,
      maxLife: V.plume.life
    });
    added++;
  }

  // 4. Heavy Punches / Direct Strikes (Boxing, Shotokan, Lethwei)
  const isHeavyPunch = cls === "STRIKE" && !isKick && (power >= 24 || flags.indexOf("power") >= 0 || name.indexOf("hook") >= 0 || name.indexOf("cross") >= 0 || name.indexOf("overhand") >= 0);
  if (isHeavyPunch) {
    list.push({
      x: x, y: y,
      kind: "starburst",
      points: power >= 32 ? 8 : V.starburst.points,
      rInner: V.starburst.rInner,
      rOuter: V.starburst.rOuter * (power >= 30 ? 1.25 : 1.0),
      c: isCrit ? "#e11d48" : V.starburst.colour,
      core: V.starburst.core,
      rot: Math.random() * Math.PI,
      rotSpd: 0.05,
      l: V.starburst.life,
      maxLife: V.starburst.life
    });
    added++;

    // Diamond directional spark shards
    for (let s = 0; s < 5; s++) {
      const spd = 3.5 + Math.random() * 4.5;
      const sAng = (fx > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.2;
      list.push({
        x: x, y: y,
        vx: Math.cos(sAng) * spd,
        vy: Math.sin(sAng) * spd,
        kind: "hitSparkBlade",
        len: 12 + Math.random() * 8,
        c: "#ffcf6a",
        l: 12 + Math.floor(Math.random() * 6),
        maxLife: 16
      });
      added++;
    }
  }

  // 5. Throws, Takedowns, Slams & Groundwork
  const isThrowOrGround = cls === "THROW" || flags.indexOf("takedown") >= 0 || flags.indexOf("sweep") >= 0 || flags.indexOf("slam") >= 0 || (tech && tech.range === "GROUND");
  if (isThrowOrGround) {
    list.push({
      x: x, y: 392,
      kind: "groundShockwave",
      rx: 16,
      ry: 4,
      maxRx: V.shockwave.maxRx,
      c: V.shockwave.colour,
      l: V.shockwave.life,
      maxLife: V.shockwave.life
    });
    added++;

    // Radial dust burst at the mat
    added += spectacleBurst(list, x, 392, "#8b7a63", 12, 3.2);
  }

  // 6. Submissions & Joint Locks (BJJ, Judo, Sambo, Catch Wrestling)
  const isSub = cls === "SUB" || name.indexOf("choke") >= 0 || name.indexOf("bar") >= 0 || name.indexOf("lock") >= 0 || name.indexOf("hold") >= 0;
  if (isSub) {
    list.push({
      x: x, y: y - 5,
      kind: "lockRings",
      r: V.lockRings.radStart,
      rot: 0,
      c: V.lockRings.colour,
      l: V.lockRings.life,
      maxLife: V.lockRings.life
    });
    added++;
  }

  // 7. Multi-hit Combinations
  const isFlurry = (ev && ev.chainLen >= 2) || flags.indexOf("multi") >= 0;
  if (isFlurry) {
    list.push({
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 16,
      kind: "flurryCross",
      size: V.flurry.size,
      ang: (Math.random() - 0.5) * 0.8,
      c: V.flurry.colour,
      l: V.flurry.life,
      maxLife: V.flurry.life
    });
    added++;
  }

  // 8. Critical Counter-Hit Electric Filaments
  if (isCrit || (ev && ev.counter)) {
    for (let c = 0; c < 4; c++) {
      list.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        kind: "electric",
        c: "#38bdf8",
        l: 10 + Math.floor(Math.random() * 6),
        maxLife: 15
      });
      added++;
    }
  }

  return added;
}

/* ---------------------------------------------------------------------
   spectacleImpact - kinded burst for duel resolve paint.
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
      maxLife: spec.life,
      c: spec.colour,
      kind: kindOut,
    });
    added++;
  }
  /* a soft glow core for heavier impacts */
  if (kind === "ko" || kind === "kick" || kind === "throw") {
    list.push({ x: x, y: y, vx: 0, vy: 0, l: spec.life * 0.6, maxLife: spec.life * 0.6, c: spec.colour, kind: "glow" });
  }
  /* KO gets a second dust ring so the finish reads heavier than a strike */
  if (kind === "ko") {
    added += spectacleBurst(list, x, y + 8, SPECTACLE_CONFIG.impact.throw.colour, 10, 2.4);
  }
  return added;
}

/* ---------------------------------------------------------------------
   spectacleSpawnStatusAura - Live condition particles on fighter sprites
   --------------------------------------------------------------------- */
function spectacleSpawnStatusAura(list, condition, x, y, facing) {
  if (!list || !condition) return 0;
  let added = 0;
  const fx = facing || 1;

  if (condition === "BLEEDING") {
    list.push({
      x: x + (Math.random() - 0.5) * 24,
      y: y - 80 + Math.random() * 60,
      vx: (Math.random() - 0.5) * 0.4,
      vy: 1.5 + Math.random() * 1.5,
      kind: "bleed",
      c: "#e11d48",
      l: 26,
      maxLife: 26
    });
    added++;
  } else if (condition === "STUNNED") {
    const angle = Math.random() * Math.PI * 2;
    list.push({
      cx: x,
      cy: y - 130,
      rx: 24,
      ry: 8,
      angle: angle,
      x: x + Math.cos(angle) * 24,
      y: y - 130 + Math.sin(angle) * 8,
      kind: "stun",
      c: Math.random() > 0.4 ? "#fbbf24" : "#38bdf8",
      l: 22,
      maxLife: 22
    });
    added++;
  } else if (condition === "WINDED") {
    list.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y - 60,
      vy: -1.2 - Math.random() * 0.8,
      size: 3.5,
      kind: "steam",
      l: 24,
      maxLife: 24
    });
    added++;
  } else if (condition === "DESPERATION") {
    list.push({
      x: x + (Math.random() - 0.5) * 36,
      y: y - 10 - Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -1.6 - Math.random() * 1.2,
      kind: "ember",
      c: Math.random() > 0.3 ? "#ef4444" : "#f59e0b",
      l: 20 + Math.floor(Math.random() * 10),
      maxLife: 30
    });
    added++;
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
  if (typeof cx.createRadialGradient === "function") {
    const rx = w * 0.5;
    const g = cx.createRadialGradient(x, baseY, 0, x, baseY, rx);
    g.addColorStop(0, "rgba(0,0,0," + Math.min(1, a * 1.3).toFixed(3) + ")");
    g.addColorStop(0.5, "rgba(0,0,0," + (a * 0.7).toFixed(3) + ")");
    g.addColorStop(1, "rgba(0,0,0,0)");
    cx.fillStyle = g;
    cx.beginPath();
    cx.ellipse(x, baseY, rx, ry, 0, 0, Math.PI * 2);
    cx.fill();
  } else {
    cx.beginPath();
    cx.ellipse(x, baseY, w * 0.5, ry, 0, 0, Math.PI * 2);
    cx.fillStyle = SPECTACLE_CONFIG.shadow.fill + a + ")";
    cx.fill();
  }
  cx.restore();
}

/* ---------------------------------------------------------------------
   paintMatRim - subtle rim ellipse matching venueRim colour.
   --------------------------------------------------------------------- */
function paintMatRim(cx, x, baseY, venueRim, alpha) {
  if (!cx) return;
  let col = "#6a5a48";
  let a = alpha === undefined ? 0.22 : alpha;
  let pad = SPECTACLE_CONFIG.rim.pad;
  if (typeof venueRim === "string") {
    col = venueRim.replace("$A", "0.35");
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

/* ---------------------------------------------------------------------
   paintCRTFilter - Optional CRT scanline & phosphor bloom overlay filter.
   --------------------------------------------------------------------- */
function paintCRTFilter(cx, W, H, intensity) {
  if (!cx) return;
  var it = intensity === undefined ? 0.35 : Math.max(0, Math.min(1, intensity));
  if (it <= 0) return;

  var width = W || 960;
  var height = H || 540;

  cx.save();

  // 1. Horizontal CRT scanlines
  cx.fillStyle = "rgba(0, 0, 0, " + (0.24 * it) + ")";
  var step = 3;
  for (var y = 0; y < height; y += step) {
    cx.fillRect(0, y, width, 1);
  }

  // 2. Phosphor bloom / corner vignette
  var grad = cx.createRadialGradient(width / 2, height / 2, width * 0.25, width / 2, height / 2, width * 0.65);
  grad.addColorStop(0, "rgba(0, 0, 0, 0)");
  grad.addColorStop(0.7, "rgba(5, 8, 15, " + (0.22 * it) + ")");
  grad.addColorStop(1, "rgba(0, 0, 0, " + (0.65 * it) + ")");
  cx.fillStyle = grad;
  cx.fillRect(0, 0, width, height);

  // 3. Phosphor sweep beam line
  var sweepY = ((Date.now ? Date.now() : 0) / 18) % (height + 60) - 30;
  var sweepGrad = cx.createLinearGradient(0, sweepY - 18, 0, sweepY + 18);
  sweepGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
  sweepGrad.addColorStop(0.5, "rgba(255, 255, 255, " + (0.05 * it) + ")");
  sweepGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  cx.fillStyle = sweepGrad;
  cx.fillRect(0, Math.max(0, sweepY - 18), width, 36);

  cx.restore();
}

/* ---------------------------------------------------------------------
   paintArcadeBanner - High-impact fighting game arcade announcer callouts.
   Supports: "ROUND 1 - FIGHT!", "COUNTER HIT!", "GUARD CRUSH!", "GREAT REVERSAL!", "PERFECT KO!"
   --------------------------------------------------------------------- */
function paintArcadeBanner(cx, W, H, bannerText, subtitle, style) {
  if (!cx || !bannerText) return;
  style = style || {};
  var width = W || 960;
  var height = H || 540;
  var txt = String(bannerText).toUpperCase();
  var sub = subtitle ? String(subtitle).toUpperCase() : "";
  var alpha = style.alpha !== undefined ? Math.max(0, Math.min(1, style.alpha)) : 1.0;
  if (alpha <= 0) return;

  var mainColor = style.color || "#fbbf24";
  var accentColor = "#f59e0b";
  var ribbonBg = "rgba(10, 12, 18, 0.94)";

  if (txt.indexOf("COUNTER") >= 0) {
    mainColor = style.color || "#38bdf8";
    accentColor = "#0284c7";
  } else if (txt.indexOf("GUARD") >= 0 || txt.indexOf("CRUSH") >= 0) {
    mainColor = style.color || "#ef4444";
    accentColor = "#dc2626";
  } else if (txt.indexOf("REVERSAL") >= 0) {
    mainColor = style.color || "#a855f7";
    accentColor = "#7c3aed";
  } else if (txt.indexOf("PERFECT") >= 0 || txt.indexOf("KO") >= 0) {
    mainColor = style.color || "#fbbf24";
    accentColor = "#ef4444";
  } else if (txt.indexOf("ROUND") >= 0 || txt.indexOf("FIGHT") >= 0) {
    mainColor = style.color || "#f97316";
    accentColor = "#ea580c";
  }

  cx.save();
  cx.globalAlpha = alpha;

  var cy = height / 2;
  var bannerH = sub ? 92 : 72;

  // 1. Radial Speed Burst Lines
  if (style.showBurst !== false) {
    cx.save();
    cx.translate(width / 2, cy);
    var rays = 18;
    var rayR = width * 0.65;
    for (var r = 0; r < rays; r++) {
      var ang = (r * Math.PI * 2) / rays + (style.rot || 0);
      cx.beginPath();
      cx.moveTo(0, 0);
      cx.lineTo(Math.cos(ang - 0.06) * rayR, Math.sin(ang - 0.06) * rayR);
      cx.lineTo(Math.cos(ang + 0.06) * rayR, Math.sin(ang + 0.06) * rayR);
      cx.closePath();
      cx.fillStyle = (r % 2 === 0) ? "rgba(255, 255, 255, 0.04)" : "rgba(245, 158, 11, 0.03)";
      cx.fill();
    }
    cx.restore();
  }

  // 2. High-Impact Skewed Arcade Ribbon Banner
  var skew = style.skew !== undefined ? style.skew : -0.08;
  cx.save();
  cx.translate(width / 2, cy);
  cx.transform(1, 0, Math.tan(skew), 1, 0, 0);

  var bw = width * 0.88;
  cx.fillStyle = ribbonBg;
  cx.fillRect(-bw / 2, -bannerH / 2, bw, bannerH);

  // Glowing Top & Bottom neon edges
  cx.fillStyle = mainColor;
  cx.fillRect(-bw / 2, -bannerH / 2, bw, 3.5);
  cx.fillRect(-bw / 2, bannerH / 2 - 3.5, bw, 3.5);

  // Inner accent line
  cx.fillStyle = accentColor;
  cx.fillRect(-bw / 2, -bannerH / 2 + 3.5, bw, 1.5);
  cx.fillRect(-bw / 2, bannerH / 2 - 5.0, bw, 1.5);

  // 3. Arcade Typography
  var fontSize = style.fontSize || (txt.length > 16 ? 34 : 42);
  cx.font = "900 " + fontSize + "px 'Trebuchet MS', 'Impact', Bahnschrift, Arial, sans-serif";
  cx.textAlign = "center";
  cx.textBaseline = "middle";

  var textY = sub ? -12 : 0;

  // Heavy 3D Drop Shadow / Outline
  cx.strokeStyle = "rgba(0, 0, 0, 0.95)";
  cx.lineWidth = 8;
  cx.strokeText(txt, 0, textY + 2);

  // Glow halo
  cx.shadowColor = mainColor;
  cx.shadowBlur = 14;
  cx.fillStyle = mainColor;
  cx.fillText(txt, 0, textY);

  // Inner hot core text
  cx.shadowBlur = 0;
  cx.fillStyle = "#ffffff";
  cx.fillText(txt, 0, textY);

  // Subtitle
  if (sub) {
    cx.font = "bold 13px 'Trebuchet MS', Bahnschrift, Arial, sans-serif";
    cx.fillStyle = "#cbd5e1";
    cx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    cx.lineWidth = 3;
    cx.strokeText(sub, 0, 24);
    cx.fillText(sub, 0, 24);
  }

  cx.restore();
  cx.restore();
}

if (typeof window !== "undefined") {
  window.paintCRTFilter = paintCRTFilter;
  window.paintArcadeBanner = paintArcadeBanner;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SPECTACLE_CONFIG,
    spectacleBurst,
    spectacleStep,
    spectaclePaint,
    spectacleImpact,
    spectacleAttackVFX,
    spectacleSpawnStatusAura,
    paintContactShadow,
    paintMatRim,
    koPunch,
    spectaclePop,
    spectacleStepPops,
    spectaclePaintPops,
    paintCRTFilter,
    paintArcadeBanner
  };
}

