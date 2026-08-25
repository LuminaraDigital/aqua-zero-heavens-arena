// src/ui/stat-radar.js
// Cyber-Esports 6-Axis Stat Radar / Hexagonal Polygon Chart
/* =====================================================================
   AQUA ZERO HEAVENS ARENA - Stat Radar Engine
   Luminara Digital - UFC-style attribute breakdown visualization
   ===================================================================== */

var StatRadar = (function() {
    var AXES = [
        { key: "power", label: "POWER", angle: -Math.PI / 2 },
        { key: "speed", label: "SPEED", angle: -Math.PI / 6 },
        { key: "technique", label: "TECH", angle: Math.PI / 6 },
        { key: "chin", label: "CHIN", angle: Math.PI / 2 },
        { key: "stamina", label: "STAM", angle: (5 * Math.PI) / 6 },
        { key: "range", label: "RANGE", angle: -(5 * Math.PI) / 6 }
    ];

    function normalizeStats(rawStats) {
        if (!rawStats) {
            return { power: 50, speed: 50, technique: 50, chin: 50, stamina: 50, range: 50 };
        }
        // Support array of 18 BIOS attributes or dictionary
        if (Array.isArray(rawStats)) {
            return {
                power: Math.min(100, Math.max(10, rawStats[0] || 50)),
                speed: Math.min(100, Math.max(10, rawStats[1] || 50)),
                technique: Math.min(100, Math.max(10, rawStats[2] || 50)),
                chin: Math.min(100, Math.max(10, rawStats[4] || 50)),
                stamina: Math.min(100, Math.max(10, rawStats[3] || 50)),
                range: Math.min(100, Math.max(10, rawStats[5] || 50))
            };
        }
        return {
            power: Math.min(100, Math.max(10, rawStats.power || rawStats.strength || 50)),
            speed: Math.min(100, Math.max(10, rawStats.speed || 50)),
            technique: Math.min(100, Math.max(10, rawStats.technique || rawStats.tech || 50)),
            chin: Math.min(100, Math.max(10, rawStats.chin || rawStats.defense || 50)),
            stamina: Math.min(100, Math.max(10, rawStats.stamina || 50)),
            range: Math.min(100, Math.max(10, rawStats.range || 50))
        };
    }

    function render(ctx, centerX, centerY, radius, rawStats, options) {
        if (!ctx) return;
        var opt = options || {};
        var stats = normalizeStats(rawStats);
        var r = radius || 70;
        var strokeColor = opt.strokeColor || "#22d3ee";
        var fillColor = opt.fillColor || "rgba(34, 211, 238, 0.25)";
        var gridColor = opt.gridColor || "rgba(255, 255, 255, 0.12)";
        var labelColor = opt.labelColor || "#9ca3af";

        ctx.save();

        // 1. Draw Concentric Hexagon Grid Rings
        var rings = [0.25, 0.5, 0.75, 1.0];
        ctx.lineWidth = 1;
        ctx.strokeStyle = gridColor;

        for (var ringIdx = 0; ringIdx < rings.length; ringIdx++) {
            var frac = rings[ringIdx];
            ctx.beginPath();
            for (var a = 0; a < AXES.length; a++) {
                var angle = AXES[a].angle;
                var x = centerX + Math.cos(angle) * r * frac;
                var y = centerY + Math.sin(angle) * r * frac;
                if (a === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }

        // 2. Draw Radial Spokes & Labels
        ctx.font = "bold 9px Bahnschrift, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for (var i = 0; i < AXES.length; i++) {
            var ax = AXES[i];
            var cosA = Math.cos(ax.angle);
            var sinA = Math.sin(ax.angle);

            // Spoke
            ctx.beginPath();
            ctx.strokeStyle = gridColor;
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + cosA * r, centerY + sinA * r);
            ctx.stroke();

            // Label
            var val = stats[ax.key];
            var labelDist = r + 14;
            var lx = centerX + cosA * labelDist;
            var ly = centerY + sinA * labelDist;
            ctx.fillStyle = labelColor;
            ctx.fillText(ax.label, lx, ly);

            // Value badge
            ctx.fillStyle = strokeColor;
            ctx.fillText(val, lx, ly + 9);
        }

        // 3. Draw Fighter's Stat Polygon
        ctx.beginPath();
        for (var k = 0; k < AXES.length; k++) {
            var axKey = AXES[k];
            var statVal = Math.max(15, stats[axKey.key]);
            var dist = (statVal / 100) * r;
            var px = centerX + Math.cos(axKey.angle) * dist;
            var py = centerY + Math.sin(axKey.angle) * dist;
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();

        // Fill & Stroke
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Vertex Dots
        for (var v = 0; v < AXES.length; v++) {
            var vKey = AXES[v];
            var vVal = Math.max(15, stats[vKey.key]);
            var vDist = (vVal / 100) * r;
            var vx = centerX + Math.cos(vKey.angle) * vDist;
            var vy = centerY + Math.sin(vKey.angle) * vDist;

            ctx.fillStyle = strokeColor;
            ctx.beginPath();
            ctx.arc(vx, vy, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    return {
        normalizeStats: normalizeStats,
        render: render,
        getAxes: function() { return AXES; }
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = StatRadar;
}
