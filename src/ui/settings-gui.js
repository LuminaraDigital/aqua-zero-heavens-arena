// src/ui/settings-gui.js
// Dedicated Keybinding Remapping, Audio Volume & AI Systems GUI Controller
/* =====================================================================
   AQUA ZERO HEAVENS ARENA - Settings & Rebinding GUI Engine
   Luminara Digital - Interactive configuration, audio & AI controls
   ===================================================================== */

var SettingsGUI = (function() {
    var rebindState = {
        active: false,
        action: null,
        context: "combat",
        message: ""
    };

    var audioSettings = {
        masterVolume: 100, // 0 - 100
        sfxVolume: 100,    // 0 - 100
        bgmVolume: 80      // 0 - 100
    };

    var aiSettings = {
        adaptiveCPU: true,
        coachMode: "full",       // "full" | "compact" | "off"
        commentary: "full",      // "full" | "highlights" | "off"
        llmProvider: "offline",  // "offline" | "openai" | "gemini" | "anthropic" | "custom"
        llmKey: "",
        llmEndpoint: ""
    };

    var displaySettings = {
        displayMode: "modern",   // "modern" | "theater" | "retro"
        crtScanlines: false,
        hudOpacity: 100          // 50 - 100
    };

    function init() {
        loadAudioSettings();
        loadAISettings();
        loadDisplaySettings();
    }


    function loadAudioSettings() {
        if (typeof localStorage === "undefined") return;
        try {
            var saved = localStorage.getItem("aquazero_audio_settings");
            if (saved) {
                var parsed = JSON.parse(saved);
                audioSettings.masterVolume = parsed.masterVolume !== undefined ? parsed.masterVolume : 100;
                audioSettings.sfxVolume = parsed.sfxVolume !== undefined ? parsed.sfxVolume : 100;
                audioSettings.bgmVolume = parsed.bgmVolume !== undefined ? parsed.bgmVolume : 80;
                applyAudioSettings();
            }
        } catch (e) {}
    }

    function saveAudioSettings() {
        if (typeof localStorage === "undefined") return;
        try {
            localStorage.setItem("aquazero_audio_settings", JSON.stringify(audioSettings));
        } catch (e) {}
    }

    function loadAISettings() {
        if (typeof localStorage === "undefined") return;
        try {
            var saved = localStorage.getItem("aquazero_ai_settings");
            if (saved) {
                var parsed = JSON.parse(saved);
                if (parsed.adaptiveCPU !== undefined) aiSettings.adaptiveCPU = !!parsed.adaptiveCPU;
                if (parsed.coachMode !== undefined) aiSettings.coachMode = parsed.coachMode;
                if (parsed.commentary !== undefined) aiSettings.commentary = parsed.commentary;
                if (parsed.llmProvider !== undefined) aiSettings.llmProvider = parsed.llmProvider;
                if (parsed.llmKey !== undefined) aiSettings.llmKey = String(parsed.llmKey);
                if (parsed.llmEndpoint !== undefined) aiSettings.llmEndpoint = String(parsed.llmEndpoint);
            }
        } catch (e) {}
    }

    function saveAISettings() {
        if (typeof localStorage === "undefined") return;
        try {
            localStorage.setItem("aquazero_ai_settings", JSON.stringify(aiSettings));
        } catch (e) {}
    }

    function applyAudioSettings() {
        var masterScale = audioSettings.masterVolume / 100;
        var sfxScale = (audioSettings.sfxVolume / 100) * masterScale;
        if (typeof SFX !== "undefined" && SFX.setVolume) {
            SFX.setVolume(sfxScale);
        }
    }

    function adjustVolume(type, delta) {
        if (audioSettings[type] !== undefined) {
            audioSettings[type] = Math.max(0, Math.min(100, audioSettings[type] + delta));
            saveAudioSettings();
            applyAudioSettings();
            if (typeof SFX !== "undefined" && SFX.strikeSwoosh && type !== "bgmVolume") {
                SFX.strikeSwoosh();
            }
            return audioSettings[type];
        }
        return 0;
    }

    function getAISettings() {
        return aiSettings;
    }

    function setAISetting(key, value) {
        if (aiSettings[key] !== undefined) {
            aiSettings[key] = value;
            saveAISettings();
            return aiSettings[key];
        }
        return null;
    }

    function toggleAISetting(key) {
        if (key === "adaptiveCPU") {
            aiSettings.adaptiveCPU = !aiSettings.adaptiveCPU;
        } else if (key === "coachMode") {
            var coachModes = ["full", "compact", "off"];
            var idx = (coachModes.indexOf(aiSettings.coachMode) + 1) % coachModes.length;
            aiSettings.coachMode = coachModes[idx];
        } else if (key === "commentary") {
            var commModes = ["full", "highlights", "off"];
            var cIdx = (commModes.indexOf(aiSettings.commentary) + 1) % commModes.length;
            aiSettings.commentary = commModes[cIdx];
        } else if (key === "llmProvider") {
            var provs = ["offline", "openai", "gemini", "anthropic", "custom"];
            var pIdx = (provs.indexOf(aiSettings.llmProvider) + 1) % provs.length;
            aiSettings.llmProvider = provs[pIdx];
        }
        saveAISettings();
        return aiSettings[key];
    }

    function startRebinding(action, context) {
        rebindState.active = true;
        rebindState.action = action;
        rebindState.context = context || "combat";
        rebindState.message = "PRESS ANY KEY TO BIND TO " + action.toUpperCase() + " (ESC TO CANCEL)";
        return rebindState;
    }

    function handleKeyEvent(key) {
        if (!rebindState.active) return false;

        if (key === "Escape") {
            rebindState.active = false;
            rebindState.message = "Rebinding cancelled.";
            return true;
        }

        if (typeof Keybindings !== "undefined" && Keybindings.remap) {
            Keybindings.remap(rebindState.context, rebindState.action, key);
            rebindState.active = false;
            rebindState.message = "Bound " + rebindState.action.toUpperCase() + " to [" + key + "] successfully!";
            if (typeof SFX !== "undefined" && SFX.roundBell) {
                SFX.roundBell();
            }
            return true;
        }
        rebindState.active = false;
        return false;
    }

    function getAudioSettings() {
        return audioSettings;
    }

    function getRebindState() {
        return rebindState;
    }

    function render(ctx, W, H, selectedIndex) {
        if (!ctx) return;
        var sel = selectedIndex || 0;

        ctx.save();
        // Title
        ctx.fillStyle = "#22d3ee";
        ctx.font = "bold 20px Bahnschrift, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SYSTEM CONFIGURATION & REBINDING", W / 2, 50);

        // Subtitle
        ctx.fillStyle = "#9ca3af";
        ctx.font = "11px Bahnschrift, sans-serif";
        ctx.fillText("AUDIO MIXER, AI SYSTEMS & HARDWARE INPUT CALIBRATION", W / 2, 70);

        // Audio Sliders Panel
        var panelX = W / 2 - 240;
        ctx.fillStyle = "rgba(17, 20, 28, 0.9)";
        ctx.strokeStyle = "#2e3648";
        ctx.lineWidth = 1.5;
        ctx.fillRect(panelX, 85, 480, 110);
        ctx.strokeRect(panelX, 85, 480, 110);

        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 12px Bahnschrift, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("AUDIO MIXER", panelX + 16, 104);

        var sliders = [
            { key: "masterVolume", label: "MASTER VOLUME", val: audioSettings.masterVolume },
            { key: "sfxVolume", label: "SFX VOLUME", val: audioSettings.sfxVolume },
            { key: "bgmVolume", label: "MUSIC VOLUME", val: audioSettings.bgmVolume }
        ];

        for (var i = 0; i < sliders.length; i++) {
            var s = sliders[i];
            var sy = 124 + (i * 22);
            var isSel = (sel === i);

            ctx.fillStyle = isSel ? "#ffffff" : "#9ca3af";
            ctx.font = (isSel ? "bold " : "") + "10px Bahnschrift, sans-serif";
            ctx.fillText((isSel ? "> " : "  ") + s.label, panelX + 20, sy);

            // Slider Track
            var trackX = panelX + 180;
            var trackW = 200;
            ctx.fillStyle = "rgba(255,255,255,0.1)";
            ctx.fillRect(trackX, sy - 8, trackW, 7);

            // Slider Fill
            var fillW = (s.val / 100) * trackW;
            ctx.fillStyle = isSel ? "#22d3ee" : "#0ea5e9";
            ctx.fillRect(trackX, sy - 8, fillW, 7);

            // Value text
            ctx.fillStyle = isSel ? "#22d3ee" : "#d1d5db";
            ctx.textAlign = "right";
            ctx.fillText(s.val + "%", panelX + 440, sy);
            ctx.textAlign = "left";
        }

        // AI Configuration Panel
        ctx.fillStyle = "rgba(17, 20, 28, 0.9)";
        ctx.fillRect(panelX, 205, 480, 110);
        ctx.strokeRect(panelX, 205, 480, 110);

        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 12px Bahnschrift, sans-serif";
        ctx.fillText("AI & NARRATIVE SYSTEMS", panelX + 16, 224);

        var aiOptions = [
            { id: "adaptiveCPU", label: "ADAPTIVE OPPONENT AI", val: aiSettings.adaptiveCPU ? "ON (DYNAMIC)" : "OFF (STANDARD)" },
            { id: "coachMode", label: "CORNER COACH POST-FIGHT", val: aiSettings.coachMode.toUpperCase() },
            { id: "commentary", label: "RINGSIDE COMMENTARY", val: aiSettings.commentary.toUpperCase() },
            { id: "llmProvider", label: "GENERATIVE ENGINE", val: aiSettings.llmProvider.toUpperCase() }
        ];

        for (var k = 0; k < aiOptions.length; k++) {
            var opt = aiOptions[k];
            var oy = 244 + (k * 20);
            var isAiSel = (sel === 3 + k);

            ctx.fillStyle = isAiSel ? "#ffffff" : "#9ca3af";
            ctx.font = (isAiSel ? "bold " : "") + "10px Bahnschrift, sans-serif";
            ctx.fillText((isAiSel ? "> " : "  ") + opt.label, panelX + 20, oy);

            ctx.fillStyle = isAiSel ? "#22d3ee" : "#d1d5db";
            ctx.textAlign = "right";
            ctx.fillText("[" + opt.val + "]", panelX + 440, oy);
            ctx.textAlign = "left";
        }

        // Keybindings Panel
        ctx.fillStyle = "rgba(17, 20, 28, 0.9)";
        ctx.fillRect(panelX, 325, 480, 130);
        ctx.strokeRect(panelX, 325, 480, 130);

        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 12px Bahnschrift, sans-serif";
        ctx.fillText("COMBAT CONTROLS REBINDING", panelX + 16, 344);

        var bindings = (typeof Keybindings !== "undefined" && Keybindings.getBindings) ? Keybindings.getBindings().combat : { attack: "z", jump: "x", special: "c", dash: "Shift" };
        var actions = [
            { id: "attack", label: "ATTACK / CONFIRM (A)", key: bindings.attack },
            { id: "jump", label: "GUARD / CANCEL (B)", key: bindings.jump },
            { id: "special", label: "FOCUS / SPECIAL (Y)", key: bindings.special },
            { id: "dash", label: "DASH / EVADE", key: bindings.dash }
        ];

        for (var j = 0; j < actions.length; j++) {
            var a = actions[j];
            var ay = 364 + (j * 22);
            var isActSel = (sel === 7 + j);

            ctx.fillStyle = isActSel ? "#ffffff" : "#9ca3af";
            ctx.font = (isActSel ? "bold " : "") + "10px Bahnschrift, sans-serif";
            ctx.fillText((isActSel ? "> " : "  ") + a.label, panelX + 20, ay);

            // Key badge box
            ctx.fillStyle = isActSel ? "#e6392f" : "#1f2430";
            ctx.fillRect(panelX + 340, ay - 11, 100, 16);
            ctx.strokeStyle = isActSel ? "#ff6b61" : "#2e3648";
            ctx.strokeRect(panelX + 340, ay - 11, 100, 16);

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 9px Bahnschrift, monospace";
            ctx.textAlign = "center";
            ctx.fillText(String(a.key).toUpperCase(), panelX + 390, ay);
            ctx.textAlign = "left";
        }

        // Rebinding active overlay prompt
        if (rebindState.active) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "#fbbf24";
            ctx.font = "bold 18px Bahnschrift, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("REBINDING INPUT", W / 2, H / 2 - 20);

            ctx.fillStyle = "#ffffff";
            ctx.font = "13px Bahnschrift, sans-serif";
            ctx.fillText(rebindState.message, W / 2, H / 2 + 10);
        }

        ctx.restore();
    }

    function loadDisplaySettings() {
        if (typeof localStorage === "undefined") return;
        try {
            var saved = localStorage.getItem("aquazero_display_settings");
            if (saved) {
                var parsed = JSON.parse(saved);
                if (parsed.displayMode !== undefined) displaySettings.displayMode = parsed.displayMode;
                if (parsed.crtScanlines !== undefined) displaySettings.crtScanlines = !!parsed.crtScanlines;
                if (parsed.hudOpacity !== undefined) displaySettings.hudOpacity = Number(parsed.hudOpacity);
            }
            applyDisplaySettings();
        } catch (e) {}
    }

    function saveDisplaySettings() {
        if (typeof localStorage === "undefined") return;
        try {
            localStorage.setItem("aquazero_display_settings", JSON.stringify(displaySettings));
        } catch (e) {}
    }

    function applyDisplaySettings() {
        if (typeof document === "undefined" || !document.body) return;
        document.body.dataset.displayMode = displaySettings.displayMode;
        document.body.classList.toggle("display-mode-theater", displaySettings.displayMode === "theater");
        document.body.classList.toggle("display-mode-retro", displaySettings.displayMode === "retro");
        document.body.classList.toggle("display-mode-modern", displaySettings.displayMode === "modern");
        document.body.classList.toggle("crt-scanlines", !!displaySettings.crtScanlines);
        if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
            window.dispatchEvent(new CustomEvent("display_mode_changed", { detail: displaySettings }));
        }

    }

    function getDisplaySettings() {
        return displaySettings;
    }

    function setDisplaySetting(key, value) {
        if (displaySettings[key] !== undefined) {
            displaySettings[key] = value;
            saveDisplaySettings();
            applyDisplaySettings();
            return displaySettings[key];
        }
        return null;
    }

    function toggleDisplaySetting(key) {
        if (key === "displayMode") {
            var modes = ["modern", "theater", "retro"];
            var idx = (modes.indexOf(displaySettings.displayMode) + 1) % modes.length;
            displaySettings.displayMode = modes[idx];
        } else if (key === "crtScanlines") {
            displaySettings.crtScanlines = !displaySettings.crtScanlines;
        }
        saveDisplaySettings();
        applyDisplaySettings();
        return displaySettings[key];
    }

    init();

    return {
        init: init,
        adjustVolume: adjustVolume,
        getAISettings: getAISettings,
        setAISetting: setAISetting,
        toggleAISetting: toggleAISetting,
        getDisplaySettings: getDisplaySettings,
        setDisplaySetting: setDisplaySetting,
        toggleDisplaySetting: toggleDisplaySetting,
        applyDisplaySettings: applyDisplaySettings,
        startRebinding: startRebinding,
        handleKeyEvent: handleKeyEvent,
        getAudioSettings: getAudioSettings,
        getRebindState: getRebindState,
        render: render
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = SettingsGUI;
}

