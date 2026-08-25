// src/ui/replay-viewer.js
// Main menu match replay viewer UI state and step-by-step playback controls

var ReplayViewer = (function() {
    var state = {
        activeReplay: null,
        currentStep: 0,
        isPlaying: false,
        playbackSpeed: 1.0, // 0.5x, 1.0x, 2.0x
        timer: null
    };

    function loadReplay(replayData) {
        state.activeReplay = typeof replayData === "string" ? 
            ReplayEngine.importFromWS(replayData) : replayData;
        state.currentStep = 0;
        state.isPlaying = false;
        if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
        }
        return !!state.activeReplay;
    }

    function play(onStepCallback) {
        if (!state.activeReplay) return;
        state.isPlaying = true;
        if (state.timer) clearInterval(state.timer);

        var intervalMs = 1000 / state.playbackSpeed;
        state.timer = setInterval(function() {
            if (state.currentStep < state.activeReplay.turns.length - 1) {
                state.currentStep++;
                if (typeof onStepCallback === "function") {
                    onStepCallback(getCurrentTurn());
                }
            } else {
                pause();
            }
        }, intervalMs);
    }

    function pause() {
        state.isPlaying = false;
        if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
        }
    }

    function stepNext() {
        if (!state.activeReplay) return null;
        pause();
        if (state.currentStep < state.activeReplay.turns.length - 1) {
            state.currentStep++;
        }
        return getCurrentTurn();
    }

    function stepPrev() {
        if (!state.activeReplay) return null;
        pause();
        if (state.currentStep > 0) {
            state.currentStep--;
        }
        return getCurrentTurn();
    }

    function setSpeed(speed) {
        state.playbackSpeed = speed;
        if (state.isPlaying) {
            play();
        }
    }

    function getCurrentTurn() {
        if (!state.activeReplay || !state.activeReplay.turns[state.currentStep]) {
            return null;
        }
        return {
            stepIndex: state.currentStep,
            totalSteps: state.activeReplay.turns.length,
            turn: state.activeReplay.turns[state.currentStep],
            p1: state.activeReplay.p1,
            p2: state.activeReplay.p2
        };
    }

    return {
        loadReplay: loadReplay,
        play: play,
        pause: pause,
        stepNext: stepNext,
        stepPrev: stepPrev,
        setSpeed: setSpeed,
        getCurrentTurn: getCurrentTurn,
        getState: function() { return state; }
    };
})();

if (typeof window !== "undefined") {
    window.ReplayViewer = ReplayViewer;
}
