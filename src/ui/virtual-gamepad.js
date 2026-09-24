// src/ui/virtual-gamepad.js
// Unified Cyberpunk Mobile Touch HUD with Haptics & Responsive Layout
/* =====================================================================
   AQUA ZERO HEAVENS ARENA - Virtual Gamepad & Touch HUD
   Luminara Digital - Translucent cyber arcade controls with haptic feedback
   ===================================================================== */

(function(root) {
    var overlay = null;
    var isActive = false;
    var opacity = 0.85;
    var dpad = null;
    var actionArea = null;

    var idleTimer = null;
    var baseOpacity = 0.85;

    function resetIdleTimer() {
        if (!overlay || !overlay.style) return;
        overlay.style.opacity = String(baseOpacity);
        if (typeof Keybindings !== 'undefined' && Keybindings.setInputDevice) {
            Keybindings.setInputDevice('touch');
        }
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(function() {
            if (overlay && overlay.style) overlay.style.opacity = '0.30';
        }, 3500);
    }

    function ensureStyle(el) {
        if (el && !el.style) el.style = {};
        return el;
    }

    function init() {
        if (overlay) return;
        if (typeof document === 'undefined') return;

        overlay = ensureStyle(document.createElement('div'));
        overlay.id = 'virtual-gamepad-overlay';
        overlay.style.position = 'fixed';
        overlay.style.bottom = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'none';
        overlay.style.touchAction = 'none';
        overlay.style.opacity = String(opacity);
        overlay.style.transition = 'opacity 0.3s ease';
        
        createDpad();
        createActionButtons();
        
        if (document.body && typeof document.body.appendChild === 'function') {
            document.body.appendChild(overlay);
        }

        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('resize', handleResize);
            window.addEventListener('touchstart', resetIdleTimer, { passive: true });
        }
        handleResize();
    }

    function createDpad() {
        if (typeof document === 'undefined') return;
        dpad = ensureStyle(document.createElement('div'));
        dpad.style.position = 'absolute';
        dpad.style.bottom = '7%';
        dpad.style.left = '4%';
        dpad.style.width = '136px';
        dpad.style.height = '136px';
        dpad.style.backgroundColor = 'rgba(12, 16, 24, 0.72)';
        dpad.style.border = '1px solid rgba(34, 211, 238, 0.45)';
        dpad.style.borderRadius = '50%';
        dpad.style.boxShadow = '0 8px 32px rgba(0,0,0,0.7), inset 0 0 16px rgba(34,211,238,0.2)';
        dpad.style.backdropFilter = 'blur(16px)';
        dpad.style.webkitBackdropFilter = 'blur(16px)';
        dpad.style.pointerEvents = 'auto';

        var dirs = ['up', 'down', 'left', 'right'];
        dirs.forEach(function(dir) {
            var btn = ensureStyle(document.createElement('button'));
            btn.type = 'button';
            btn.setAttribute('aria-label', 'Direction ' + dir);
            btn.style.position = 'absolute';
            btn.style.width = '38%';
            btn.style.height = '38%';
            btn.style.backgroundColor = 'rgba(24, 30, 44, 0.85)';
            btn.style.border = '1px solid rgba(34, 211, 238, 0.3)';
            btn.style.color = '#22d3ee';
            btn.style.fontSize = '14px';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.cursor = 'pointer';
            btn.style.touchAction = 'manipulation';
            
            if (dir === 'up') { btn.style.top = '2px'; btn.style.left = '31%'; btn.style.borderRadius = '14px 14px 4px 4px'; btn.innerHTML = '&#9650;'; }
            if (dir === 'down') { btn.style.bottom = '2px'; btn.style.left = '31%'; btn.style.borderRadius = '4px 4px 14px 14px'; btn.innerHTML = '&#9660;'; }
            if (dir === 'left') { btn.style.top = '31%'; btn.style.left = '2px'; btn.style.borderRadius = '14px 4px 4px 14px'; btn.innerHTML = '&#9664;'; }
            if (dir === 'right') { btn.style.top = '31%'; btn.style.right = '2px'; btn.style.borderRadius = '4px 14px 14px 4px'; btn.innerHTML = '&#9654;'; }

            bindTouch(btn, dir);
            dpad.appendChild(btn);
        });

        overlay.appendChild(dpad);
    }

    function createActionButtons() {
        if (typeof document === 'undefined') return;
        actionArea = ensureStyle(document.createElement('div'));
        actionArea.style.position = 'absolute';
        actionArea.style.bottom = '7%';
        actionArea.style.right = '4%';
        actionArea.style.width = '160px';
        actionArea.style.height = '140px';
        actionArea.style.pointerEvents = 'auto';

        var acts = [
            { name: 'a', label: 'STRIKE', color: '#e6392f', glow: 'rgba(230,57,47,0.5)', x: '70%', y: '50%', size: '54px' },
            { name: 'b', label: 'GUARD', color: '#22d3ee', glow: 'rgba(34,211,238,0.5)', x: '35%', y: '75%', size: '48px' },
            { name: 'y', label: 'FOCUS', color: '#f59e0b', glow: 'rgba(245,158,11,0.5)', x: '10%', y: '30%', size: '44px' }
        ];

        acts.forEach(function(act) {
            var btn = ensureStyle(document.createElement('button'));
            btn.type = 'button';
            btn.setAttribute('aria-label', act.label + ' Action Button');
            btn.style.position = 'absolute';
            btn.style.width = act.size;
            btn.style.height = act.size;
            btn.style.borderRadius = '50%';
            btn.style.backgroundColor = 'rgba(16, 20, 30, 0.85)';
            btn.style.border = '2px solid ' + act.color;
            btn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.65), 0 0 16px ' + act.glow;
            btn.style.backdropFilter = 'blur(16px)';
            btn.style.webkitBackdropFilter = 'blur(16px)';
            btn.style.left = act.x;
            btn.style.top = act.y;
            btn.style.transform = 'translate(-50%, -50%)';
            btn.innerText = act.label.charAt(0);
            btn.style.textAlign = 'center';
            btn.style.color = '#ffffff';
            btn.style.fontFamily = 'Bahnschrift, -apple-system, sans-serif';
            btn.style.fontSize = '16px';
            btn.style.fontWeight = '900';
            btn.style.cursor = 'pointer';
            btn.style.touchAction = 'manipulation';
            btn.style.userSelect = 'none';

            bindTouch(btn, act.name);
            actionArea.appendChild(btn);
        });

        overlay.appendChild(actionArea);
    }

    function bindTouch(element, actionName) {
        if (!element || typeof element.addEventListener !== 'function') return;
        var baseTransform = element.style.transform || '';
        var pressed = baseTransform ? baseTransform + ' scale(0.92)' : 'scale(0.92)';

        function press(e) {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            resetIdleTimer();
            element.style.transform = pressed;
            triggerHaptic(20);
            triggerEvent('gamepad_press', actionName);
            dispatchKeyEvent(actionName, 'keydown');
        }
        function release(e) {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            element.style.transform = baseTransform;
            triggerEvent('gamepad_release', actionName);
            dispatchKeyEvent(actionName, 'keyup');
        }

        element.addEventListener('touchstart', press, {passive: false});
        element.addEventListener('touchend', release, {passive: false});
        element.addEventListener('touchcancel', release, {passive: false});
    }

    /* WHY THIS NO LONGER GOES THROUGH THE KEYBOARD. The pad used to synthesise a
       KeyboardEvent and fire it at `window`. The game's keydown handler starts
       with `if(!gameFocused) return;`, and `gameFocused` is set from
       `stageEl.contains(e.target)` on a capturing pointerdown - the pad overlay
       is appended to document.body, outside #stage, so every pad press first
       told the game it had lost focus and was then dropped by the guard the
       press had just armed. The one control surface built for phones did
       nothing at all. Call the game directly and keep the synthetic event only
       as a fallback for a host that has no onKey. */
    var PAD_KEYS = { up:'up', down:'down', left:'left', right:'right', a:'a', b:'b', y:'y' };
    function sendToGame(action) {
        var k = PAD_KEYS[action];
        if (!k) return false;
        if (typeof window !== 'undefined' && typeof window.onKey === 'function') {
            window.onKey(k);
            return true;
        }
        return false;
    }
    function dispatchKeyEvent(action, type) {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        /* a press is the whole input - the game has no key-repeat and no
           key-up behaviour, so releasing must not fire a second time */
        if (type === 'keydown' && sendToGame(action)) return;
        if (type === 'keyup' && typeof window.onKey === 'function') return;
        var keyMap = {
            'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight',
            'a': 'z', 'b': 'x', 'y': 'c'
        };
        var codeMap = {
            'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight',
            'a': 'KeyZ', 'b': 'KeyX', 'y': 'KeyC'
        };
        var key = keyMap[action] || action;
        var code = codeMap[action] || key;
        var ev = new KeyboardEvent(type, { key: key, code: code, bubbles: true });
        window.dispatchEvent(ev);
    }

    function triggerHaptic(ms) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(ms || 20); } catch (e) {}
        }
    }

    function triggerEvent(eventName, actionName) {
        if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
            var event = new CustomEvent(eventName, { detail: { action: actionName } });
            window.dispatchEvent(event);
        }
    }

    function handleResize() {
        if (typeof window === 'undefined') return;
        if (!overlay || !overlay.style) return;
        // On touch screens or narrow mobile screens, auto-activate touch HUD if enabled
        var isTouch = ('ontouchstart' in window) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
        if (isTouch) {
            if (isActive) overlay.style.display = 'block';
        } else if (!isTouch) {
            overlay.style.display = 'none';
        }
    }

    var api = {
        init: init,
        show: function() {
            if (!overlay) init();
            if (overlay && overlay.style) overlay.style.display = 'block';
            isActive = true;
            resetIdleTimer();
        },
        hide: function() {
            if (overlay && overlay.style) overlay.style.display = 'none';
            isActive = false;
        },
        isActive: function() {
            return isActive;
        },
        getState: function() {
            return { visible: isActive, opacity: opacity };
        },
        setVisible: function(vis) {
            if (vis) this.show(); else this.hide();
        },
        setOpacity: function(val) {
            opacity = Math.max(0.1, Math.min(1.0, val));
            baseOpacity = opacity;
            if (overlay && overlay.style) overlay.style.opacity = String(opacity);
        },
        triggerHaptic: triggerHaptic
    };

    if (typeof window !== 'undefined') {
        window.VirtualGamepad = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : this);

