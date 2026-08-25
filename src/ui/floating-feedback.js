// floating-feedback.js - Floating Combat Text for Aqua Zero Heavens Arena

const FloatingFeedback = {
    texts: [],

    add: function(message, x, y, type) {
        let color = '#ffffff';
        let size = 20;
        let lifetime = 60; // frames
        let velocityY = -1.5;

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
                color = '#ff0000';
                size = 32;
                lifetime = 100;
                velocityY = -2.5;
                break;
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
            alpha: 1.0
        });
    },

    update: function() {
        for (let i = this.texts.length - 1; i >= 0; i--) {
            let t = this.texts[i];
            t.y += t.vy;
            t.life--;
            
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
            
            // Text shadow for readability
            ctx.font = `bold ${t.size}px Arial, sans-serif`;
            ctx.fillStyle = `rgba(0, 0, 0, ${t.alpha})`;
            ctx.fillText(t.message, t.x + 2, t.y + 2);

            // Main text
            ctx.fillStyle = this._hexToRgba(t.color, t.alpha);
            ctx.fillText(t.message, t.x, t.y);
        }
        
        ctx.restore();
    },

    _hexToRgba: function(hex, alpha) {
        let r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
};
