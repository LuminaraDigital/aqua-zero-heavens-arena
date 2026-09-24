// floating-feedback.js - Floating Combat Text for Aqua Zero Heavens Arena

const FloatingFeedback = {
    texts: [],

    add: function(message, x, y, type) {
        let color = '#ffffff';
        let size = 20;
        let lifetime = 60; // frames
        let velocityY = -1.5;

        if (typeof type === 'object' && type !== null) {
            if (type.color) color = type.color;
            if (type.size) size = type.size;
            if (type.lifetime || type.life) lifetime = type.lifetime || type.life;
            if (type.vy || type.velocityY) velocityY = type.vy || type.velocityY;
        } else {
            switch (type) {
                case 'UPSET':
                    color = '#ffaa00';
                    size = 28;
                    lifetime = 90;
                    velocityY = -2;
                    break;
                case 'TELL READ':
                    color = '#00ffff';
                    size = 24;
                    lifetime = 75;
                    break;
                case 'STAMINA DRAIN':
                    color = '#aaaaaa';
                    size = 20;
                    velocityY = -1;
                    break;
                case 'RING ESCAPE':
                    color = '#00ffaa';
                    size = 24;
                    lifetime = 80;
                    break;
                case 'CRITICAL COUNTER':
                case 'CRITICAL':
                    color = '#ff3333';
                    size = 32;
                    lifetime = 100;
                    velocityY = -2.5;
                    break;
                case 'PARRY':
                    color = '#22d3ee';
                    size = 26;
                    lifetime = 75;
                    velocityY = -2;
                    break;
                case 'GUARD BREAK':
                    color = '#f59e0b';
                    size = 28;
                    lifetime = 85;
                    velocityY = -2.2;
                    break;
                case 'STAMINA BREAK':
                    color = '#ef4444';
                    size = 30;
                    lifetime = 95;
                    velocityY = -2;
                    break;
                case 'GLANCING':
                    color = '#9ca3af';
                    size = 18;
                    lifetime = 50;
                    velocityY = -1.2;
                    break;
                case 'COMBO':
                    color = '#fbbf24';
                    size = 26;
                    lifetime = 70;
                    velocityY = -1.8;
                    break;
                case 'SUPER':
                    color = '#ec4899';
                    size = 34;
                    lifetime = 110;
                    velocityY = -2.8;
                    break;
            }
        }

        this.texts.push({
            message: message,
            x: x,
            y: y,
            color: color,
            size: size,
            maxLife: lifetime,
            life: lifetime,
            vy: velocityY,
            scale: 1.35,
            alpha: 1.0
        });
    },

    spawn: function(message, x, y, opts) {
        this.add(message, x, y, opts);
    },

    update: function() {
        for (let i = this.texts.length - 1; i >= 0; i--) {
            let t = this.texts[i];
            t.y += t.vy;
            t.life--;
            
            // Pop-in scale easing to 1.0
            if (t.scale > 1.0) {
                t.scale -= 0.05;
                if (t.scale < 1.0) t.scale = 1.0;
            }

            // Fade out in the last half of life
            if (t.life < t.maxLife / 2) {
                t.alpha = t.life / (t.maxLife / 2);
            }

            if (t.life <= 0) {
                this.texts.splice(i, 1);
            }
        }
    },

    render: function(ctx) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < this.texts.length; i++) {
            let t = this.texts[i];
            
            ctx.save();
            ctx.translate(t.x, t.y);
            if (t.scale && t.scale !== 1.0) {
                ctx.scale(t.scale, t.scale);
            }

            // Glow / Shadow for crisp esports readability
            ctx.font = `bold ${t.size}px "Bahnschrift", "Segoe UI Variable", Arial, sans-serif`;
            ctx.shadowColor = `rgba(0, 0, 0, ${Math.min(1.0, t.alpha * 0.9)})`;
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = `rgba(0, 0, 0, ${t.alpha})`;
            ctx.fillText(t.message, 0, 0);

            // Main high-contrast text
            ctx.fillStyle = this._hexToRgba(t.color, t.alpha);
            ctx.fillText(t.message, 0, 0);
            ctx.restore();
        }
        
        ctx.restore();
    },

    _hexToRgba: function(hex, alpha) {
        let cleanHex = hex.replace('#', '');
        if (cleanHex.length === 3) {
            cleanHex = cleanHex.split('').map(c => c + c).join('');
        }
        let r = parseInt(cleanHex.slice(0, 2), 16) || 255,
            g = parseInt(cleanHex.slice(2, 4), 16) || 255,
            b = parseInt(cleanHex.slice(4, 6), 16) || 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
};
