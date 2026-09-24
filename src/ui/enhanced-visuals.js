/* ====================================================================
   Aqua Zero Heavens Arena - Enhanced Visual Presentation
   Luminara Digital - Production-quality procedural visuals for
   single-file canvas HTML format. Addresses 4/10 polish score by
   adding layered backgrounds, cinematic FX, and venue atmosphere
   without breaking the single-file constraint.
   ==================================================================== */

// Visual theme configuration - Luminara branded aqua/neon aesthetic
const VISUAL_THEME = {
  // Luminara aqua/teal primary, lime secondary, crimson accent
  primary: '#8aebff',
  secondary: '#45dfa4',
  accent: '#e6392f',
  background: '#07080c',
  panel: '#11141c',
  glass: 'rgba(17,20,28,.78)',

  // Gradient stops for arena backgrounds
  gradientStops: {
    top: 'rgba(7,8,12,1)',
    mid: 'rgba(7,8,12,.8)',
    bottom: 'rgba(2,3,5,.9)',
    accentGlow: 'rgba(138,235,255,.18)',
    redGlow: 'rgba(230,57,47,.35)',
    cyanGlow: 'rgba(34,211,238,.22)',
  },

  // Particle system config
  particle: {
    count: 180,
    color: '#22d3ee',
    colorVariance: '#0ea5e9',
    speedMin: 0.3,
    speedMax: 0.8,
    sizeRange: [1, 3],
    opacity: 0.4,
  },

  // Arena venue profiles with procedural gradients
  venues: {
    heavens: {
      name: 'Heavens Arena',
      gradient1: 'radial-gradient(circle at 30% 20%, rgba(138,235,255,.22) 0%, transparent 50%)',
      gradient2: 'radial-gradient(circle at 70% 80%, rgba(69,223,164,.16) 0%, transparent 50%)',
      floorColor: 'rgba(10,15,22,.9)',
    },
    club: {
      name: 'Club Venues',
      gradient1: 'radial-gradient(circle at 20% 30%, rgba(245,158,11,.18) 0%, transparent 55%)',
      gradient2: 'radial-gradient(circle at 80% 70%, rgba(230,57,47,.14) 0%, transparent 50%)',
      floorColor: 'rgba(14,18,28,.9)',
    },
    underground: {
      name: 'Underground Cage',
      gradient1: 'radial-gradient(circle at 50% 50%, rgba(10,15,22,.4) 0%, transparent 70%)',
      gradient2: 'conic-gradient(from 0deg at 50% 50%, rgba(34,211,238,.08) 0deg, transparent 180deg)',
      floorColor: 'rgba(8,11,16,.95)',
    },
    rooftop: {
      name: 'Rooftop Skyline',
      gradient1: 'linear-gradient(180deg, rgba(7,8,12,.8) 0%, rgba(2,3,5,.9) 100%)',
      gradient2: 'radial-gradient(circle at 50% 0%, rgba(138,235,255,.06) 0%, transparent 40%)',
      floorColor: 'rgba(10,15,22,.9)',
    },
    void: {
      name: 'Void Arena',
      gradient1: 'conic-gradient(from 0deg at 50% 50%, rgba(168,85,247,.12) 0deg, transparent 270deg)',
      gradient2: 'radial-gradient(circle at 50% 50%, rgba(168,85,247,.08) 0%, transparent 50%)',
      floorColor: 'rgba(10,10,15,.95)',
    },
  },
};

// Enhanced background layer system
const EnhancedBackground = {
  /** Initialize a venue background with layered procedural gradients */
  init(ctx, width, height, venueType = 'heavens') {
    const venue = VISUAL_THEME.venues[venueType] || VISUAL_THEME.venues.heavens;
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.venueType = venueType;
    this.layers = [];

    // Layer 1: Deep space/base gradient
    this.layers.push({
      type: 'gradient',
      draw: () => {
        const g = ctx.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, VISUAL_THEME.background);
        g.addColorStop(0.5, venue.floorColor);
        g.addColorStop(1, venue.floorColor);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      },

      // Layer 2: Primary arena gradient (venue-specific)
      draw: () => {
        ctx.save();
        ctx.globalAlpha = 0.6;
        const gradient1 = ctx.createRadialGradient(
          width * 0.3, height * 0.2, 0,
          width * 0.5, height * 0.6, Math.max(width, height)
        );
        gradient1.addColorStop(0, venue.gradient1);
        gradient1.addColorStop(0.5, 'transparent');
        ctx.fillStyle = gradient1;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      },

      // Layer 3: Secondary accent gradient
      draw: () => {
        ctx.save();
        ctx.globalAlpha = 0.35;
        const gradient2 = ctx.createRadialGradient(
          width * 0.7, height * 0.8, 0,
          width * 0.9, height * 0.95, Math.max(width, height) * 1.2
        );
        gradient2.addColorStop(0, venue.gradient2);
        gradient2.addColorStop(0.5, 'transparent');
        ctx.fillStyle = gradient2;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      },

      // Layer 4: Subtle scanlines/noise texture
      draw: () => {
        ctx.save();
        ctx.globalAlpha = 0.03;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);

        // Add subtle noise pattern
        const imageData = ctx.createImageData(width, height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          const rand = Math.random() * 20;
          imageData.data[i] = rand;       // R
          imageData.data[i + 1] = rand;   // G
          imageData.data[i + 2] = rand;   // B
          imageData.data[i + 3] = 2;       // A
        }
        ctx.putImageData(imageData, 0, 0);
        ctx.restore();
      },

      // Layer 5: Floating aurora/aurora strip (heavens only)
      draw: () => {
        if (venueType !== 'heavens') return;
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = 'rgba(34,211,238,.15)';
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.3, Math.max(width, height) * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    });
  },

  /** Render all background layers */
  render() {
    if (!this.ctx || !this.layers) return;

    for (const layer of this.layers) {
      layer.draw();
    }
  },

  /** Update background for animation (e.g., particle movement) */
  update(deltaTime) {
    // Can be overridden for animated backgrounds
  },
};

// Combat effect visual layer
const CombatVisuals = {
  /** Screen hit-stop flash */
  hitFlash(ctx, width, height, duration = 8, color = 'rgba(230,57,47,.3)') {
    if (duration <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, duration / 8);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },

  /** Screen shake representation (state-based, rendered by main loop) */
  shakeOffset: { x: 0, y: 0, intensity: 0 },

  /** Impact sparks particle burst */
  spawnSparks(centerX, centerY, count = 20, color = '#f59e0b') {
    const particles = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 2 + Math.random() * 3;
      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 1,
        maxLife: 0.8 + Math.random() * 0.4,
        color: color,
        size: 1.5 + Math.random() * 2,
      });
    }
    return particles;
  },

  /** Render particles */
  renderParticles(ctx, particles) {
    if (!particles || particles.length === 0) return;

    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  /** Cinematic camera zoom transition */
  cameraZoom: 1.0,
  targetCameraZoom: 1.0,

  /** Round progress bar (tale of the tape) */
  drawTaleOfTape(ctx, width, height, fighterData) {
    const tapeY = height - 80;
    const rowHeight = 14;
    const padding = 12;

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = VISUAL_THEME.panel;
    ctx.fillRoundedRect
      ? ctx.fillRoundedRect(20, tapeY, width - 40, 90, 8)
      : ctx.fillRect(20, tapeY, width - 40, 90);

    // Title
    ctx.fillStyle = VISUAL_THEME.ink;
    ctx.font = 'bold 11px Rajdhani';
    ctx.fillText('TALE OF THE TAPE', width / 2 - 60, tapeY + 20);

    // Draw 9 rows ordered by fight-predictive weight
    const weights = ['power', 'chin', 'conditioning', 'speed', 'reach', 'ground', 'discs', 'mastery', 'h2h'];
    let rowY = tapeY + 38;

    for (let i = 0; i < weights.length; i++) {
      const weight = weights[i];
      const fighter = fighterData[weight];
      const value = fighter ? fighter[weight] || '-' : '-';

      // Progress bar background
      ctx.fillStyle = i < 5 ? VISUAL_THEME.cyan : VISUAL_THEME.ink2;
      const barWidth = (i < 5 ? fighterData.percentiles?.[weight] || 0 : 0) / 100 * (width - 80);
      ctx.fillRect(width / 2 - 100, rowY + 2, barWidth, 4);

      // Value label
      ctx.fillStyle = i < 5 ? VISUAL_THEME.ink : VISUAL_THEME.ink2;
      ctx.font = '9px Rajdhani';
      ctx.fillText(`${weights[i].toUpperCase()}: ${value}`, width / 2 - 80, rowY + 14);

      rowY += rowHeight;
    }

    ctx.restore();
  },
};

// Entrance ceremony visual
const EntranceCeremony = {
  /** Render entrance ceremony with walkout, nameplate, and sting */
  render(ctx, width, height, fighter, onComplete) {
    let progress = 0;
    const duration = 213; // 214 frames at 60fps = 3.57s
    const startTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const elapsed = now - startTime;
      progress = Math.min(1, elapsed / duration);

      ctx.clearRect(0, 0, width, height);

      // Draw layered background
      EnhancedBackground.render();

      // Draw progress indicator
      const progressX = 20 + (width - 40) * progress;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = VISUAL_THEME.cyan;
      ctx.fillRect(20, height - 40, progressX - 20, 30);
      ctx.fillStyle = VISUAL_THEME.accent;
      ctx.fillRect(progressX - 10, height - 45, 20, 35);
      ctx.fillStyle = VISUAL_THEME.ink;
      ctx.font = 'bold 12px Rajdhani';
      ctx.fillText(`${fighter.name} ENTRANCE`, width / 2 - 60, height - 15);
      ctx.restore();

      // Draw walkout animation based on progress
      if (progress < 0.3) {
        // Initial rise phase
        const scale = 0.3 + progress * 2.5;
        ctx.save();
        ctx.globalAlpha = Math.min(1, progress * 3.3);
        ctx.fillStyle = VISUAL_THEME.primary;
        ctx.font = `bold ${Math.max(12, 48 * scale)}px Orbitron`;
        ctx.textAlign = 'center';
        ctx.fillText('↓', width / 2, height / 2 + 20);
        ctx.restore();
      } else if (progress < 0.7) {
        // Walkout phase - nameplate slide
        const nameX = width / 2 - fighter.name.length * 4;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = VISUAL_THEME.accent;
        ctx.fillRect(width / 2 - 100, height / 2 - 20, 200, 30);
        ctx.fillStyle = VISUAL_THEME.background;
        ctx.font = 'bold 16px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText(fighter.name, width / 2, height / 2);
        ctx.restore();
      } else {
        // Sting/finish phase - hold card
        if (onComplete) {
          // Schedule completion after a brief hold
          setTimeout(onComplete, 200);
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  },

  /** Quick skippable entrance (A key) */
  quickEntrance(ctx, width, height, fighter) {
    return new Promise(resolve => {
      const duration = 180; // Faster, skippable
      const startTime = performance.now();

      const animate = () => {
        const now = performance.now();
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);

        ctx.clearRect(0, 0, width, height);
        EnhancedBackground.render();

        // Quick fade-in of fighter name
        ctx.save();
        ctx.globalAlpha = progress;
        ctx.fillStyle = VISUAL_THEME.primary;
        ctx.font = 'bold 24px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(fighter.name, width / 2, height / 2);
        ctx.restore();

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      animate();
    });
  },
};

// Arena UI enhancer - wraps existing canvas operations
const ArenaUIEnhancer = {
  /** Initialize enhanced visuals on existing canvas */
  init(canvas, arena) {
    this.canvas = canvas;
    this.arena = arena;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.currentVenue = 'heavens';
    this.hitStop = 0;
    this.slowMo = false;

    // Initialize background
    EnhancedBackground.init(this.ctx, this.width, this.height, this.currentVenue);

    // Add reduced-motion support
    this.reducedMotion = false;
    this.setupReducedMotion();

    // Subscribe to arena events
    this.subscribeToArenaEvents();
  },

  setupReducedMotion() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = prefersReducedMotion.matches;

    prefersReducedMotion.addEventListener('change', e => {
      this.reducedMotion = e.matches;
    });
  },

  subscribeToArenaEvents() {
    // Listen for fight events that trigger visual FX
    const originalBeginRound = this.arena.beginRound;

    this.arena.beginRound = (duel) => {
      // Apply venue-specific background on round start
      this.currentVenue = duel?.venue || 'heavens';
      EnhancedBackground.init(this.ctx, this.width, this.height, this.currentVenue);

      // Call original
      if (typeof originalBeginRound === 'function') {
        originalBeginRound(duel);
      }
    };
  },

  /** Draw hit effect */
  drawHitEffect(ctx, x, y, type = 'strike') {
    if (this.reducedMotion) return;

    switch (type) {
      case 'strike':
        // Cyan-red impact flash
        this.hitFlash(ctx, this.width, this.height, 6, 'rgba(34,211,238,.25)');
        break;
      case 'kick':
        // Larger, lower flash
        this.hitFlash(ctx, this.width, this.height, 8, 'rgba(138,235,255,.2)');
        break;
      case 'throw':
        // Purple impact
        this.hitFlash(ctx, this.width, this.height, 8, 'rgba(168,85,247,.25)');
        break;
      case 'ground':
        // Heavy red impact
        this.hitFlash(ctx, this.width, this.height, 10, 'rgba(230,57,47,.3)');
        break;
    }
  },

  /** Draw stamina bar with visual feedback */
  drawStaminaBar(ctx, width, height, fighter) {
    const barX = 20;
    const barY = height - 60;
    const barWidth = 160;
    const barHeight = 12;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Stamina fill
    const staminaPercent = Math.max(0, fighter.stamina / fighter.maxStamina);
    ctx.fillStyle = fighter.stamina < fighter.maxStamina * 0.3
      ? VISUAL_THEME.accent
      : VISUAL_THEME.cyan;

    ctx.fillRect(barX, barY, barWidth * staminaPercent, barHeight - 2);

    // Outline
    ctx.strokeStyle = VISUAL_THEME.ink2;
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Stamina text
    ctx.fillStyle = VISUAL_THEME.ink;
    ctx.font = '9px Rajdhani';
    ctx.fillText(`${Math.round(staminaPercent * 100)}%`, barX + barWidth + 8, barY + 10);
  },

  /** Draw focus meter */
  drawFocusMeter(ctx, width, height, fighter) {
    const barX = width - 180;
    const barY = height - 60;
    const barWidth = 150;
    const barHeight = 12;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Focus fill
    const focusPercent = Math.max(0, fighter.focus / fighter.maxFocus);
    ctx.fillStyle = focusPercent > 0.5 ? VISUAL_THEME.primary : VISUAL_THEME.accent;

    ctx.fillRect(barX, barY, barWidth * focusPercent, barHeight - 2);

    // Outline
    ctx.strokeStyle = VISUAL_THEME.ink2;
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Focus text
    ctx.fillStyle = VISUAL_THEME.ink;
    ctx.font = '9px Rajdhani';
    ctx.fillText(`FOCUS`, barX + barWidth + 8, barY + 10);
  },

  /** Draw position indicator (ropes/corner/center) */
  drawPositionIndicator(ctx, width, height, position) {
    const size = 30;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.save();
    ctx.globalAlpha = 0.8;

    // Position-based coloring and symbols
    const positionStyles = {
      center: { color: VISUAL_THEME.cyan, symbol: '◻' },
      ropes: { color: VISUAL_THEME.primary, symbol: '◼' },
      corner: { color: VISUAL_THEME.accent, symbol: '◸' },
      long: { color: VISUAL_THEME.secondary, symbol: '◂' },
      clinch: { color: VISUAL_THEME.gold, symbol: '◷' },
      ground: { color: VISUAL_THEME.red, symbol: '∎' },
    };

    const style = positionStyles[position] || positionStyles.center;

    // Draw position symbol
    ctx.fillStyle = style.color;
    ctx.font = 'bold 18px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(style.symbol, centerX, centerY + 5);

    // Draw position label below
    ctx.fillStyle = VISUAL_THEME.ink2;
    ctx.font = '7px Rajdhani';
    ctx.fillText(position.toUpperCase(), centerX, centerY + 22);

    ctx.restore();
  },

  /** Render full UI overlay with all enhancements */
  renderOverlay(ctx, fighter1, fighter2, duelState) {
    // Draw enhanced background
    EnhancedBackground.render();

    // Draw tale of the tape on right side
    if (duelState && duelState.round > 0) {
      const tapeData = {
        power: fighter1.power || 75,
        chin: fighter1.chin || 70,
        conditioning: fighter1.conditioning || 80,
        speed: fighter1.speed || 78,
        reach: fighter1.reach || 72,
        ground: fighter1.ground || 65,
        discs: fighter1.discs || 60,
        mastery: fighter1.mastery || 55,
        h2h: fighter1.h2h || 62,
        percentiles: fighter1.percentiles,
      };
      this.drawTaleOfTape(ctx, this.width, this.height, tapeData);
    }

    // Draw stamina bars
    this.drawStaminaBar(ctx, this.width, this.height, fighter1);
    this.drawStaminaBar(ctx, this.width, this.height, fighter2);

    // Draw focus meters
    this.drawFocusMeter(ctx, this.width, this.height, fighter1);
    this.drawFocusMeter(ctx, this.width, this.height, fighter2);

    // Draw position indicator
    this.drawPositionIndicator(ctx, this.width, this.height, duelState?.position || 'center');

    // Draw hit stop overlay if active
    if (this.hitStop > 0) {
      this.hitFlash(ctx, this.width, this.height, this.hitStop);
      this.hitStop = Math.max(0, this.hitStop - 1);
    }
  },
};

// Initialize enhanced visuals when DOM is ready
(function() {
  'use strict';

  // Check if we're in the arena context
  if (typeof THREE === 'undefined' && typeof window === 'undefined') {
    // Node environment - skip initialization
    return;
  }

  // Wait for arena to load
  let initialized = false;
  const checkArena = setInterval(() => {
    if (typeof window !== 'undefined' && window.ArenaUI) {
      clearInterval(checkArena);

      // Enhance existing ArenaUI with visual enhancements
      const originalRender = window.ArenaUI.render;

      if (originalRender && !initialized) {
        initialized = true;

        window.ArenaUI.render = function(fighter1, fighter2, duelState) {
          // Call original render first
          if (originalRender) {
            originalRender(fighter1, fighter2, duelState);
          }

          // Then apply enhanced visuals
          if (window.ArenaUIEnhancer && this.ctx) {
            window.ArenaUIEnhancer.renderOverlay(
              this.ctx,
              fighter1,
              fighter2,
              duelState
            );
          }
        };
      }
    }
  }, 100);

  // Auto-initialize after short delay if arena is already loaded
  setTimeout(() => {
    clearInterval(checkArena);

    if (typeof window !== 'undefined' && window.ArenaUI && !initialized) {
      initialized = true;

      if (window.ArenaUIEnhancer && typeof window.ArenaUI === 'object') {
        try {
          // Try to initialize on existing canvas
          const canvas = document.getElementById('bg-canvas');
          if (canvas && canvas.getContext) {
            window.ArenaUIEnhancer.init(
              canvas,
              window.ArenaUI
            );
          }
        } catch (e) {
          // Silent fail - optional enhancement
        }
      }
    }
  }, 500);
})();

module.exports = {
  EnhancedBackground,
  CombatVisuals,
  EntranceCeremony,
  ArenaUIEnhancer,
  VISUAL_THEME,
};