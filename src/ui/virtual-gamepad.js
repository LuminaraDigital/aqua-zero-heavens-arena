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
        overlay.style.transition = 'opacity 0.2s ease';
        
        createDpad();
        createActionButtons();
        
        if (document.body && typeof document.body.appendChild === 'function') {
            document.body.appendChild(overlay);
        }

        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('resize', handleResize);
        }
        handleResize();
    }

    function createDpad() {
        if (typeof document === 'undefined') return;
        dpad = ensureStyle(document.createElement('div'));
        dpad.style.position = 'absolute';
        dpad.style.bottom = '8%';
        dpad.style.left = '4%';
        dpad.style.width = '140px';
        dpad.style.height = '140px';
        dpad.style.backgroundColor = 'rgba(17, 20, 28, 0.75)';
        dpad.style.border = '1px solid rgba(34, 211, 238, 0.4)';
        dpad.style.borderRadius = '50%';
        dpad.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6), inset 0 0 12px rgba(34,211,238,0.2)';
        dpad.style.pointerEvents = 'auto';

        var dirs = ['up', 'down', 'left', 'right'];
        dirs.forEach(function(dir) {
            var btn = ensureStyle(document.createElement('button'));
            btn.type = 'button';
            btn.setAttribute('aria-label', 'Direction ' + dir);
            btn.style.position = 'absolute';
            btn.style.width = '38%';
            btn.style.height = '38%';
            btn.style.backgroundColor = 'rgba(25, 30, 42, 0.85)';
            btn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            btn.style.color = '#22d3ee';
            btn.style.fontSize = '14px';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.cursor = 'pointer';
            btn.style.touchAction = 'manipulation';
            
            if (dir === 'up') { btn.style.top = '2px'; btn.style.left = '31%'; btn.style.borderRadius = '12px 12px 0 0'; btn.innerHTML = '&#9650;'; }
            if (dir === 'down') { btn.style.bottom = '2px'; btn.style.left = '31%'; btn.style.borderRadius = '0 0 12px 12px'; btn.innerHTML = '&#9660;'; }
            if (dir === 'left') { btn.style.top = '31%'; btn.style.left = '2px'; btn.style.borderRadius = '12px 0 0 12px'; btn.innerHTML = '&#9664;'; }
            if (dir === 'right') { btn.style.top = '31%'; btn.style.right = '2px'; btn.style.borderRadius = '0 12px 12px 0'; btn.innerHTML = '&#9654;'; }

            bindTouch(btn, dir);
            dpad.appendChild(btn);
        });

        overlay.appendChild(dpad);
    }

    function createActionButtons() {
        if (typeof document === 'undefined') return;
        actionArea = ensureStyle(document.createElement('div'));
        actionArea.style.position = 'absolute';
        actionArea.style.bottom = '8%';
        actionArea.style.right = '4%';
        actionArea.style.width = '160px';
        actionArea.style.height = '140px';
        actionArea.style.pointerEvents = 'auto';

        var acts = [
            { name: 'a', label: 'A', color: '#e6392f', glow: 'rgba(230,57,47,0.5)', x: '70%', y: '50%', size: '52px' },
            { name: 'b', label: 'B', color: '#22d3ee', glow: 'rgba(34,211,238,0.5)', x: '35%', y: '75%', size: '46px' },
            { name: 'y', label: 'Y', color: '#f59e0b', glow: 'rgba(245,158,11,0.5)', x: '10%', y: '30%', size: '42px' }
        ];

        acts.forEach(function(act) {
            var btn = ensureStyle(document.createElement('button'));
            btn.type = 'button';
            btn.setAttribute('aria-label', act.label + ' Action Button');
            btn.style.position = 'absolute';
            btn.style.width = act.size;
            btn.style.height = act.size;
            btn.style.borderRadius = '50%';
            btn.style.backgroundColor = 'rgba(20, 24, 34, 0.9)';
            btn.style.border = '2px solid ' + act.color;
            btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.6), 0 0 14px ' + act.glow;
            btn.style.left = act.x;
            btn.style.top = act.y;
            btn.style.transform = 'translate(-50%, -50%)';
            btn.innerText = act.label;
            btn.style.textAlign = 'center';
            btn.style.color = '#ffffff';
            btn.style.fontFamily = 'Bahnschrift, sans-serif';
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
        // Preserve each button's own base transform. Action buttons are centred
        // with translate(-50%,-50%); D-pad arrows are anchored by top/left/etc.
        // with NO transform. Hard-coding translate(-50%,-50%) here would shove the
        // D-pad arrows half their size off-anchor on the first press and leave
        // them there. Append the press scale to whatever base the element has.
        var baseTransform = element.style.transform || '';
        var pressed = baseTransform ? baseTransform + ' scale(0.92)' : 'scale(0.92)';

        function press(e) {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            element.style.transform = pressed;
            triggerHaptic(20);
            triggerEvent('gamepad_press', actionName);
            // Dispatch synthetic key event for unified input pipeline
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
        // Without touchcancel, an OS-cancelled touch (incoming call, palm
        // rejection, scroll takeover) never fires touchend, so the synthetic
        // keyup is never sent and the fighter keeps walking / holding the attack.
        element.addEventListener('touchcancel', release, {passive: false});
    }

    function dispatchKeyEvent(action, type) {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        var keyMap = {
            'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight',
            'a': 'z', 'b': 'x', 'y': 'c'
        };
        // KeyboardEvent.code is the physical key, not the character: a letter's
        // code is "KeyZ", not "z". Arrow keys use the same string for key and code.
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
        if (window.innerWidth < 640) {
            // Auto show on small mobile screens
            if (isActive) overlay.style.display = 'block';
        } else {
            // Grew back to a desktop-width viewport (rotation, window resize):
            // hide the touch HUD so it doesn't sit on top of the desktop UI.
            overlay.style.display = 'none';
        }
    }

    var api = {
        init: init,
        show: function() {
            if (!overlay) init();
            if (overlay && overlay.style) overlay.style.display = 'block';
            isActive = true;
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
