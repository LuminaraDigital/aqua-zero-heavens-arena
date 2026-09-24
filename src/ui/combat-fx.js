// src/ui/combat-fx.js
// Canvas Visual Effects, Particle Emitter & Combat Banners for Aqua Zero Heavens Arena
/* =====================================================================
   AQUA ZERO HEAVENS ARENA - Combat FX Engine
   Luminara Digital - High performance screen shake, sparks & battle juice
   ===================================================================== */

const CombatFX = {
    shakeOffset: { x: 0, y: 0 },
    shakeTimer: 0,
    shakeIntensity: 0,
    
    flashFrames: 0,
    flashColor: 'white',

    chromaticAberrationFrames: 0,
    chromaticAberrationIntensity: 0,
    
    slowMoFrames: 0,
    slowMoFactor: 1,

    hitStopFrames: 0,
    desperationActive: false,

    staminaBreakTimer: 0,
    cornerPressureIntensity: 0,

    // Dynamic Camera Framing
    cameraZoom: 1.0,
    targetCameraZoom: 1.0,
    cameraPan: { x: 0, y: 0 },
    targetCameraPan: { x: 0, y: 0 },
    cameraZoomTimer: 0,

    // Particle pool
    particles: [],
    maxParticles: 120,

    // Impact Callout Banners
    banner: null,

    update: function() {
        // Hit-Stop Freeze: halt animation frames to create crunch
        if (this.hitStopFrames > 0) {
            this.hitStopFrames--;
            return;
        }

        // Chromatic Aberration decay
        if (this.chromaticAberrationFrames > 0) {
            this.chromaticAberrationFrames--;
            this.chromaticAberrationIntensity *= 0.85;
        } else {
            this.chromaticAberrationIntensity = 0;
        }

        // Camera zoom and pan interpolation
        if (this.cameraZoomTimer > 0) {
            this.cameraZoomTimer--;
            this.cameraZoom += (this.targetCameraZoom - this.cameraZoom) * 0.15;
            this.cameraPan.x += (this.targetCameraPan.x - this.cameraPan.x) * 0.15;
            this.cameraPan.y += (this.targetCameraPan.y - this.cameraPan.y) * 0.15;
            if (this.cameraZoomTimer === 0) {
                this.targetCameraZoom = 1.0;
                this.targetCameraPan = { x: 0, y: 0 };
            }
        } else {
            this.cameraZoom += (1.0 - this.cameraZoom) * 0.1;
            this.cameraPan.x += (0 - this.cameraPan.x) * 0.1;
            this.cameraPan.y += (0 - this.cameraPan.y) * 0.1;
        }

        // Screen Shake
        if (this.shakeTimer > 0) {
            this.shakeOffset.x = (Math.random() * 2 - 1) * this.shakeIntensity;
            this.shakeOffset.y = (Math.random() * 2 - 1) * this.shakeIntensity;
            this.shakeTimer--;
            this.shakeIntensity *= 0.9;
        } else {
            this.shakeOffset.x = 0;
            this.shakeOffset.y = 0;
        }

        // Impact Flash
        if (this.flashFrames > 0) {
            this.flashFrames--;
        }

        // Slow Mo (KO Finish)
        if (this.slowMoFrames > 0) {
            this.slowMoFrames--;
            if (this.slowMoFrames === 0) {
                this.slowMoFactor = 1;
            }
        }

        // Stamina Break visual
        if (this.staminaBreakTimer > 0) {
            this.staminaBreakTimer--;
        }
        
        // Corner Pressure decay
        if (this.cornerPressureIntensity > 0) {
            this.cornerPressureIntensity -= 0.02;
            if (this.cornerPressureIntensity < 0) this.cornerPressureIntensity = 0;
        }

        // Update active particles
        for (var i = this.particles.length - 1; i >= 0; i--) {
            var p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.96;
            p.vy += p.gravity || 0.15;
            p.life--;
            p.alpha = Math.max(0, p.life / p.maxLife);
            p.size *= 0.97;
            if (p.life <= 0 || p.size <= 0.2) {
                this.particles.splice(i, 1);
            }
        }

        // Update banner
        if (this.banner) {
            this.banner.life--;
            this.banner.scale = Math.min(1.0, this.banner.scale + 0.08);
            if (this.banner.life <= 0) {
                this.banner = null;
            }
        }
    },

    triggerShake: function(intensity, frames) {
        this.shakeIntensity = intensity;
        this.shakeTimer = frames;
    },

    triggerFlash: function(color, frames) {
        this.flashColor = color || 'white';
        this.flashFrames = frames || 5;
    },

    triggerCameraZoom: function(zoomLevel, panX, panY, durationFrames) {
        this.targetCameraZoom = zoomLevel || 1.18;
        this.targetCameraPan = { x: panX || 0, y: panY || 0 };
        this.cameraZoomTimer = durationFrames || 30;
    },

    triggerChromaticAberration: function(intensity, frames) {
        this.chromaticAberrationIntensity = intensity || 6;
        this.chromaticAberrationFrames = frames || 8;
    },

    triggerKOFinish: function() {
        this.triggerFlash('rgba(255,255,255,0.85)', 12);
        this.triggerShake(18, 36);
        this.triggerHitStop(8);
        this.triggerCameraZoom(1.35, 0, -18, 60);
        this.triggerChromaticAberration(10, 20);
        this.slowMoFrames = 120; // 2 seconds at 60fps
        this.slowMoFactor = 0.25; // 1/4 speed
        this.triggerBanner('KNOCKOUT!', '#e6392f', 'MATCH CONCLUDED');
    },

    triggerHitStop: function(frames) {
        this.hitStopFrames = frames || 4;
    },

    setDesperation: function(active) {
        this.desperationActive = !!active;
    },

    triggerStaminaBreak: function() {
        this.staminaBreakTimer = 30;
        this.triggerHitStop(5);
        this.triggerCameraZoom(1.15, 0, 0, 24);
        this.triggerChromaticAberration(5, 10);
        this.triggerBanner('GUARD BREAK!', '#f59e0b', 'DEFENSE SHATTERED');
    },

    triggerClash: function(x, y) {
        this.triggerShake(8, 12);
        this.triggerHitStop(3);
        this.triggerCameraZoom(1.18, (x ? (x - 480) * 0.15 : 0), 0, 26);
        this.triggerFlash('rgba(255, 255, 200, 0.4)', 3);
        this.triggerChromaticAberration(4, 6);
        this.spawnSparks(x || 480, y || 270, 24, '#fbbf24');
        this.triggerBanner('CLASH!', '#f59e0b', 'EQUAL STRIKE VELOCITY');
    },

    triggerLauncher: function(x, y) {
        this.triggerShake(10, 16);
        this.triggerHitStop(4);
        this.triggerCameraZoom(1.22, (x ? (x - 480) * 0.15 : 0), -28, 30);
        this.triggerFlash('rgba(34, 211, 238, 0.4)', 3);
        this.triggerChromaticAberration(5, 8);
        this.spawnSparks(x || 480, y || 270, 20, '#22d3ee');
        this.triggerBanner('LAUNCHER!', '#22d3ee', 'VERTICAL AIRBORNE POPUP');
    },

    triggerCounterHit: function(x, y) {
        this.triggerShake(12, 18);
        this.triggerHitStop(6);
        this.triggerCameraZoom(1.30, (x ? (x - 480) * 0.25 : 0), 0, 32);
        this.triggerFlash('rgba(230, 57, 47, 0.4)', 4);
        this.triggerChromaticAberration(7, 12);
        this.spawnSparks(x || 480, y || 270, 32, '#ff4d42');
        this.triggerBanner('COUNTER!', '#e6392f', 'CLEAN INTERCEPTION');
    },

    triggerMoveBanner: function(moveName, discipline, power, isCounter, isSuper, subtitle) {
        let col = "#22d3ee";
        if (isSuper) col = "#f59e0b";
        else if (isCounter) col = "#e6392f";
        else if (discipline === "muaythai" || discipline === "lethwei") col = "#ef4444";
        else if (discipline === "boxing" || discipline === "kickboxing") col = "#38bdf8";
        else if (discipline === "bjj" || discipline === "judo" || discipline === "sambo") col = "#a855f7";
        else if (discipline === "taekwondo" || discipline === "karate") col = "#f59e0b";

        const sub = subtitle || (
            (discipline ? discipline.toUpperCase() + " • " : "") +
            (isSuper ? "SIGNATURE FINISHER" : (isCounter ? "CRITICAL COUNTER" : (power >= 30 ? "MAXIMUM IMPACT" : "CLEAN STRIKE")))
        );

        this.banner = {
            text: (isSuper ? "⚡ " : (isCounter ? "💥 " : "")) + (moveName || "TECHNIQUE").toUpperCase(),
            subtitle: sub,
            color: col,
            life: 48,
            maxLife: 48,
            scale: 0.6
        };
    },

    setCornerPressure: function(intensity) {
        this.cornerPressureIntensity = Math.min(1.0, intensity);
    },

    spawnSparks: function(x, y, count, color) {
        var num = count || 15;
        for (var i = 0; i < num; i++) {
            if (this.particles.length >= this.maxParticles) {
                this.particles.shift();
            }
            var angle = Math.random() * Math.PI * 2;
            var speed = 2 + Math.random() * 8;
            var life = 18 + Math.floor(Math.random() * 24);
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 0.2,
                size: 2.5 + Math.random() * 3.5,
                color: color || '#22d3ee',
                life: life,
                maxLife: life,
                alpha: 1.0
            });
        }
    },

    triggerBanner: function(text, color, subtitle) {
        this.banner = {
            text: text,
            subtitle: subtitle || '',
            color: color || '#e6392f',
            life: 45,
            maxLife: 45,
            scale: 0.6
        };
    },

    applyToCanvas: function(ctx, canvasWidth, canvasHeight) {
        if (!ctx) return;
        ctx.save();

        // Apply Chromatic Aberration Impact Fringe
        if (this.chromaticAberrationIntensity > 0.5) {
            ctx.save();
            ctx.globalCompositeOperation = "screen";
            var caOffset = this.chromaticAberrationIntensity;
            // Cyan fringe (left)
            ctx.fillStyle = "rgba(34, 211, 238, " + Math.min(0.22, caOffset * 0.025).toFixed(3) + ")";
            ctx.fillRect(0, 0, canvasWidth - caOffset, canvasHeight);
            // Red fringe (right)
            ctx.fillStyle = "rgba(230, 57, 47, " + Math.min(0.22, caOffset * 0.025).toFixed(3) + ")";
            ctx.fillRect(caOffset, 0, canvasWidth - caOffset, canvasHeight);
            ctx.restore();
        }

        // Apply Desperation Vignette (<20% HP)
        if (this.desperationActive) {
            const dGrad = ctx.createRadialGradient(
                canvasWidth/2, canvasHeight/2, Math.min(canvasWidth, canvasHeight)/3,
                canvasWidth/2, canvasHeight/2, Math.max(canvasWidth, canvasHeight)/1.1
            );
            dGrad.addColorStop(0, 'transparent');
            dGrad.addColorStop(1, 'rgba(230, 57, 47, 0.28)');
            ctx.fillStyle = dGrad;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        // Apply corner pressure vignette
        if (this.cornerPressureIntensity > 0) {
            const gradient = ctx.createRadialGradient(
                canvasWidth/2, canvasHeight/2, Math.min(canvasWidth, canvasHeight)/3,
                canvasWidth/2, canvasHeight/2, Math.max(canvasWidth, canvasHeight)/1.2
            );
            gradient.addColorStop(0, 'transparent');
            gradient.addColorStop(1, `rgba(255, 0, 0, ${this.cornerPressureIntensity * 0.4})`);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        // Apply Stamina Break visual
        if (this.staminaBreakTimer > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${(this.staminaBreakTimer / 30) * 0.3})`;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        // Render active particles
        if (this.particles.length > 0) {
            ctx.save();
            for (var i = 0; i < this.particles.length; i++) {
                var p = this.particles[i];
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // Render Impact Banner callout (Arcade action splash cut-in)
        if (this.banner) {
            ctx.save();
            var b = this.banner;
            var alpha = b.life > 10 ? 1 : b.life / 10;
            ctx.globalAlpha = alpha;
            ctx.translate(canvasWidth / 2, 72);
            ctx.scale(b.scale, b.scale);

            // Banner Backdrop with cyber angle cuts
            const bWidth = 420;
            const bHeight = 52;
            const bGrad = ctx.createLinearGradient(-bWidth/2, 0, bWidth/2, 0);
            bGrad.addColorStop(0, "rgba(8, 10, 16, 0.0)");
            bGrad.addColorStop(0.2, "rgba(10, 14, 22, 0.94)");
            bGrad.addColorStop(0.8, "rgba(10, 14, 22, 0.94)");
            bGrad.addColorStop(1, "rgba(8, 10, 16, 0.0)");

            ctx.fillStyle = bGrad;
            ctx.fillRect(-bWidth/2, -bHeight/2, bWidth, bHeight);

            // Cyber accent borders
            ctx.strokeStyle = b.color;
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(-bWidth/2 + 30, -bHeight/2);
            ctx.lineTo(bWidth/2 - 30, -bHeight/2);
            ctx.moveTo(-bWidth/2 + 30, bHeight/2);
            ctx.lineTo(bWidth/2 - 30, bHeight/2);
            ctx.stroke();

            // Accent Corner Brackets
            ctx.fillStyle = b.color;
            ctx.fillRect(-bWidth/2 + 26, -bHeight/2, 4, 10);
            ctx.fillRect(bWidth/2 - 30, -bHeight/2, 4, 10);
            ctx.fillRect(-bWidth/2 + 26, bHeight/2 - 10, 4, 10);
            ctx.fillRect(bWidth/2 - 30, bHeight/2 - 10, 4, 10);

            // Banner Main Move Text
            ctx.fillStyle = b.color;
            ctx.font = "italic 900 20px 'Trebuchet MS', Bahnschrift, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(b.text, 0, -6);

            if (b.subtitle) {
                ctx.fillStyle = "#cbd5e1";
                ctx.font = "bold 9px 'Trebuchet MS', Bahnschrift, sans-serif";
                ctx.letterSpacing = "0.22em";
                ctx.fillText(b.subtitle.toUpperCase(), 0, 12);
            }
            ctx.restore();
        }

        // Apply Flash
        if (this.flashFrames > 0) {
            ctx.fillStyle = this.flashColor;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        ctx.restore();
    },
    
    getSpeedFactor: function() {
        return this.slowMoFactor;
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = CombatFX;
}
