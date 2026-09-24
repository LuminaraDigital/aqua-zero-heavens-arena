/* =====================================================================
   Aqua Zero Heavens Arena - AI Corner Coach Post-Fight Diagnostic Engine
   Luminara Digital

   Analyzes match telemetry and timeline data post-bout to deliver
   insightful, actionable tactical breakdowns and discipline grades
   (Tactics, Stamina, Ringcraft, Execution) with deterministic offline
   heuristics and optional LLM narrative synthesis.
   ===================================================================== */

const AICoach = (function() {
  function letterForScore(score) {
    if (score >= 90) return "S";
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 55) return "C";
    if (score >= 40) return "D";
    return "F";
  }

  function analyzeBout(d, pSide, eSide) {
    if (!d) return null;
    const p = pSide || d.p;
    const e = eSide || d.e;
    const st = d.stats || {};
    const tracker = d.adaptiveTracker || null;
    const won = p && p.hp > 0 && (!e || e.hp <= 0);

    const turns = Math.max(1, st.turns || d.turn || 1);
    const dealt = Math.max(0, st.dmgDealt || 0);
    const taken = Math.max(0, st.dmgTaken || 0);

    // 1. Tactics Score (Tell countering, class synergy, comfort)
    let tacticsScore = 70;
    if (tracker) {
      const tellTotal = (tracker.tellsRespected || 0) + (tracker.tellsIgnored || 0);
      if (tellTotal > 0) {
        tacticsScore += Math.round(((tracker.tellsRespected / tellTotal) - 0.5) * 40);
      }
    }
    if (won) tacticsScore += 10;
    tacticsScore = Math.max(20, Math.min(100, tacticsScore));

    // 2. Stamina Management Score
    let stamScore = 75;
    if (tracker) {
      if (tracker.lowStamAttacks > 2) stamScore -= tracker.lowStamAttacks * 10;
      if (tracker.lowStamGuards > 0) stamScore += 5; // good recovery instinct
    }
    if (p && p.stam <= 0) stamScore -= 15;
    stamScore = Math.max(20, Math.min(100, stamScore));

    // 3. Ringcraft Score
    let ringScore = 70;
    if (st.cornerDamageDealt > 0) ringScore += 15;
    if (st.cornerDamageTaken > 0) ringScore -= 15;
    if (st.escapes > 0) ringScore += 10;
    ringScore = Math.max(20, Math.min(100, ringScore));

    // 4. Execution Score (Hit rate, combo chains, perfect guards)
    let execScore = 65;
    if (st.strikes > 0 || st.throws > 0 || st.subs > 0) execScore += 10;
    if (st.perfectGuards > 0) execScore += Math.min(15, st.perfectGuards * 5);
    if (st.bestCombo && st.bestCombo >= 2) execScore += 10;
    if (won && (p.hp / (p.maxhp || 100)) > 0.5) execScore += 10;
    execScore = Math.max(20, Math.min(100, execScore));

    const overallNumeric = Math.round((tacticsScore * 0.3) + (stamScore * 0.25) + (ringScore * 0.2) + (execScore * 0.25));

    // Synthesize structured advice bullets
    const bullets = [];
    /* THE SAME NAME THE HUD PRINTS, not a roster first name.
       sideName() in page.template.html is the one source of truth for what
       a corner is called - it already knows that an AZX Force patrol is a
       borrowed roster card wearing a silhouette. Reading FIGHTERS[fid]
       directly bypassed it, so the coach panel said "Defeat against Mike"
       while the HUD above it said AZX FORCE. That is the bug workstream C
       existed to kill; it only became reachable here once the coach was
       wired to the results screen, after C had shipped. */
    /* the whole HUD string, not its first word: "AZX FORCE" is the name,
       and acceptance criterion 7 is that the HUD and everything reading
       off it print the SAME string. Shortening to a first name here is how
       the two drifted apart in the first place. */
    const displayName = (side, fallback) => {
      if (typeof sideName === "function" && d && d.p && d.e && side) {
        try {
          const n = String(sideName(d, side) || "").trim();
          if (n) return n;
        } catch (err) { /* fall through to the roster */ }
      }
      return (side && FIGHTERS && FIGHTERS[side.fid]) ? FIGHTERS[side.fid].name : fallback;
    };
    const pFighterName = displayName(p, "Fighter");
    const eFighterName = displayName(e, "Opponent");

    // Bullet 1: Range & Matchup Key
    if (tracker && tracker.rangeOccupancy) {
      const topRange = Object.keys(tracker.rangeOccupancy).reduce((a, b) => (tracker.rangeOccupancy[a] > tracker.rangeOccupancy[b] ? a : b), "MID");
      if (won) {
        bullets.push(`Excellent distance management: controlled ${topRange} range where your style had the advantage.`);
      } else {
        bullets.push(`Disadvantaged at ${topRange} range against ${eFighterName}. Shift ranges early via takedowns or push techniques.`);
      }
    } else {
      bullets.push(won ? `Maintained offensive initiative across the exchanges.` : `Opponent controlled the pace and range of engagement.`);
    }

    // Bullet 2: Stamina & Defense Note
    if (tracker && tracker.lowStamAttacks > 1) {
      bullets.push(`Caution: Threw ${tracker.lowStamAttacks} strikes on an empty gas tank (-30% damage and high whiff penalty). Use GUARD to reset stamina.`);
    } else if (st.perfectGuards > 0) {
      bullets.push(`Sharp timing: Landed ${st.perfectGuards} Perfect Guard(s) to mitigate heavy incoming damage.`);
    } else {
      bullets.push(`Pacing was disciplined with clean stamina conservation between exchanges.`);
    }

    // Bullet 3: Actionable Drill
    if (ringScore < 60) {
      bullets.push(`Drill: Practice "Ring Circle" on the ropes to escape corner pressure traps.`);
    } else if (tacticsScore < 65) {
      bullets.push(`Drill: Watch the CPU tell icon before committing to exploit high-risk spinning attacks.`);
    } else {
      bullets.push(`Drill: Incorporate 2-3 link combinations to maximize damage during stun windows.`);
    }

    const summary = won
      ? `Victorious performance. ${pFighterName} displayed solid ring generalship against ${eFighterName}.`
      : `Defeat against ${eFighterName}. Key adjustments needed in stamina discipline and range transition.`;

    return {
      won: won,
      grades: {
        tactics: letterForScore(tacticsScore),
        stamina: letterForScore(stamScore),
        ringcraft: letterForScore(ringScore),
        execution: letterForScore(execScore),
      },
      overallGrade: letterForScore(overallNumeric),
      overallScore: overallNumeric,
      summary: summary,
      bullets: bullets,
      telemetry: {
        turns: turns,
        dealt: dealt,
        taken: taken,
        perfectGuards: st.perfectGuards || 0,
        bestCombo: st.bestCombo || 0,
      },
    };
  }

  function formatLLMPrompt(analysis, pName, eName) {
    if (!analysis) return "";
    return `You are a veteran combat sports corner coach in Heavens Arena. Give a 2-sentence gritty, insightful post-fight review for ${pName} after ${analysis.won ? "defeating" : "losing to"} ${eName}. Mention: Grade ${analysis.overallGrade}, ${analysis.bullets[0]} Keep tone authentic, tactical, concise.`;
  }

  return {
    analyzeBout: analyzeBout,
    formatLLMPrompt: formatLLMPrompt,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = AICoach;
}
