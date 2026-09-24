"use strict";

module.exports = function (h) {
  h.section("Attack VFX, Hit Sparks, Move Cut-Ins & Martial Arts Visuals");

  const spectacle = h.api.spectacleBurst ? h.api : require("../src/ui/spectacle");
  const CombatFX = h.api.CombatFX || require("../src/ui/combat-fx");
  const CardTooltip = h.api.CardTooltip || require("../src/ui/card-tooltip");
  const SFX = h.api.SFX || require("../src/ui/sfx");

  // 1. Spectacle VFX Configurations
  h.ok(typeof spectacle.SPECTACLE_CONFIG === "object", "SPECTACLE_CONFIG defined");
  h.ok(typeof spectacle.SPECTACLE_CONFIG.vfx === "object", "VFX configurations exist");
  h.ok(spectacle.SPECTACLE_CONFIG.vfx.slash.radBase > 0, "Slash VFX radius defined");
  h.ok(spectacle.SPECTACLE_CONFIG.vfx.starburst.points >= 5, "Starburst VFX points defined");
  h.ok(spectacle.SPECTACLE_CONFIG.vfx.plume.height > 0, "Plume VFX height defined");
  h.ok(spectacle.SPECTACLE_CONFIG.vfx.shockwave.maxRx > 0, "Ground shockwave radius defined");
  h.ok(spectacle.SPECTACLE_CONFIG.vfx.lockRings.radStart > 0, "Lock rings radius defined");
  h.ok(spectacle.SPECTACLE_CONFIG.vfx.super.rays >= 8, "Super burst rays defined");

  // 2. Kicks & Slash Trails
  const kickList = [];
  const kickTech = { name: "Head Kick", cls: "STRIKE", range: "LONG", power: 42, flags: ["kick", "power"], disc: "muaythai" };
  const kickCount = spectacle.spectacleAttackVFX(kickList, kickTech, { dmg: 42 }, 200, 300, 1);
  h.ok(kickCount > 0, "Kick spawns attack VFX");
  const slash = kickList.find(p => p.kind === "slashTrail");
  h.ok(slash !== undefined, "Kick spawned slashTrail arc");
  h.ok(slash.c === "#ef4444", "Muay Thai kick uses crimson color styling");
  const sparkBlade = kickList.find(p => p.kind === "hitSparkBlade");
  h.ok(sparkBlade !== undefined, "Kick spawned directional hit spark blades");

  // 3. Heavy Straight Punches & Starbursts
  const punchList = [];
  const punchTech = { name: "Overhand Right", cls: "STRIKE", range: "MID", power: 38, flags: ["power"], disc: "boxing" };
  const punchCount = spectacle.spectacleAttackVFX(punchList, punchTech, { dmg: 38 }, 200, 300, 1);
  h.ok(punchCount > 0, "Heavy punch spawns attack VFX");
  const starburst = punchList.find(p => p.kind === "starburst");
  h.ok(starburst !== undefined, "Heavy punch spawned impact starburst");
  h.ok(starburst.rOuter > 20, "Starburst has substantial impact radius");

  // 4. Uppercuts, Flying Knees & Launchers
  const plumeList = [];
  const kneeTech = { name: "Flying Knee", cls: "STRIKE", range: "MID", power: 44, flags: ["launcher", "jump"], disc: "muaythai" };
  spectacle.spectacleAttackVFX(plumeList, kneeTech, { dmg: 44, launcher: true }, 200, 300, 1);
  const plume = plumeList.find(p => p.kind === "risingPlume");
  h.ok(plume !== undefined, "Launcher spawned rising kinetic plume");
  h.ok(plume.vy < 0, "Plume has upward vertical velocity");

  // 5. Throws & Ground Mat Shockwaves
  const throwList = [];
  const throwTech = { name: "Double Leg Takedown", cls: "THROW", range: "MID", power: 26, flags: ["takedown"], disc: "wrestling" };
  spectacle.spectacleAttackVFX(throwList, throwTech, { dmg: 26 }, 200, 300, 1);
  const shockwave = throwList.find(p => p.kind === "groundShockwave");
  h.ok(shockwave !== undefined, "Takedown spawned ground mat shockwave");
  h.ok(shockwave.y === 392, "Ground shockwave is placed at canvas mat floor level");

  // 6. Submissions & Joint Lock Rings
  const subList = [];
  const subTech = { name: "Armbar", cls: "SUB", range: "GROUND", power: 34, disc: "bjj" };
  spectacle.spectacleAttackVFX(subList, subTech, { dmg: 34 }, 200, 300, 1);
  const lockRing = subList.find(p => p.kind === "lockRings");
  h.ok(lockRing !== undefined, "Submission spawned joint lock rings");
  h.ok(lockRing.r > 0, "Lock ring has positive initial radius");

  // 7. Multi-hit Flurry Crosses
  const comboList = [];
  const comboTech = { name: "Three-Punch Combination", cls: "STRIKE", range: "MID", power: 30, flags: ["multi"], disc: "kickboxing" };
  spectacle.spectacleAttackVFX(comboList, comboTech, { dmg: 30, chainLen: 3 }, 200, 300, 1);
  const flurry = comboList.find(p => p.kind === "flurryCross");
  h.ok(flurry !== undefined, "Combo chain spawned flurryCross marks");

  // 8. Signature Supers & Aura Detonations
  const superList = [];
  const superTech = { name: "Heavens Judgement", cls: "STRIKE", range: "MID", power: 65, sig: true };
  spectacle.spectacleAttackVFX(superList, superTech, { dmg: 65, signature: true, isSuper: true }, 200, 300, 1);
  const sBurst = superList.find(p => p.kind === "superBurst");
  h.ok(sBurst !== undefined, "Signature Super spawned superBurst radial rays");
  const electric = superList.find(p => p.kind === "electric");
  h.ok(electric !== undefined, "Signature Super spawned electric filaments");

  // 9. Spectacle Physics & Step Decay
  const stepList = [
    { x: 100, y: 100, l: 10, maxLife: 10, kind: "slashTrail", radius: 40, arcLen: 1.2 },
    { x: 100, y: 100, l: 10, maxLife: 10, kind: "starburst", rOuter: 30, rot: 0 },
    { x: 100, y: 100, l: 10, maxLife: 10, kind: "risingPlume", height: 50, vy: -3 },
    { x: 100, y: 392, l: 10, maxLife: 10, kind: "groundShockwave", rx: 10, ryMul: 0.22 },
    { x: 100, y: 100, l: 10, maxLife: 10, kind: "lockRings", r: 30, rot: 0 },
    { x: 100, y: 100, l: 10, maxLife: 10, kind: "flurryCross", size: 25 },
    { x: 100, y: 100, l: 1, maxLife: 10, kind: "superBurst", r: 10 } // will expire
  ];
  spectacle.spectacleStep(stepList);
  h.ok(stepList[0].radius > 40, "Slash radius expanded during step");
  h.ok(stepList[1].rOuter > 30, "Starburst outer radius expanded during step");
  h.ok(stepList[2].y < 100, "Plume moved upward during step");
  h.ok(stepList[3].rx > 10, "Shockwave expanded during step");
  h.ok(stepList[4].r < 30, "Lock ring contracted during step");
  h.ok(stepList[5].size > 25, "Flurry cross expanded during step");
  h.ok(stepList.length === 6, "Expired superBurst particle cleaned up");

  // 10. Live Status Auras
  const auraList = [];
  spectacle.spectacleSpawnStatusAura(auraList, "BLEEDING", 200, 392, 1);
  spectacle.spectacleSpawnStatusAura(auraList, "STUNNED", 200, 392, 1);
  spectacle.spectacleSpawnStatusAura(auraList, "WINDED", 200, 392, 1);
  spectacle.spectacleSpawnStatusAura(auraList, "DESPERATION", 200, 392, 1);
  h.ok(auraList.some(p => p.kind === "bleed"), "Bleeding aura spawned bleed drops");
  h.ok(auraList.some(p => p.kind === "stun"), "Stunned aura spawned orbiting sparks");
  h.ok(auraList.some(p => p.kind === "steam"), "Winded aura spawned steam puffs");
  h.ok(auraList.some(p => p.kind === "ember"), "Desperation aura spawned embers");

  // 11. Move Cut-In Banners in CombatFX
  CombatFX.triggerMoveBanner("Tornado Kick", "taekwondo", 42, false, false);
  h.ok(CombatFX.banner !== null, "Move banner triggered");
  h.ok(CombatFX.banner.text.indexOf("TORNADO KICK") >= 0, "Move banner text formatted");
  h.ok(CombatFX.banner.subtitle.indexOf("TAEKWONDO") >= 0, "Discipline subtitle attached");

  CombatFX.triggerMoveBanner("Dragon Breath", "muaythai", 50, true, false);
  h.ok(CombatFX.banner.subtitle.indexOf("CRITICAL COUNTER") >= 0, "Counter banner tagged correctly");

  CombatFX.triggerMoveBanner("Final Heaven", "shotokan", 65, false, true);
  h.ok(CombatFX.banner.subtitle.indexOf("SIGNATURE FINISHER") >= 0, "Super banner tagged correctly");

  // 12. CardTooltip Discipline & Category Badges
  const techCard = { name: "Question Mark Kick", cls: "STRIKE", disc: "kickboxing", power: 36, range: "LONG" };
  const cardDetails = CardTooltip.formatCardDetails(techCard);
  h.ok(cardDetails.disc === "kickboxing", "Card details include discipline");
  h.ok(typeof cardDetails.discColor === "string", "Card details include discipline color");
  h.ok(cardDetails.range === "LONG", "Card details include attack range");
  h.ok(cardDetails.badge === "STR", "Card details include category badge");

  // 13. SFX Audio Hooks
  h.ok(typeof SFX.slashWhoosh === "function", "SFX.slashWhoosh exists");
  h.ok(typeof SFX.slamImpact === "function", "SFX.slamImpact exists");
  h.ok(typeof SFX.counterShatter === "function", "SFX.counterShatter exists");
  h.ok(typeof SFX.subJointTension === "function", "SFX.subJointTension exists");
};
