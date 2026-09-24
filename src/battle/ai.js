/* =====================================================================
   Aqua Zero Heavens Arena - CPU technique selection
   Luminara Digital

   The CPU scores every technique it knows by what that technique is
   actually worth this turn: expected damage after the range fit, the value
   of the condition it might apply, whether it drags the fight toward a
   range its own disciplines own, and whether it can afford the air.

   Difficulty controls the noise on top, so a rookie opponent still throws
   a bad spinning kick from time to time.
   ===================================================================== */
const STATUS_VALUE = { STUNNED: 16, WINDED: 12, BLEEDING: 10, OFF_BALANCE: 8,
                       DAZED: 10, STAMINA_BREAK: 18,
                       LEG_HURT: 12, ARM_HURT: 12, HELD: 9, PINNED: 14 };

/* Near-tie exploration. The raw argmax is a repetition engine: measured on
   the baseline build (audit-balance 4, 2,400 fights) only 253 of 427
   techniques are ever thrown, because the same handful win the scoring
   every turn. aiChooseTechnique therefore swaps only among candidates that
   finish within this window of the winning score, preferring whichever of
   them this fighter has thrown fewest times THIS duel - so a dominant
   technique keeps the turn and only near-equal options rotate. Every
   must-not-override margin in scoreTechnique (mat escape +17, urgent sub
   defense +22, stage-2 lock +25, covering up hurt +26, finish it +40) is
   far wider than the window, which is what keeps the variety layer from
   ever trading the right move for a novel one. A flat repeat tax
   (6 pts x 2 uses) was measured first and rejected: it bought 303
   techniques but pushed the roster gap from 10.4 to 40.6 points and
   dropped strike finishes to 36.6% - a strong-enough tax to reach
   dominated techniques is a strong-enough tax to make good fighters
   throw junk. The 27 techniques in no fighter's learnset are unreachable
   by any of this and cap the dex metric at 400/427 (93.7%); the plan's
   Phase 3 gate asks for 65%. */
const AI_TIE_EPS = 1;

/* A gameplan reweights what this fighter cares about. No gameplan means the
   old, purely percentage-driven brain. */
function scoreTechnique(d, side, foe, tech, noise, rnd, optWeights) {
  const R = rnd || Math.random;
  const w = optWeights !== undefined ? optWeights : (side.ai || null);
  let s = 0;
  const fit = rangeFit(tech.range, d.range);

  /* ringcraft: a position-gated technique is worthless out of position,
     and the escape roll is worth exactly what being trapped costs */
  if (typeof posOk === "function" && !posOk(d, side, tech)) return -1e9;
  if ((tech.flags || []).indexOf("circle") >= 0) {
    const sev = d.pos === "CORNER" ? 22 : 12;
    return sev * escapeChance(side, d.pos) + (R() - 0.5) * noise;
  }

  if (tech.cls === "GUARD") {
    // covering up is worth a lot when hurt or empty
    s = 6;
    if (side.stam < side.maxStam * 0.3) s += 26;
    if (side.hp < side.maxhp * 0.3) s += 14;
    if (hasStatus(side, "WINDED")) s += 18;
    if (hasStatus(side, "STUNNED")) s += 10;
    if (w) {
      s *= w.guard || 1;
      // a counter-striker guards to bait, then punishes the whiff
      if (w.counterBonus && d.lastWhiffBy === (side === d.p ? "e" : "p")) s += w.counterBonus;
    }
  } else {
    const dmg = damageOf(d, side, foe, tech);
    const acc = accuracyOf(d, side, foe, tech) / 100;
    s = dmg * acc;
    if (dmg >= foe.hp) s += 40;                                  // finish it
    if (tech.eff) s += (STATUS_VALUE[tech.eff.st] || 6) * (tech.eff.ch / 100) * acc;
    if (tech.flags.indexOf("launcher") >= 0) s += 8;
    if (tech.cls === "SUB" && !(hasStatus(foe, "PINNED") || hasStatus(foe, "HELD"))) s -= 8;
    if (fit < 0.7) s -= 6;                                        // out of position
    // a corner-only payoff exists to be cashed - the gate above already
    // proved the other man is trapped
    if (tech.pos === "PRESSING") s += 10;
    if ((tech.flags || []).indexOf("reversal") >= 0) s += d.pos === "CORNER" ? 14 : 8;
    // walking a man down is worth more the closer the meter is to a notch,
    // and worth most to the arts built on it
    if ((tech.flags || []).indexOf("shove") >= 0) {
      const mine = side === d.p ? "p" : "e";
      if (d.cornered !== mine) {
        s += 5 * pressureOf(side);
        if (d.press && d.press.by === mine) s += Math.min(8, d.press.n * 3);
      }
    }
    if (w) {
      s *= w.aggression || 1;
      if (tech.cls === "SUB") s *= w.sub || 1;
      if (tech.range === "GROUND") s *= w.ground || 1;
      // MMA style biases adapted from mmaStyles.js
      if (w.punchBias && (tech.disc === "boxing" || (tech.flags || []).indexOf("punch") >= 0)) s *= w.punchBias;
      if (w.kickBias && (tech.disc === "taekwondo" || tech.disc === "kickboxing" || tech.disc === "muaythai")) s *= w.kickBias;
      if (w.takedownBias && (tech.cls === "THROW" || (tech.flags || []).indexOf("takedown") >= 0)) s *= w.takedownBias;
      if (w.clinchBias && (tech.range === "CLINCH" || tech.moves === "CLINCH")) s *= w.clinchBias;

      // a pressure fighter pays to close, an out-fighter pays to stay away
      if (w.closeIn && tech.moves) {
        const closer = RANGE_INDEX[tech.moves] > RANGE_INDEX[d.range];
        s += closer ? w.closeIn : -w.closeIn;
      }
      if (w.preferRange && tech.moves === w.preferRange) s += 16;
      if (w.preferRange && d.range === w.preferRange) s += 6;
      if (w.counterBonus && d.lastWhiffBy === (side === d.p ? "e" : "p")) s += w.counterBonus;
    }

    // Submission progression incentives: advance lock towards tapout
    if (d && d.range === "GROUND" && tech.cls === "SUB" && d.subAttacker === side) {
      if (d.subStage === 1) s += 15;
      else if (d.subStage === 2) s += 25;
    }

    // Seek finish opportunism: rocked opponent invites relentless assault
    if (side && side.seekFinish && tech.cls === "STRIKE") {
      s += 14;
    }

    if (typeof styleTraitScore === "function") {
      s += styleTraitScore(d, side, foe, tech);
    }
  }

  // Urgent submission defense: defend against an active submission
  if (d && d.subStage && d.subStage > 0 && d.subDefender === side) {
    const f = tech.flags || [];
    if (f.indexOf("escape") >= 0 || f.indexOf("sweep") >= 0 || f.indexOf("reversal") >= 0) {
      s += 22;
    }
  }
  // being stuck under someone is a losing position, and the longer it lasts
  // the more a fighter wants out - without this the CPU never stands up and
  // the fight lives on the mat forever
  /* ...and it has to actually take him somewhere. Three of the dex's
     `escape`-flagged techniques - bridge_escape, granby_roll and
     underhook_bridge_escape - are GUARD-class positional escapes with no
     `moves`: they reverse the position without leaving the mat, and a
     GUARD banks stamina instead of spending it. Paying them the stand-up
     bonus made them the best move on the board for BOTH fighters, and two
     men guarding each other on the floor with full tanks is a fight that
     never ends. Measured at 22 soft-locks in 400 played fights before this
     was scoped; 0 after. */
  const escapesTheMat = (tech.flags || []).indexOf("escape") >= 0 &&
    tech.moves && RANGE_INDEX[tech.moves] < RANGE_INDEX.GROUND;
  if (escapesTheMat && d.range === "GROUND") {
    const stuck = d.groundTurns || 0;
    /* Front-loaded on purpose. At +3 on the turn he was taken down, a man
       who does not want to be there still spent that turn trying something
       else and only started working for the exit on the next one: the
       average stay on the mat measured 2.7 turns and GROUND took 42% of
       all turns against a 25-35% band. A fighter who has just been put on
       his back decides to get up immediately - the ramp on top is the
       referee and the crowd, not the decision. */
    s += 17 + Math.min(14, stuck * 4);
    if (homeRanges(side.discs).indexOf("GROUND") < 0) s += 10;    // a striker wants up badly
  }
  // does this technique drag the fight somewhere I am better? Only pay for
  // an actual change of range - "moving" to where we already stand is free.
  if (tech.moves && tech.moves !== d.range) {
    const mine = homeRanges(side.discs), theirs = homeRanges(foe.discs);
    if (mine.indexOf(tech.moves) >= 0) s += 12;
    if (theirs.indexOf(tech.moves) >= 0) s -= 8;
    // and leaving a range we own for one we do not is a mistake
    if (mine.indexOf(d.range) >= 0 && mine.indexOf(tech.moves) < 0) s -= 10;
  }
  const cost = staminaCost(side, tech);
  // a finisher does not pace itself and will swing on an empty tank
  if (cost > side.stam) s -= (w && w.ignoreStamina) ? 6 : 22;
  else s -= cost * (w && w.ignoreStamina ? 0.1 : 0.35);
  return s + (R() - 0.5) * noise;
}

function aiChooseTechnique(d, side, foe, opts) {
  opts = opts || {};
  let weights = (opts && opts.weights) || side.ai || null;
  if (d && d.adaptiveTracker && typeof AdaptiveAI !== "undefined" && typeof AdaptiveAI.adaptWeights === "function") {
    const baseW = weights || (typeof archetypeOf === "function" && typeof archetypeFor === "function" ? archetypeOf(archetypeFor(side.fid)).weights : null);
    if (baseW) {
      weights = AdaptiveAI.adaptWeights(baseW, d.adaptiveTracker, {
        intensity: opts.adaptiveIntensity || 1.0,
        veteran: (d.stage && d.stage >= 5) || (d.towerFloor && d.towerFloor >= 50),
      });
    }
  }
  const noise = (opts.noise === undefined ? 18 : opts.noise) * ((weights && weights.noise) || 1);
  const rnd = opts.rnd || Math.random;
  // a full meter gets cashed in
  if (side.sig && side.sup >= SUP_MAX && rnd() < (opts.superChance === undefined ? 0.75 : opts.superChance))
    return { tech: side.sig, signature: true };

  /* -----------------------------------------------------------------
     Near-tie rotation, per side. The raw argmax is a repetition engine:
     measured over 2,400 fights (audit-balance 4, baseline build) only
     253 of 427 techniques are ever thrown, because the same few
     techniques win the scoring every turn. Instead of taxing the
     scores (a tax strong enough to reach dominated techniques is
     strong enough to make good fighters throw junk: a 6pt x 2-use
     tax measured 303 techniques but a 40.6-pt roster gap and 36.6%
     strike finishes), we keep the argmax honest and rotate only
     among the candidates that finish within AI_TIE_EPS of the
     winner, preferring whichever of them this fighter has thrown
     FEWEST times this duel. A dominant pick keeps the turn; only
     genuine near-equals see-saw, and the fighter still throws his
     best category of move every turn.

     The ledger is per side (one man's spam never taxes the other's
     movelist) and lazily initialized, so a bare duel object (tests,
     the audit's sim, an old save resumed mid-duel) pays nothing
     until the first pick and never throws.

     The 27 techniques in no fighter's learnset are unreachable at any
     window and cap the dex metric at 400/427 (93.7%). 65% (278) is the
     plan's Phase 3 gate. */
  const key = side === (d && d.p) ? "p" : "e";
  const use = (d && (d[key + "Use"] = d[key + "Use"] || {})) || null;

  let best = null, bs = -1e9;
  const scored = [];
  side.techs.forEach((id) => {
    const t = TECH[id];
    const sc = scoreTechnique(d, side, foe, t, noise, rnd, weights);
    scored.push({ t, sc });
    if (sc > bs) { bs = sc; best = t; }
  });
  /* the near-ties are measured against the FINAL winner, not the running
     max - a candidate scored before the real winner showed up must not be
     rotated in on a stale threshold. Same class only: a strike rotates for
     another strike, a sub for a sub, a guard for a guard. Cross-class
     rotation was measured first and flipped the roster (Finch 46.9 to
     60.9, Reed 56.3 to 41.7, gap 10.4 to 19.8): an equal-scoring guard
     and a strike are not the same decision, and swapping them changes
     who wins fights, not just which animation plays. */
  /* `best` is null when nothing was legal - every candidate at the -1e9
     floor, e.g. an all position-gated movelist in the attract demo - and the
     near-tie filter must not dereference it or the basic_guard fallback
     below never gets to answer. Caught by the attract suite's
     nothing-legal check on the integrated build. */
  const near = best ? scored.filter((c) => c.sc >= bs - AI_TIE_EPS && c.t.cls === best.cls) : [];
  /* rotate among near-equals: fewest uses this duel wins the turn.
     Ledger ties break toward the higher raw score, so the pre-variety
     winner keeps the turn whenever it is also the least-used option.
     Skipped entirely when nothing was legal (bs at the -1e9 floor), so
     the basic_guard fallback below is still the answer there. */
  if (best && near.length > 1 && use) {
    let minUse = Infinity;
    near.forEach((c) => { const u = use[c.t.id] || 0; if (u < minUse) minUse = u; });
    const pool = near.filter((c) => (use[c.t.id] || 0) === minUse);
    if (pool.length) {
      pool.sort((x, y) => y.sc - x.sc);
      best = pool[0].t;
    }
  }
  best = best || TECH.basic_guard;
  if (use) use[best.id] = (use[best.id] || 0) + 1;
  return { tech: best, signature: false };
}
