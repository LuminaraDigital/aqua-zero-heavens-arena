/* =====================================================================
   Aqua Zero Heavens Arena - Endless Survival Gauntlet Mode
   Luminara Digital

   Infinite wave survival. Scaling opponent AI, boss waves every 5th floor,
   and mid-run draft/infusion intervals every 3 waves.
   ===================================================================== */

const ENDLESS_CONFIG = {
  hpScalePerWave: 0.04,
  powScalePerWave: 0.03,
  draftInterval: 3,
  bossInterval: 5,
};

function DEF_ENDLESS_STATE(heroId) {
  return {
    hero: heroId || 0,
    wave: 1,
    score: 0,
    highWave: 1,
    draftsWon: 0,
    hp: 100,
    maxhp: 100,
    purse: 50,
    active: true,
  };
}

function endlessOpponentForWave(wave, rosterSize) {
  const w = Math.max(1, Math.round(wave || 1));
  const isBoss = w % ENDLESS_CONFIG.bossInterval === 0;
  const poolSize = rosterSize || (typeof ORDER !== "undefined" ? ORDER.length : 24);
  const oppIndex = (w * 7 + 3) % poolSize;
  const oppId = (typeof ORDER !== "undefined" && ORDER[oppIndex] !== undefined) ? ORDER[oppIndex] : oppIndex;

  const statMul = 1.0 + (w - 1) * ENDLESS_CONFIG.powScalePerWave;
  const hpMul = 1.0 + (w - 1) * ENDLESS_CONFIG.hpScalePerWave;

  return {
    id: oppId,
    wave: w,
    isBoss: isBoss,
    name: isBoss ? "Gauntlet Boss Wave " + w : "Gladiator #" + w,
    statMul: parseFloat(statMul.toFixed(2)),
    hpMul: parseFloat(hpMul.toFixed(2)),
  };
}

function endlessAdvanceWave(state, won, duelStats) {
  if (!state) return { active: false, wave: 1, score: 0 };
  if (!won) {
    state.active = false;
    return {
      active: false,
      wave: state.wave,
      score: state.score,
      highWave: Math.max(state.highWave || 1, state.wave),
    };
  }

  const waveScore = state.wave * 150 + ((duelStats && duelStats.hpLeft) ? Math.round(duelStats.hpLeft * 100) : 50);
  state.score = (state.score || 0) + waveScore;
  state.wave++;
  if (state.wave > (state.highWave || 1)) state.highWave = state.wave;

  const needsDraft = (state.wave - 1) % ENDLESS_CONFIG.draftInterval === 0;
  return {
    active: true,
    wave: state.wave,
    score: state.score,
    needsDraft: needsDraft,
    highWave: state.highWave,
  };
}

const EndlessGauntlet = {
  ENDLESS_CONFIG,
  DEF_ENDLESS_STATE,
  endlessOpponentForWave,
  endlessAdvanceWave,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = EndlessGauntlet;
}
