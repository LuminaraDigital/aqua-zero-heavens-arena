// src/modes/dojo.js
// Dojo / Practice & Frame-Data Mode sandbox & Interactive Guided Tutorial
/* =====================================================================
   AQUA ZERO HEAVENS ARENA - Dojo & Interactive Tutorial Engine
   Luminara Digital - Sparring sandbox, frame data & rule drills
   ===================================================================== */

var DojoMode = (function() {
    var config = {
        aiDummy: {
            behavior: "stand", // stand, crouch, jump, block, attack
            autoBlock: false
        },
        overlayEnabled: false,
        frameData: null,
        drills: []
    };

    var tutorial = {
        active: false,
        stage: 0,
        completed: false,
        feedback: "",
        stages: [
            {
                id: "strike_beats_throw",
                title: "DRILL 1: STRIKE BEATS THROW",
                objective: "Dummy is preparing a THROW. Execute a STRIKE to intercept!",
                rule: "STRIKE > THROW (Clean Interception)",
                dummyMove: "THROW",
                requiredMove: "STRIKE",
                hint: "Press [A] on a Strike card to counter."
            },
            {
                id: "throw_beats_guard",
                title: "DRILL 2: THROW BREAKS GUARD",
                objective: "Dummy has raised a GUARD. Execute a THROW to break their defense!",
                rule: "THROW > GUARD (Guard Break & Slam)",
                dummyMove: "GUARD",
                requiredMove: "THROW",
                hint: "Select a Throw technique to crack their guard."
            },
            {
                id: "guard_stops_strike",
                title: "DRILL 3: GUARD STOPS STRIKE",
                objective: "Dummy is launching a heavy STRIKE. Raise your GUARD to deflect it!",
                rule: "GUARD > STRIKE (Deflection & Safe Block)",
                dummyMove: "STRIKE",
                requiredMove: "GUARD",
                hint: "Guard to absorb the blow and counter on frame recovery."
            },
            {
                id: "focus_super_combo",
                title: "DRILL 4: FOCUS & COMBOS",
                objective: "Spend 1 FOCUS meter [Y] to perform a tactical read or trigger Juggle!",
                rule: "FOCUS POWERS SPECIALS & JUGGLES",
                dummyMove: "STAND",
                requiredMove: "FOCUS",
                hint: "Use [Y] button to trigger tactical focus reading."
            }
        ]
    };

    function init() {
        // Safe logger
        if (typeof console !== "undefined" && console.log) console.log("DojoMode initialized.");
    }

    function setDummyBehavior(behavior) {
        config.aiDummy.behavior = behavior;
        if (typeof console !== "undefined" && console.log) console.log("Dummy behavior set to: " + behavior);
    }

    function toggleAutoBlock(enabled) {
        config.aiDummy.autoBlock = !!enabled;
        if (typeof console !== "undefined" && console.log) console.log("Dummy auto block: " + config.aiDummy.autoBlock);
    }

    function toggleOverlay(enabled) {
        config.overlayEnabled = !!enabled;
        if (typeof console !== "undefined" && console.log) console.log("Frame data overlay: " + config.overlayEnabled);
    }

    function updateFrameData(data) {
        if (!config.overlayEnabled) return;
        config.frameData = data;
        renderOverlay();
    }

    function renderOverlay() {
        if (!config.frameData) return;
        var fd = config.frameData;
        if (typeof console !== "undefined" && console.log) {
            console.log("[FRAME DATA OVERLAY] Startup: " + fd.startup + " | Active: " + fd.active + " | Recovery: " + fd.recovery + " | Advantage: " + fd.advantage);
        }
    }

    function startRangeTravelTest() {
        if (typeof console !== "undefined" && console.log) console.log("Starting Range Travel Speed Test...");
    }

    function startRingControlDrill() {
        if (typeof console !== "undefined" && console.log) console.log("Starting Ring Control Drill...");
    }

    // Interactive Tutorial API
    function startTutorial() {
        tutorial.active = true;
        tutorial.stage = 0;
        tutorial.completed = false;
        tutorial.feedback = "Tutorial initiated. Follow the coach prompts!";
        setDummyBehavior(tutorial.stages[0].dummyMove.toLowerCase());
        return getCurrentStage();
    }

    function getCurrentStage() {
        if (!tutorial.active) return null;
        if (tutorial.stage >= tutorial.stages.length) {
            tutorial.completed = true;
            return { completed: true, title: "SPARRING GRADUATE", objective: "All core martial mechanics mastered!" };
        }
        return tutorial.stages[tutorial.stage];
    }

    function validateAction(playerAction) {
        if (!tutorial.active || tutorial.completed) return { success: true, message: "Sandbox free play." };
        var cur = tutorial.stages[tutorial.stage];
        if (!cur) return { success: true };

        var normalized = String(playerAction).toUpperCase();
        var success = (normalized === cur.requiredMove || (cur.requiredMove === "FOCUS" && (normalized === "READ" || normalized === "SPECIAL" || normalized === "FOCUS")));

        if (success) {
            tutorial.feedback = "SUCCESS! " + cur.rule;
            tutorial.stage++;
            if (tutorial.stage >= tutorial.stages.length) {
                tutorial.completed = true;
                tutorial.feedback = "MASTERED! You have graduated Dojo Sparring!";
            } else {
                setDummyBehavior(tutorial.stages[tutorial.stage].dummyMove.toLowerCase());
            }
            return { success: true, message: tutorial.feedback, nextStage: getCurrentStage() };
        } else {
            tutorial.feedback = "INCORRECT: Expected " + cur.requiredMove + " against " + cur.dummyMove + ". " + cur.hint;
            return { success: false, message: tutorial.feedback, currentStage: cur };
        }
    }

    function stopTutorial() {
        tutorial.active = false;
        tutorial.stage = 0;
        setDummyBehavior("stand");
    }

    return {
        init: init,
        setDummyBehavior: setDummyBehavior,
        toggleAutoBlock: toggleAutoBlock,
        toggleOverlay: toggleOverlay,
        updateFrameData: updateFrameData,
        startRangeTravelTest: startRangeTravelTest,
        startRingControlDrill: startRingControlDrill,
        getConfig: function() { return config; },
        // Tutorial API
        startTutorial: startTutorial,
        getCurrentStage: getCurrentStage,
        validateAction: validateAction,
        stopTutorial: stopTutorial,
        isTutorialActive: function() { return tutorial.active; },
        getTutorialState: function() { return tutorial; }
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = DojoMode;
}
