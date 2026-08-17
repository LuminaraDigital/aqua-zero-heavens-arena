#!/usr/bin/env node
/**
 * Light resilience check for the offline battle model.
 *
 * Not chaos engineering: runs a fixed batch of deterministic fights through
 * the real harness and fails on throw or too few completed fights. Keeps CI
 * honest without a browser e2e stack.
 */
"use strict";

const boot = require("../tests/harness");
const h = boot({ quiet: true });
const A = h.api;

const FIGHTS = 80;
const TURN_CAP = 60;

function rngFrom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simFight(aFid, bFid, rnd) {
  const P = A.mkSide(aFid, A.hpOf(aFid), A.battlePool(aFid, 9), { human: true, level: 9 });
  const E = A.mkSide(bFid, A.hpOf(bFid), A.battlePool(bFid, 9), { level: 9 });
  P.ai = A.ARCHETYPES[A.archetypeFor(aFid, 1)].weights;
  E.ai = A.ARCHETYPES[A.archetypeFor(bFid, 1)].weights;
  const d = {
    p: P,
    e: E,
    range: A.homeRanges(P.discs)[0] || "MID",
    lastWhiffBy: null,
    benefits: [],
    stats: A.newDuelStats(),
  };
  A.resetPosition(d);
  let turn = 0;
  while (P.hp > 0 && E.hp > 0 && turn < TURN_CAP) {
    const pick = [
      { s: P, f: E, side: "p", t: A.aiChooseTechnique(d, P, E, { noise: 12, rnd }).tech },
      { s: E, f: P, side: "e", t: A.aiChooseTechnique(d, E, P, { noise: 12, rnd }).tech },
    ];
    pick.forEach((x) => (x.init = A.initiativeOf(x.s, x.t, rnd)));
    pick.sort((x, y) => y.init - x.init);
    for (const act of pick) {
      if (act.s.hp <= 0 || act.f.hp <= 0) continue;
      const other = pick.find((z) => z !== act);
      const ev = A.executeTechnique(d, act.s, act.f, act.t, other ? other.t : null, rnd);
      if (ev.whiff) d.lastWhiffBy = act.side;
      else d.lastWhiffBy = null;
      if (ev.hit) {
        act.f.hp -= ev.dmg;
      }
    }
    A.tickRangeClock(d);
    A.pressureDecay(d);
    P.hp -= A.endTurnUpkeep(P);
    E.hp -= A.endTurnUpkeep(E);
    turn++;
  }
  return turn;
}

const rosterN = A.FIGHTERS.length;
const rnd = rngFrom(0xa2a5 ^ 0x5eed);
let completed = 0;
let maxTurns = 0;

try {
  for (let i = 0; i < FIGHTS; i++) {
    const a = i % rosterN;
    let b = (i * 3 + 7) % rosterN;
    if (a === b) b = (b + 1) % rosterN;
    const turns = simFight(a, b, rnd);
    completed++;
    if (turns > maxTurns) maxTurns = turns;
  }
} catch (e) {
  console.error("resilience FAILED: threw during simulated fights");
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}

if (completed < 40) {
  console.error("resilience FAILED: completed " + completed + " fights, need >= 40");
  process.exit(1);
}

console.log(
  "OK  resilience: " +
    completed +
    " fights completed (cap " +
    TURN_CAP +
    " turns, max seen " +
    maxTurns +
    ")"
);
process.exit(0);
