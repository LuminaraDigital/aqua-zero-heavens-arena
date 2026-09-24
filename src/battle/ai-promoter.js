/* =====================================================================
   Aqua Zero Heavens Arena - Autonomous AI Fight Promoter & Contract Engine
   Luminara Digital

   Mimics professional MMA fighter pay (Show/Win/Performance bonuses),
   sets pre-bout Vegas betting lines, autonomously awards Performance of
   the Night (POTN) & Fight of the Night (FOTN) based on telemetry, and
   enforces realistic training camp / corner deductions.
   ===================================================================== */

const AIPromoter = (function () {
  const BASE_CONTRACT = {
    show: 12,        // Guaranteed show purse (loser's cheque)
    win: 28,         // Win bonus (doubles and elevates base)
    finish: 15,      // Flat KO or Submission finish bonus
    potn: 35,        // Performance of the Night
    fotn: 40,        // Fight of the Night (both corners)
    campFeeRate: 0.10,    // 10% gym/camp preparation fee
    cornerFeeRate: 0.10,  // 10% corner team / cutman fee
  };

  /**
   * Generates a pre-bout fight contract with show/win figures and odds.
   */
  function generateContract(pFid, eFid, stage, level, oppLevel, isNemesis, matchType) {
    const s = Math.max(1, Math.min(6, stage || 1));
    const pLv = level || 1;
    const eLv = oppLevel || 1;
    const stageMultiplier = 1 + 0.35 * (s - 1);

    const baseShow = Math.round(BASE_CONTRACT.show * stageMultiplier);
    const baseWin = Math.round(BASE_CONTRACT.win * stageMultiplier);
    const finishBonus = Math.round(BASE_CONTRACT.finish * stageMultiplier);
    const potnBonus = Math.round(BASE_CONTRACT.potn * stageMultiplier);
    const fotnBonus = Math.round(BASE_CONTRACT.fotn * stageMultiplier);

    const odds = calculateMatchOdds(pFid, eFid, pLv, eLv);

    return {
      contractId: "CTR_" + Date.now().toString(36).toUpperCase(),
      stage: s,
      matchType: matchType || "adventure",
      showMoney: baseShow,
      winBonus: baseWin,
      finishBonus: finishBonus,
      potnBonus: potnBonus,
      fotnBonus: fotnBonus,
      isNemesis: !!isNemesis,
      grudgeBonus: isNemesis ? Math.round(20 * stageMultiplier) : 0,
      odds: odds,
      campFeeRate: BASE_CONTRACT.campFeeRate,
      cornerFeeRate: BASE_CONTRACT.cornerFeeRate,
    };
  }

  /**
   * Calculates dynamic Vegas-style match odds from levels and attributes.
   */
  function calculateMatchOdds(pFid, eFid, pLevel, eLevel) {
    let pPower = (pLevel || 1) * 10;
    let ePower = (eLevel || 1) * 10;

    // Fold in attributes if BIOS/FIGHTERS globals exist
    const getBio = (fid) => {
      if (typeof bioOf === "function") return bioOf(fid);
      if (typeof BIOS !== "undefined") {
        if (BIOS[fid]) return BIOS[fid];
        if (typeof FIGHTERS !== "undefined" && FIGHTERS[fid] && BIOS[FIGHTERS[fid].name]) return BIOS[FIGHTERS[fid].name];
      }
      return null;
    };
    const pBio = getBio(pFid);
    const eBio = getBio(eFid);
    if (pBio && pBio.a) pPower += pBio.a.reduce((acc, v) => acc + (v || 0), 0) * 0.2;
    if (eBio && eBio.a) ePower += eBio.a.reduce((acc, v) => acc + (v || 0), 0) * 0.2;

    const diff = pPower - ePower;
    const pProb = Math.max(0.15, Math.min(0.85, 0.5 + diff * 0.025));

    let playerMoneyline = -110;
    let oppMoneyline = +110;

    if (pProb >= 0.5) {
      playerMoneyline = -Math.round((pProb / (1 - pProb)) * 100);
      oppMoneyline = +Math.round(((1 - pProb) / pProb) * 100);
      if (oppMoneyline < 100) oppMoneyline = 100;
    } else {
      playerMoneyline = +Math.round(((1 - pProb) / pProb) * 100);
      oppMoneyline = -Math.round((pProb / (1 - pProb)) * 100);
    }

    return {
      playerProb: Math.round(pProb * 100),
      oppProb: Math.round((1 - pProb) * 100),
      playerLine: (playerMoneyline > 0 ? "+" : "") + playerMoneyline,
      oppLine: (oppMoneyline > 0 ? "+" : "") + oppMoneyline,
      isUnderdog: pProb < 0.45,
      isHeavyFavorite: pProb > 0.65,
    };
  }

  /**
   * Evaluates post-fight performance telemetry to award bonuses and calculate net pay.
   */
  function evaluateFightPay(contract, duelStats, coachAnalysis, styleState) {
    const ctr = contract || generateContract(0, 1, 1, 1, 1, false, "adventure");
    const st = duelStats || {};
    const coach = coachAnalysis || {};
    const style = styleState || {};
    const won = !!st.win;

    let show = ctr.showMoney;
    let win = won ? ctr.winBonus : 0;
    let finish = 0;
    let potn = 0;
    let fotn = 0;
    let grudge = 0;
    let upset = 0;
    let eventTokensEarned = 0;

    const turns = Math.max(1, st.turns || 1);
    const dealt = Math.max(0, st.dmgDealt || 0);
    const taken = Math.max(0, st.dmgTaken || 0);
    const isKO = st.koClass === "STRIKE" || st.koClass === "SUB";

    if (won) {
      // Finish Bonus
      if (isKO) finish = ctr.finishBonus;

      // Performance of the Night (POTN): Clinical excellence
      const isPerfect = !!st.perfect || taken === 0;
      const isHighStyle = style.grade === "S" || style.grade === "SSS";
      const isCoachMastery = (coach.tacticsGrade === "S" || coach.tacticsGrade === "A") && (coach.execGrade === "S" || coach.execGrade === "A");
      const isSpeedBlitz = turns <= 5 && dealt >= 60;

      if (isPerfect || isHighStyle || (isCoachMastery && isKO) || isSpeedBlitz) {
        potn = ctr.potnBonus;
        eventTokensEarned += 1;
      }

      // Underdog upset payout
      if (ctr.odds && ctr.odds.isUnderdog) {
        upset = Math.round(ctr.winBonus * 0.4);
        eventTokensEarned += 1;
      }

      // Grudge Nemesis settlement
      if (ctr.isNemesis) {
        grudge = ctr.grudgeBonus;
      }
    }

    // Fight of the Night (FOTN): Gritty back-and-forth thriller (awarded win or lose)
    const isWar = turns >= 6 && dealt >= 45 && taken >= 40;
    const isComeback = won && (st.minHpRatio || 1.0) <= 0.25; // Survived near-death
    if (isWar || isComeback) {
      fotn = ctr.fotnBonus;
      eventTokensEarned += 1;
    }

    const gross = show + win + finish + potn + fotn + grudge + upset;

    // Real-life MMA deductions: 10% camp preparation, 10% corner team
    const campFee = Math.round(gross * ctr.campFeeRate);
    const cornerFee = Math.round(gross * ctr.cornerFeeRate);
    const totalDeductions = campFee + cornerFee;
    const net = Math.max(1, gross - totalDeductions);

    // AI Promoter Commentary
    let headline = "Standard bout settlement concluded.";
    if (potn > 0 && fotn > 0) {
      headline = "DOUBLE BONUS: Sensational war! Fight & Performance of the Night honors awarded!";
    } else if (potn > 0) {
      headline = "PERFORMANCE BONUS: A masterful technical clinic! $35k equivalent POTN awarded.";
    } else if (fotn > 0) {
      headline = "FIGHT OF THE NIGHT: An absolute brawl! Both fighters awarded FOTN bonuses.";
    } else if (won && isKO) {
      headline = "DECISIVE FINISH: Clean stoppage inside the distance earns finish incentive.";
    } else if (!won) {
      headline = "BOUT CONCLUDED: Show purse paid. Return to the gym to rebuild.";
    }

    return {
      contractId: ctr.contractId,
      won: won,
      breakdown: {
        show: show,
        win: win,
        finish: finish,
        potn: potn,
        fotn: fotn,
        grudge: grudge,
        upset: upset,
      },
      grossPurse: gross,
      deductions: {
        campFee: campFee,
        cornerFee: cornerFee,
        total: totalDeductions,
      },
      netPurse: net,
      eventTokens: eventTokensEarned,
      headline: headline,
      potnAwarded: potn > 0,
      fotnAwarded: fotn > 0,
    };
  }

  return {
    generateContract: generateContract,
    calculateMatchOdds: calculateMatchOdds,
    evaluateFightPay: evaluateFightPay,
    BASE_CONTRACT: BASE_CONTRACT,
  };
})();

if (typeof window !== "undefined") {
  window.AIPromoter = AIPromoter;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = AIPromoter;
}
