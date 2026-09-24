// src/ui/keybindings.js
window.Keybindings = (function() {
    const STORAGE_KEY = 'aquazero_keybindings';
    
    // Default bindings
    const defaultBindings = {
        combat: {
            up: 'ArrowUp',
            down: 'ArrowDown',
            left: 'ArrowLeft',
            right: 'ArrowRight',
            attack: 'z',
            jump: 'x',
            special: 'c',
            dash: 'Shift'
        },
        menu: {
            up: 'ArrowUp',
            down: 'ArrowDown',
            left: 'ArrowLeft',
            right: 'ArrowRight',
            confirm: 'Enter',
            cancel: 'Escape'
        }
    };

    let currentBindings = null;

    function init() {
        load();
    }

    function load() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                currentBindings = JSON.parse(saved);
                // Merge with defaults in case of new keys
                currentBindings = {
                    combat: Object.assign({}, defaultBindings.combat, currentBindings.combat),
                    menu: Object.assign({}, defaultBindings.menu, currentBindings.menu)
                };
            } catch (e) {
                console.warn('Failed to load keybindings, reverting to defaults.');
                reset();
            }
        } else {
            reset();
        }
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentBindings));
    }

    function reset() {
        currentBindings = JSON.parse(JSON.stringify(defaultBindings));
        save();
    }

    function remap(context, action, newKey) {
        if (currentBindings[context] && currentBindings[context][action] !== undefined) {
            currentBindings[context][action] = newKey;
            save();
            return true;
        }
        return false;
    }

    function getAction(context, keyEventKey) {
        if (!currentBindings[context]) return null;
        
        for (let action in currentBindings[context]) {
            // Case-insensitive match for letters, strict for others
            if (currentBindings[context][action].toLowerCase() === keyEventKey.toLowerCase() || 
                currentBindings[context][action] === keyEventKey) {
                return action;
            }
        }
        return null;
    }

    function getBindings() {
        return currentBindings;
    }



    var activeInputDevice = 'keyboard'; // 'keyboard' | 'gamepad' | 'touch'

    /* THE ARENA TABLE. This is the object the page's keydown handler is
       assigned from (KMAP = Keybindings.ARENA_KEYS), so a legend built by
       legendFor() is read off the very rows a keypress is resolved through
       and the two cannot drift. They had: fighter select advertised
       "A - CONFIRM" while the a key sat in this table as `left`, so pressing
       it moved the cursor to the next fighter. Z, Enter and Space are what
       confirm; the pad glyph is the same "A" the on-screen pad shows.

       The combat/menu tables above are the remappable set the settings
       drawer edits. This one is positional - the page dispatches on the
       action, never on the key - and it is not remapped. */
    var ARENA_KEYS = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
        z: "a", Z: "a", Enter: "a", " ": "a",
        x: "b", X: "b", Escape: "b", Backspace: "b",
        c: "y", C: "y", i: "y", I: "y",
        r: "rand", R: "rand",
        o: "code", O: "code",
        "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8"
    };
    /* scene overrides, consulted BEFORE the table: on these scenes these
       keys change the difficulty instead of what the table says. Kept here
       rather than in the handler so a legend on SELECT knows X is no longer
       "back" there and says ESC instead. */
    var ARENA_OVERRIDES = [
        { action: "diff", keys: ["x", "X", "d", "D"], scenes: ["TITLE", "BRIEF", "OPTIONS"] },
        { action: "diff", keys: ["x", "X"], scenes: ["MENU", "SELECT"] }
    ];
    var PAD_GLYPH = { a: "A", b: "B", y: "Y", x: "X" };
    var KEY_LABEL = {
        " ": "SPACE", Enter: "ENTER", Escape: "ESC", Backspace: "BKSP",
        ArrowUp: "\u2191", ArrowDown: "\u2193", ArrowLeft: "\u2190", ArrowRight: "\u2192"
    };

    function overrideFor(key, sceneName) {
        for (var i = 0; i < ARENA_OVERRIDES.length; i++) {
            var o = ARENA_OVERRIDES[i];
            if (o.scenes.indexOf(sceneName) < 0) continue;
            if (o.keys.indexOf(key) >= 0) return o.action;
        }
        return null;
    }
    /* what a key does on a scene - the handler's whole decision */
    function arenaAction(key, sceneName) {
        var ov = overrideFor(key, sceneName || "");
        if (ov) return ov;
        return ARENA_KEYS[key] || null;
    }
    /* the keyboard keys that perform an action on a scene, as labels,
       without case duplicates - the first is the primary. A scene's
       overrides are walked first, in the order they are written, so the
       difficulty legend reads X / D rather than whatever order the table
       happens to hold those letters in. */
    function arenaKeysFor(action, sceneName) {
        var out = [], seen = {}, k, i;
        var scene = sceneName || "";
        var add = function (key) {
            if (arenaAction(key, scene) !== action) return;
            var label = KEY_LABEL[key] || String(key).toUpperCase();
            if (seen[label]) return;
            seen[label] = 1; out.push(label);
        };
        for (i = 0; i < ARENA_OVERRIDES.length; i++) {
            if (ARENA_OVERRIDES[i].scenes.indexOf(scene) >= 0) ARENA_OVERRIDES[i].keys.forEach(add);
        }
        for (k in ARENA_KEYS) {
            if (Object.prototype.hasOwnProperty.call(ARENA_KEYS, k)) add(k);
        }
        return out;
    }
    /* "A / Z - CONFIRM": the pad glyph, the primary keyboard key that does
       the same thing on this scene, then the verb. On a pad or a touch
       screen the keyboard half is dropped because it is not what the
       player is holding. */
    function legendFor(action, verb, sceneName) {
        var v = String(verb || "").toUpperCase();
        var glyph = PAD_GLYPH[action] || "";
        if (activeInputDevice === "gamepad" || activeInputDevice === "touch") {
            var g = glyph ? getGlyphForAction(action) : arenaKeysFor(action, sceneName).join(" / ");
            if (!v) return g;
            return (g ? g + " - " : "") + v;
        }
        var keys = arenaKeysFor(action, sceneName);
        var head;
        if (glyph) head = keys.length && keys[0] !== glyph ? glyph + " / " + keys[0] : glyph;
        else head = keys.slice(0, 2).join(" / ");
        if (!v) return head;
        return (head ? head + " - " : "") + v;
    }



    function setInputDevice(device) {
        if (device === 'keyboard' || device === 'gamepad' || device === 'touch') {
            activeInputDevice = device;
            if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
                window.dispatchEvent(new CustomEvent('input_device_changed', { detail: { device: device } }));
            }
        }
    }


    function getInputDevice() {
        return activeInputDevice;
    }

    function getGlyphForAction(action, context) {
        var ctx = context || 'combat';
        if (activeInputDevice === 'gamepad') {
            var gpGlyphs = {
                attack: '(A)', jump: '(B)', special: '(Y)', dash: '(RB)',
                confirm: '(A)', cancel: '(B)',
                a: '(A)', b: '(B)', y: '(Y)',
                up: 'D-Pad ▲', down: 'D-Pad ▼', left: 'D-Pad ◀', right: 'D-Pad ▶'
            };
            return gpGlyphs[action] || action.toUpperCase();
        }
        if (activeInputDevice === 'touch') {
            var touchGlyphs = {
                attack: 'TAP', jump: 'GUARD', special: 'FOCUS', dash: 'SWIPE',
                confirm: 'TAP', cancel: 'BACK',
                a: 'TAP', b: 'BACK', y: 'FOCUS',
                up: '▲', down: '▼', left: '◀', right: '▶'
            };
            return touchGlyphs[action] || action.toUpperCase();
        }

        var key = (currentBindings && currentBindings[ctx] && currentBindings[ctx][action]) || action;
        var keyFormatMap = {
            'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→',
            'Enter': 'Enter', 'Escape': 'Esc', 'Space': 'Space', 'Shift': 'Shift',
            'Control': 'Ctrl', 'Alt': 'Alt', 'Tab': 'Tab'
        };
        if (keyFormatMap[key]) return keyFormatMap[key];
        return String(key).toUpperCase();
    }

    // Auto-init
    init();

    return {
        getBindings: getBindings,
        remap: remap,
        reset: reset,
        getAction: getAction,
        getGlyphForAction: getGlyphForAction,
        setInputDevice: setInputDevice,
        getInputDevice: getInputDevice,
        ARENA_KEYS: ARENA_KEYS,
        ARENA_OVERRIDES: ARENA_OVERRIDES,
        arenaAction: arenaAction,
        arenaKeysFor: arenaKeysFor,
        legendFor: legendFor
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.Keybindings;
}

