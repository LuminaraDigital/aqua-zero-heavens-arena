// src/ui/card-tooltip.js
// Interactive Card & Move Tooltip Breakdown for Combat, Draft, and Gym
/* =====================================================================
   AQUA ZERO HEAVENS ARENA - Card Tooltip Engine
   Luminara Digital - Cyber-Esports broadcast combat intelligence
   ===================================================================== */

var CardTooltip = (function() {
    var activeTooltip = null;
    var hoverTimer = 0;
    var TYPE_LABELS = {
        0: { name: "STRIKE", icon: "[S]", glyph: "\uD83E\uDD4A", beats: "Beats Throw", color: "#e6392f", badge: "STR" },
        1: { name: "THROW", icon: "[T]", glyph: "\uD83E\uDD4B", beats: "Breaks Guard", color: "#f59e0b", badge: "THR" },
        2: { name: "GUARD", icon: "[G]", glyph: "\uD83D\uDEE1\uFE0F", beats: "Stops Strike", color: "#22d3ee", badge: "GRD" },
        3: { name: "FOCUS", icon: "[F]", glyph: "\uD83E\uDDB6", beats: "Tactical Tech", color: "#10b981", badge: "FOC" },
        4: { name: "SUB", icon: "[U]", glyph: "\uD83D\uDD12", beats: "Ground Lock", color: "#a855f7", badge: "SUB" }
    };

    var DISC_COLORS = {
        boxing: "#38bdf8",
        kickboxing: "#06b6d4",
        muaythai: "#ef4444",
        lethwei: "#dc2626",
        taekwondo: "#38bdf8",
        shotokan: "#f97316",
        kyokushin: "#ea580c",
        judo: "#d97706",
        wrestling: "#eab308",
        sambo: "#ec4899",
        bjj: "#a855f7",
        catchwrestling: "#8b5cf6",
        wingchun: "#10b981",
        capoeira: "#14b8a6",
        pankration: "#f43f5e",
        savate: "#0ea5e9"
    };

    function getTypeInfo(type) {
        if (typeof type === "string") {
            var upper = type.toUpperCase();
            if (upper.indexOf("STR") >= 0) return TYPE_LABELS[0];
            if (upper.indexOf("THR") >= 0) return TYPE_LABELS[1];
            if (upper.indexOf("SUB") >= 0) return TYPE_LABELS[4];
            if (upper.indexOf("GRD") >= 0 || upper.indexOf("BLK") >= 0) return TYPE_LABELS[2];
            return TYPE_LABELS[3];
        }
        return TYPE_LABELS[type] || TYPE_LABELS[0];
    }

    function formatCardDetails(card, fighter) {
        if (!card) return null;
        var typeInfo = getTypeInfo(card.cls !== undefined ? card.cls : (card.type !== undefined ? card.type : 0));
        var pow = card.pow !== undefined ? card.pow : (card.power || 0);
        var name = card.name || card.reading || ("Technique #" + (card.slot !== undefined ? card.slot : 1));
        var speedTier = pow >= 25 ? "Slow (Heavy)" : (pow <= 12 ? "Fast (Light)" : "Medium (Standard)");
        var focusCost = card.focusCost || (pow > 20 ? 1 : 0);
        var synergy = card.synergy || "";
        var disc = card.disc || card.discipline || "";
        var range = card.range || "MID";

        if (fighter && fighter.archetype && !synergy) {
            var arch = fighter.archetype.toLowerCase();
            if (arch === "striker" && typeInfo.name === "STRIKE") synergy = "+10% Impact Velocity";
            else if (arch === "grappler" && typeInfo.name === "THROW") synergy = "+15% Throw Clinch";
            else if (arch === "out-fighter" && pow <= 14) synergy = "Evade Advantage";
        }

        return {
            name: name,
            type: typeInfo.name,
            badge: typeInfo.badge,
            glyph: typeInfo.glyph,
            beats: typeInfo.beats,
            color: typeInfo.color,
            disc: disc,
            discColor: DISC_COLORS[disc.toLowerCase()] || "#94a3b8",
            range: range,
            power: pow,
            speedTier: speedTier,
            focusCost: focusCost,
            synergy: synergy,
            flag: card.flag || 0,
            desc: card.desc || (typeInfo.name + " technique. " + typeInfo.beats + ".")
        };
    }

    function setHoverCard(card, fighter, x, y) {
        if (!card) {
            activeTooltip = null;
            hoverTimer = 0;
            return;
        }
        activeTooltip = {
            data: formatCardDetails(card, fighter),
            x: x || 0,
            y: y || 0
        };
        hoverTimer = 1;
    }

    function clear() {
        activeTooltip = null;
        hoverTimer = 0;
    }

    function render(ctx, customW, customH) {
        if (!activeTooltip || !activeTooltip.data || !ctx) return;
        var d = activeTooltip.data;
        var w = customW || 240;
        var h = customH || 134;
        var x = activeTooltip.x;
        var y = activeTooltip.y - h - 12;

        // Boundary checks
        if (x + w > 940) x = 940 - w;
        if (x < 20) x = 20;
        if (y < 20) y = activeTooltip.y + 70; // flip below if at top

        ctx.save();
        // Glass backdrop panel
        ctx.fillStyle = "rgba(12, 15, 22, 0.94)";
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 1.5;
        if (typeof ctx.roundRect === "function") {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 8);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
        }

        // Header Type Badge
        ctx.fillStyle = d.color;
        ctx.fillRect(x + 10, y + 10, 44, 18);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px Bahnschrift, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(d.badge, x + 32, y + 23);

        // Move Name
        ctx.fillStyle = "#f3f4f6";
        ctx.font = "bold 13px Bahnschrift, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(d.name.toUpperCase(), x + 60, y + 23);

        // Discipline Tag (if present)
        if (d.disc) {
            ctx.fillStyle = d.discColor;
            ctx.font = "bold 9px Bahnschrift, sans-serif";
            ctx.textAlign = "right";
            ctx.fillText(d.disc.toUpperCase(), x + w - 10, y + 23);
            ctx.textAlign = "left";
        }

        // Rule hint (e.g., Beats Throw)
        ctx.fillStyle = d.color;
        ctx.font = "italic 10px Bahnschrift, sans-serif";
        ctx.fillText(d.beats.toUpperCase() + (d.range ? "  \u2022  " + d.range : ""), x + 12, y + 46);

        // Power & Speed metrics
        ctx.fillStyle = "#9ca3af";
        ctx.font = "11px Bahnschrift, sans-serif";
        ctx.fillText("POWER: " + d.power, x + 12, y + 66);
        ctx.fillText("SPEED: " + d.speedTier, x + 100, y + 66);

        if (d.focusCost > 0) {
            ctx.fillStyle = "#f59e0b";
            ctx.fillText("FOCUS COST: " + d.focusCost, x + 12, y + 84);
        } else {
            ctx.fillStyle = "#10b981";
            ctx.fillText("NO FOCUS COST", x + 12, y + 84);
        }

        // Synergies or description
        if (d.synergy) {
            ctx.fillStyle = "#22d3ee";
            ctx.font = "bold 10px Bahnschrift, sans-serif";
            ctx.fillText("TRAIT: " + d.synergy, x + 12, y + 104);
        } else {
            ctx.fillStyle = "#6b7280";
            ctx.font = "10px Bahnschrift, sans-serif";
            ctx.fillText(d.desc, x + 12, y + 104);
        }

        ctx.restore();
    }

    return {
        formatCardDetails: formatCardDetails,
        setHoverCard: setHoverCard,
        clear: clear,
        getActiveTooltip: function() { return activeTooltip; },
        render: render
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = CardTooltip;
}
