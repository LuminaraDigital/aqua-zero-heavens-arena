// sfx.js - WebAudio Synthesizer for Aqua Zero Heavens Arena
// Zero-dependency sound effects generator with volume management
/* =====================================================================
   AQUA ZERO HEAVENS ARENA - SFX Audio Synthesizer
   Luminara Digital - Procedural combat audio synthesis
   ===================================================================== */

const SFX = {
    ctx: null,
    enabled: true,
    volume: 1.0,

    init: function() {
        if (typeof window === 'undefined') return;
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            if (window.AudioContext) {
                this.ctx = new AudioContext();
            }
        } catch (e) {
            console.warn("WebAudio API not supported in this browser");
        }
    },

    toggle: function(enabled) {
        this.enabled = !!enabled;
    },

    setVolume: function(vol) {
        this.volume = Math.max(0, Math.min(1.0, vol));
    },

    getVolume: function() {
        return this.volume;
    },

    _playTone: function(freq, type, duration, vol, env) {
        if (!this.enabled || !this.ctx || this.volume <= 0) return;
        
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const effectiveVol = (vol || 0.5) * this.volume;
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        
        // Simple envelope
        const attack = env && env.attack ? env.attack : 0.01;
        const decay = env && env.decay ? env.decay : 0.1;
        const sustain = env && env.sustain ? env.sustain * this.volume : effectiveVol;
        const release = env && env.release ? env.release : duration;

        gain.gain.linearRampToValueAtTime(effectiveVol, this.ctx.currentTime + attack);
        gain.gain.linearRampToValueAtTime(sustain, this.ctx.currentTime + attack + decay);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + attack + decay + release);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + attack + decay + release);
    },

    _playNoise: function(duration, vol, env, filterFreq, filterType) {
        if (!this.enabled || !this.ctx || this.volume <= 0) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        const bufferSize = Math.max(256, Math.floor(this.ctx.sampleRate * duration));
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        // Filter to shape noise
        const filter = this.ctx.createBiquadFilter();
        filter.type = filterType || 'lowpass';
        filter.frequency.value = filterFreq || 1000;
        
        const gain = this.ctx.createGain();
        const effectiveVol = (vol || 0.5) * this.volume;
        
        const attack = env && env.attack ? env.attack : 0.01;
        const decay = env && env.decay ? env.decay : 0.1;
        const sustain = env && env.sustain ? env.sustain * this.volume : effectiveVol;
        const release = env && env.release ? env.release : duration;

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(effectiveVol, this.ctx.currentTime + attack);
        gain.gain.linearRampToValueAtTime(sustain, this.ctx.currentTime + attack + decay);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + attack + decay + release);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        noise.start(this.ctx.currentTime);
    },

    impactThud: function() {
        this._playNoise(0.15, 0.5, { attack: 0.01, decay: 0.05, release: 0.1 });
        this._playTone(100, 'sine', 0.1, 0.6, { attack: 0.01, decay: 0.05, release: 0.1 });
    },

    criticalHitImpact: function() {
        if (!this.enabled || !this.ctx || this.volume <= 0) return;
        this._playNoise(0.25, 0.7, { attack: 0.005, decay: 0.08, release: 0.18 }, 1800, 'bandpass');
        this._playTone(55, 'triangle', 0.25, 0.8, { attack: 0.005, decay: 0.1, release: 0.15 });
        this._playTone(110, 'sawtooth', 0.15, 0.4, { attack: 0.01, decay: 0.05, release: 0.1 });
    },

    boneSnap: function() {
        if (!this.enabled || !this.ctx || this.volume <= 0) return;
        this._playNoise(0.12, 0.65, { attack: 0.002, decay: 0.03, release: 0.08 }, 2400, 'highpass');
        this._playTone(280, 'sawtooth', 0.08, 0.5, { attack: 0.005, decay: 0.04, release: 0.04 });
        this._playTone(70, 'sine', 0.15, 0.7, { attack: 0.01, decay: 0.06, release: 0.08 });
    },

    strikeSwoosh: function() {
        if (!this.enabled || !this.ctx || this.volume <= 0) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.15);
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3 * this.volume, this.ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    },

    slashWhoosh: function() {
        if (!this.enabled || !this.ctx || this.volume <= 0) return;
        this._playNoise(0.18, 0.45, { attack: 0.01, decay: 0.06, release: 0.11 }, 2200, 'bandpass');
        this._playTone(420, 'triangle', 0.12, 0.35, { attack: 0.01, decay: 0.05, release: 0.06 });
    },

    slamImpact: function() {
        if (!this.enabled || !this.ctx || this.volume <= 0) return;
        this._playNoise(0.28, 0.65, { attack: 0.005, decay: 0.1, release: 0.18 }, 450, 'lowpass');
        this._playTone(45, 'sine', 0.3, 0.9, { attack: 0.005, decay: 0.15, release: 0.15 });
    },

    counterShatter: function() {
        if (!this.enabled || !this.ctx || this.volume <= 0) return;
        this._playNoise(0.2, 0.6, { attack: 0.002, decay: 0.06, release: 0.14 }, 3200, 'highpass');
        this._playTone(580, 'sawtooth', 0.12, 0.4, { attack: 0.002, decay: 0.04, release: 0.08 });
        this._playTone(90, 'triangle', 0.22, 0.7, { attack: 0.005, decay: 0.08, release: 0.14 });
    },

    subJointTension: function() {
        if (!this.enabled || !this.ctx || this.volume <= 0) return;
        this._playTone(160, 'sine', 0.35, 0.5, { attack: 0.05, decay: 0.15, release: 0.15 });
        this._playNoise(0.18, 0.3, { attack: 0.02, decay: 0.08, release: 0.08 }, 900, 'bandpass');
    },

    matSqueak: function() {
        this._playTone(1200, 'sine', 0.1, 0.2, { attack: 0.02, decay: 0.05, release: 0.05 });
    },

    staminaBreakBuzz: function() {
        this._playTone(150, 'sawtooth', 0.4, 0.4, { attack: 0.05, decay: 0.1, release: 0.2 });
    },

    roundBell: function() {
        this._playTone(800, 'sine', 1.5, 0.5, { attack: 0.01, decay: 0.5, sustain: 0.2, release: 1.0 });
        this._playTone(1200, 'sine', 1.0, 0.3, { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.8 });
    },

    refereeCountdown: function(count) {
        this._playTone(450, 'sine', 0.08, 0.4, { attack: 0.005, decay: 0.03, release: 0.05 });
        this._playNoise(0.06, 0.3, { attack: 0.002, decay: 0.02, release: 0.04 }, 800, 'lowpass');
    },

    dynamicCrowdCheer: function(styleGrade) {
        if (!this.enabled || !this.ctx || this.volume <= 0) return;
        const grade = String(styleGrade || 'D').toUpperCase();
        let duration = 0.4;
        let vol = 0.2;
        let filterFreq = 600;

        if (grade === 'C') { duration = 0.6; vol = 0.3; filterFreq = 800; }
        else if (grade === 'B') { duration = 0.8; vol = 0.4; filterFreq = 1000; }
        else if (grade === 'A') { duration = 1.2; vol = 0.55; filterFreq = 1400; }
        else if (grade === 'S') { duration = 1.6; vol = 0.7; filterFreq = 1800; }
        else if (grade === 'SSS') { duration = 2.2; vol = 0.85; filterFreq = 2200; }

        this._playNoise(duration, vol, { attack: 0.1, decay: 0.3, sustain: 0.8, release: duration * 0.5 }, filterFreq, 'bandpass');
    },

    victoryStinger: function() {
        if (!this.enabled || !this.ctx || this.volume <= 0) return;
        const now = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25]; // C major chord
        notes.forEach((freq, idx) => {
            setTimeout(() => {
                this._playTone(freq, 'triangle', 0.8, 0.4, { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.5 });
            }, idx * 100);
        });
    }
};

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('click', () => { if (!SFX.ctx) SFX.init(); }, { once: true });
    window.addEventListener('keydown', () => { if (!SFX.ctx) SFX.init(); }, { once: true });
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = SFX;
}
