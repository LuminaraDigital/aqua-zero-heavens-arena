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
       and the two cannot drift. A legend names keyboard keys that perform
       the action. It does not borrow a pad glyph for a letter that does
       something else: on fighter select the A key is still left, so the
       confirm legend says Z / ENTER, and on the title the A key confirms,
       so that screen can honestly say A / Z.

       The combat/menu tables above are the remappable set the settings
       drawer edits. This one is positional - the page dispatches on the
       action, never on the key - and it is not remapped. */
    var ARENA_KEYS = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
        z: "a", Z: "a", Enter: "a", NumpadEnter: "a", " ": "a",
        b: "b", B: "b", x: "b", X: "b", Escape: "b", Backspace: "b",
        y: "y", Y: "y", c: "y", C: "y", i: "y", I: "y",
        r: "rand", R: "rand",
        o: "code", O: "code",
        "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8"
    };
    /* scene overrides, consulted BEFORE the table. The title prints
       "A / Z" as start, so A confirms there even though it is left
       everywhere else. X cycles difficulty on the screens that say so.
       Arrow keys step it on the title only. WASD never does: D is
       also the field's move-right key, and a held D used to change
       the difficulty of the fight you walked into. */
    var ARENA_OVERRIDES = [
        { action: "a", keys: ["a", "A"], scenes: ["TITLE"] },
        { action: "diffDown", keys: ["ArrowLeft"], scenes: ["TITLE"] },
        { action: "diffUp", keys: ["ArrowRight"], scenes: ["TITLE"] },
        { action: "diff", keys: ["x", "X"], scenes: ["TITLE", "OPTIONS", "MENU", "SELECT"] }
    ];
    var PAD_GLYPH = { a: "A", b: "B", y: "Y", x: "X" };
    var KEY_LABEL = {
        " ": "SPACE", Enter: "ENTER", NumpadEnter: "ENTER", Escape: "ESC", Backspace: "BKSP",
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
       difficulty legend reads X rather than whatever order the table
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
    /* "Z / ENTER - CONFIRM": the first two keyboard keys that actually
       perform the action on this scene, then the verb. A letter is only
       printed when pressing that letter does the action. On a pad or a
       touch screen the keyboard half is dropped because it is not what
       the player is holding. */
    function legendFor(action, verb, sceneName) {
        var v = String(verb || "").toUpperCase();
        var glyph = PAD_GLYPH[action] || "";
        if (activeInputDevice === "gamepad" || activeInputDevice === "touch") {
            var g = glyph ? getGlyphForAction(action) : arenaKeysFor(action, sceneName).join(" / ");
            if (!v) return g;
            return (g ? g + " - " : "") + v;
        }
        var keys = arenaKeysFor(action, sceneName);
        var head = keys.slice(0, 2).join(" / ");
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

