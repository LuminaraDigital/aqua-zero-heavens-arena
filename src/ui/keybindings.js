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

    // Auto-init
    init();

    return {
        getBindings: getBindings,
        remap: remap,
        reset: reset,
        getAction: getAction
    };
})();
