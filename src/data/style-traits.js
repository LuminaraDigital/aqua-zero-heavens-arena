/* =====================================================================
   Aqua Zero Heavens Arena - style traits
   Luminara Digital

   Persistent shot-selection biases layered on top of archetypes.
   Derived from a fighter's disciplines so dossiers stay the source of
   truth - no per-fighter authoring table required.
   ===================================================================== */

const STYLE_TRAITS = {
  body_hunter: {
    id: "body_hunter", name: "BODY HUNTER",
    note: "targets the body and taxes gas",
    zoneBias: "body", zoneMul: 1.25, bodyStamExtra: 3,
  },
  leg_kicker: {
    id: "leg_kicker", name: "LEG KICKER",
    note: "chops the base and hunts low kicks",
    zoneBias: "legs", zoneMul: 1.30, flagBias: ["leg"],
  },
  cage_specialist: {
    id: "cage_specialist", name: "CAGE SPECIALIST",
    note: "stronger when the fight is on the ropes or in the corner",
    posBias: true, posMul: 1.12,
  },
  counter_specialist: {
    id: "counter_specialist", name: "COUNTER SPECIALIST",
    note: "pays for answering a whiff",
    counterBonus: 10,
  },
  pressure_fighter: {
    id: "pressure_fighter", name: "PRESSURE FIGHTER",
    note: "values closing and shove work",
    closeIn: 6, shoveBonus: 4,
  },
  submission_ace: {
    id: "submission_ace", name: "SUBMISSION ACE",
    note: "submissions score higher once the fight hits the mat",
    subMul: 1.20, groundMul: 1.10,
  },
  knockout_artist: {
    id: "knockout_artist", name: "KNOCKOUT ARTIST",
    note: "head strikes and finish hunting",
    zoneBias: "head", zoneMul: 1.15, strikeMul: 1.08,
  },
  scramble_artist: {
    id: "scramble_artist", name: "SCRAMBLE ARTIST",
    note: "escapes and reversals from bad spots",
    escapeMul: 1.15, reverseBonus: 8,
  },
};
const STYLE_TRAIT_IDS = Object.keys(STYLE_TRAITS);

/* Deterministic 0..2 traits from discipline set. */
function styleTraitsOf(fid) {
  const discs = (typeof disciplinesOf === "function") ? disciplinesOf(fid) : [];
  const out = [];
  const has = (id) => discs.indexOf(id) >= 0;

  if (has("muaythai") || has("lethwei") || has("kickboxing")) out.push("leg_kicker");
  if (has("boxing") || has("kenpo")) out.push("body_hunter");
  if (has("wrestling") || has("sumo") || has("greco") || has("draka")) out.push("pressure_fighter");
  if (has("bjj") || has("subgrap") || has("jiujitsu") || has("sambo")) out.push("submission_ace");
  if (has("taekwondo") || has("wushu") || has("shotokan")) out.push("knockout_artist");
  if (has("judo") || has("grappling")) out.push("scramble_artist");
  if (has("mma") || has("muaythai")) out.push("cage_specialist");
  if (has("boxing") || has("kenpo") || has("shotokan")) out.push("counter_specialist");

  /* Stable pick of at most two unique traits using fighter id. */
  const uniq = [];
  for (let i = 0; i < out.length; i++) {
    if (uniq.indexOf(out[i]) < 0) uniq.push(out[i]);
  }
  if (!uniq.length) return ["pressure_fighter"];
  let h = ((fid | 0) * 2654435761) >>> 0;
  const pick = [];
  const pool = uniq.slice();
  const n = Math.min(2, pool.length);
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const ix = h % pool.length;
    pick.push(pool[ix]);
    pool.splice(ix, 1);
  }
  return pick;
}

function styleTraitDefs(ids) {
  return (ids || []).map((id) => STYLE_TRAITS[id]).filter(Boolean);
}

/* Fold trait bonuses into an AI weight object (mutates a copy). */
function applyStyleTraitWeights(weights, traitIds) {
  const w = Object.assign({}, weights || {});
  styleTraitDefs(traitIds).forEach((t) => {
    if (t.counterBonus) w.counterBonus = (w.counterBonus || 0) + t.counterBonus;
    if (t.closeIn) w.closeIn = (w.closeIn || 0) + t.closeIn;
    if (t.subMul) w.sub = (w.sub || 1) * t.subMul;
    if (t.groundMul) w.ground = (w.ground || 1) * t.groundMul;
    if (t.strikeMul) w.aggression = (w.aggression || 1) * t.strikeMul;
  });
  return w;
}

/* Extra score for AI technique choice from traits. */
function styleTraitScore(d, side, foe, tech) {
  if (!side || !tech) return 0;
  const traits = styleTraitDefs(side.styleTraits || []);
  if (!traits.length) return 0;
  let s = 0;
  const flags = tech.flags || [];
  const zone = (typeof getZoneDamageTarget === "function") ? getZoneDamageTarget(tech) : "head";

  for (let i = 0; i < traits.length; i++) {
    const t = traits[i];
    if (t.zoneBias && zone === t.zoneBias) s += 6 * (t.zoneMul || 1);
    if (t.flagBias) {
      for (let j = 0; j < t.flagBias.length; j++) {
        if (flags.indexOf(t.flagBias[j]) >= 0) s += 5;
      }
    }
    if (t.posBias && d && (d.pos === "ROPES" || d.pos === "CORNER")) s += 5 * (t.posMul || 1);
    if (t.shoveBonus && flags.indexOf("shove") >= 0) s += t.shoveBonus;
    if (t.reverseBonus && flags.indexOf("reversal") >= 0) s += t.reverseBonus;
    if (t.escapeMul && flags.indexOf("escape") >= 0) s += 6 * t.escapeMul;
    if (t.subMul && tech.cls === "SUB") s += 5;
  }
  return s;
}

/* Apply trait effects at hit time (body hunter extra stam drain, etc.). */
function applyStyleTraitOnHit(side, foe, tech, ev) {
  if (!side || !foe || !tech || !ev || !ev.hit) return;
  const traits = styleTraitDefs(side.styleTraits || []);
  const zone = ev.targetZone || ((typeof getZoneDamageTarget === "function") ? getZoneDamageTarget(tech) : "head");
  for (let i = 0; i < traits.length; i++) {
    const t = traits[i];
    if (t.bodyStamExtra && zone === "body") {
      foe.stam = Math.max(0, (foe.stam || 0) - t.bodyStamExtra);
      ev.traitStamDrain = (ev.traitStamDrain || 0) + t.bodyStamExtra;
    }
    if (t.zoneMul && t.zoneBias === zone && ev.dmg) {
      const bonus = Math.max(0, Math.round(ev.dmg * (t.zoneMul - 1) * 0.35));
      if (bonus > 0) {
        ev.dmg += bonus;
        ev.traitZoneBonus = (ev.traitZoneBonus || 0) + bonus;
      }
    }
  }
}
