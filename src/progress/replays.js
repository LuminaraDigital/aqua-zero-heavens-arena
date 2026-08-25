// src/progress/replays.js
// Replay Transcripts Engine for exporting and importing match turn streams

var ReplayEngine = (function() {
    var CURRENT_REPLAY_VERSION = 1;

    function safeBtoa(str) {
        if (typeof btoa === "function") return btoa(str);
        if (typeof Buffer !== "undefined") return Buffer.from(str, "utf8").toString("base64");
        return str;
    }

    function safeAtob(b64) {
        if (typeof atob === "function") return atob(b64);
        if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64").toString("utf8");
        return b64;
    }

    function createReplay(p1, p2, seed) {
        return {
            version: CURRENT_REPLAY_VERSION,
            timestamp: Date.now(),
            seed: seed || Math.floor(Math.random() * 1000000),
            p1: { name: p1.name || "P1", fighterId: p1.id },
            p2: { name: p2.name || "P2", fighterId: p2.id },
            turns: []
        };
    }

    function recordTurn(replay, turnData) {
        if (!replay || !replay.turns) return;
        replay.turns.push({
            turnNum: turnData.turnNum || replay.turns.length + 1,
            p1Tech: turnData.p1Tech,
            p2Tech: turnData.p2Tech,
            p1Hp: turnData.p1Hp,
            p2Hp: turnData.p2Hp,
            range: turnData.range,
            position: turnData.position
        });
    }

    function exportToJSON(replay) {
        return JSON.stringify(replay);
    }

    function importFromJSON(jsonStr) {
        try {
            var replay = JSON.parse(jsonStr);
            if (replay && replay.version && Array.isArray(replay.turns)) {
                return replay;
            }
        } catch (e) {
            console.error("Invalid replay JSON format", e);
        }
        return null;
    }

    function exportToWS(replay) {
        var jsonStr = JSON.stringify(replay);
        return "AZHA_REPLAY_WS_v1:" + safeBtoa(encodeURIComponent(jsonStr));
    }

    function importFromWS(wsStr) {
        if (!wsStr || typeof wsStr !== "string") return null;
        if (wsStr.startsWith("AZHA_REPLAY_WS_v1:")) {
            try {
                var base64Part = wsStr.substring("AZHA_REPLAY_WS_v1:".length);
                var decodedStr = decodeURIComponent(safeAtob(base64Part));
                return importFromJSON(decodedStr);
            } catch (e) {
                console.error("Failed to decode WS replay string", e);
            }
        }
        return importFromJSON(wsStr);
    }

    return {
        createReplay: createReplay,
        recordTurn: recordTurn,
        exportToJSON: exportToJSON,
        importFromJSON: importFromJSON,
        exportToWS: exportToWS,
        importFromWS: importFromWS
    };
})();

if (typeof window !== "undefined") {
    window.ReplayEngine = ReplayEngine;
}
