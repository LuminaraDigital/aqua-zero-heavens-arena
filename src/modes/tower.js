// src/modes/tower.js
// 200-Floor Heavens Arena Tower Mode with Multi-Phase Milestone Bosses
/* =====================================================================
   Aqua Zero Heavens Arena - Tower of Heavens & Milestone Boss Engine
   Luminara Digital - Multi-phase boss encounters and tactical floor rules
   ===================================================================== */

var TowerMode = (function() {
    var state = {
        currentFloor: 1,
        maxFloor: 200,
        unlockedFloors: 1,
        floorRules: [],
        floorMasters: {},
        activeBossPhase: 1
    };

    var RULES = {
        CLINCH_ONLY: "Clinch-Only Mat Rules",
        STAMINA_DRAIN: "Stamina Drain Hazards",
        NO_TELL: "No-Tell Dark Matches",
        CAGE_WALLS: "Steel Cage Enclosure - Wall Escapes Active",
        UNDERGROUND_PIT: "Underground Pit - Uncapped Power",
        STANDARD: "Standard Rules"
    };

    var MILESTONE_BOSSES = {
        50: {
            title: "Gatekeeper of Copper Peak",
            phases: 2,
            phase2Threshold: 0.30,
            phase2Buff: { dmgMul: 1.15, stamRecover: 30, aura: "AURA_COPPER", title: "Enraged Gatekeeper" }
        },
        100: {
            title: "Silver Division Sovereign",
            phases: 2,
            phase2Threshold: 0.35,
            phase2Buff: { dmgMul: 1.20, stamRecover: 40, aura: "AURA_SILVER", title: "Second Wind Sovereign" }
        },
        150: {
            title: "Obsidian Mat Executioner",
            phases: 2,
            phase2Threshold: 0.35,
            phase2Buff: { dmgMul: 1.25, stamRecover: 50, aura: "AURA_OBSIDIAN", title: "Bloodbound Executioner" }
        },
        200: {
            title: "Supreme Sovereign of the Heavens",
            phases: 3,
            phase2Threshold: 0.65,
            phase3Threshold: 0.30,
            phase2Buff: { dmgMul: 1.20, stamRecover: 45, aura: "AURA_GOLDEN", stance: "CLINCH_MASTER", title: "Awakened Sovereign" },
            phase3Buff: { dmgMul: 1.40, stamRecover: 60, aura: "AURA_HEAVENS", stance: "GROUND_DEITY", title: "Apex Transcendence" }
        }
    };

    function generateFloorRule(floorNum) {
        if (floorNum % 50 === 0) return RULES.STANDARD;
        if (floorNum % 10 === 0) return (floorNum % 20 === 0) ? RULES.CAGE_WALLS : RULES.UNDERGROUND_PIT;
        var rand = Math.random();
        if (rand < 0.20) return RULES.CLINCH_ONLY;
        if (rand < 0.35) return RULES.STAMINA_DRAIN;
        if (rand < 0.50) return RULES.NO_TELL;
        if (rand < 0.65) return RULES.CAGE_WALLS;
        return RULES.STANDARD;
    }

    function generateFloorMaster(floorNum) {
        if (MILESTONE_BOSSES[floorNum]) {
            var b = MILESTONE_BOSSES[floorNum];
            return {
                name: b.title,
                milestone: true,
                phases: b.phases,
                difficultyMult: 1.2 + (floorNum / 100),
                rewards: floorNum * 250,
                bossConfig: b
            };
        }
        if (floorNum % 10 === 0) {
            return {
                name: "Floor Master " + floorNum,
                milestone: false,
                difficultyMult: 1 + (floorNum / 100),
                rewards: floorNum * 100
            };
        }
        return null;
    }

    function init() {
        for (var i = 1; i <= state.maxFloor; i++) {
            state.floorRules[i] = generateFloorRule(i);
            state.floorMasters[i] = generateFloorMaster(i);
        }
        loadSave();
        console.log("TowerMode initialized. Max floor: " + state.maxFloor);
    }

    function startFloor(floorNum) {
        if (floorNum > state.unlockedFloors) {
            console.log("Floor " + floorNum + " is locked!");
            return false;
        }
        state.currentFloor = floorNum;
        state.activeBossPhase = 1;
        console.log("Starting floor " + floorNum);
        console.log("Rule: " + state.floorRules[floorNum]);
        if (state.floorMasters[floorNum]) {
            console.log("Challenger: " + state.floorMasters[floorNum].name);
        }
        return true;
    }

    function checkBossPhaseTransition(floorNum, currentHp, maxHp) {
        var boss = MILESTONE_BOSSES[floorNum];
        if (!boss || !maxHp || maxHp <= 0) return null;
        var hpPct = currentHp / maxHp;

        if (boss.phases === 3) {
            if (state.activeBossPhase === 1 && hpPct <= boss.phase2Threshold) {
                state.activeBossPhase = 2;
                return { phase: 2, buff: boss.phase2Buff, message: "BOSS PHASE 2: " + boss.phase2Buff.title };
            } else if (state.activeBossPhase === 2 && hpPct <= boss.phase3Threshold) {
                state.activeBossPhase = 3;
                return { phase: 3, buff: boss.phase3Buff, message: "FINAL PHASE: " + boss.phase3Buff.title };
            }
        } else if (boss.phases === 2) {
            if (state.activeBossPhase === 1 && hpPct <= boss.phase2Threshold) {
                state.activeBossPhase = 2;
                return { phase: 2, buff: boss.phase2Buff, message: "SECOND WIND: " + boss.phase2Buff.title };
            }
        }
        return null;
    }

    function winFloor() {
        var rewards = 50;
        if (state.floorMasters[state.currentFloor]) {
            rewards = state.floorMasters[state.currentFloor].rewards;
            console.log("Defeated Floor Master!");
        }
        console.log("Won floor " + state.currentFloor + ". Reward: " + rewards);
        if (state.currentFloor === state.unlockedFloors && state.unlockedFloors < state.maxFloor) {
            state.unlockedFloors++;
            console.log("Unlocked floor " + state.unlockedFloors);
        }
        saveProgress();
        return { floor: state.currentFloor, rewards: rewards, unlocked: state.unlockedFloors };
    }

    function loadSave() {
        try {
            var saved = localStorage.getItem("HeavensArenaTower");
            if (saved) {
                var parsed = JSON.parse(saved);
                state.unlockedFloors = parsed.unlockedFloors || 1;
            }
        } catch (e) {
            console.warn("Failed to load tower save", e);
        }
    }

    function saveProgress() {
        try {
            localStorage.setItem("HeavensArenaTower", JSON.stringify({
                unlockedFloors: state.unlockedFloors
            }));
        } catch (e) {
            console.warn("Failed to save tower progress", e);
        }
    }

    return {
        init: init,
        startFloor: startFloor,
        winFloor: winFloor,
        checkBossPhaseTransition: checkBossPhaseTransition,
        getState: function() { return state; },
        RULES: RULES,
        MILESTONE_BOSSES: MILESTONE_BOSSES
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = TowerMode;
}
