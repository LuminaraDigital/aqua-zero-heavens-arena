// src/data/i18n.js
window.i18n = (function() {
    const defaultLang = 'en';
    let currentLang = defaultLang;

    const dictionary = {
        en: {
            ui: {
                start: "Start Game",
                options: "Options",
                language: "Language",
                keybindings: "Keybindings",
                back: "Back",
                victory: "Victory!",
                defeat: "Defeat"
            },
            techniques: {
                water_slash: "Water Slash",
                tidal_wave: "Tidal Wave",
                aqua_shield: "Aqua Shield"
            },
            dossiers: {
                hero_desc: "A valiant fighter from the azure depths.",
                villain_desc: "A chaotic force from the abyssal trenches."
            },
            victory_ceremonies: {
                hero_win: "The heavens weep for your defeat!",
                villain_win: "The depths claim another soul."
            }
        },
        ja: {
            ui: {
                start: "ゲーム開始",
                options: "オプション",
                language: "言語",
                keybindings: "キーバインド",
                back: "戻る",
                victory: "勝利！",
                defeat: "敗北"
            },
            techniques: {
                water_slash: "水斬り",
                tidal_wave: "津波",
                aqua_shield: "アクアシールド"
            },
            dossiers: {
                hero_desc: "蒼き深淵から来た勇敢な戦士。",
                villain_desc: "深海から来た混沌の力。"
            },
            victory_ceremonies: {
                hero_win: "天はあなたの敗北に泣いている！",
                villain_win: "深淵がまた一つの魂を奪う。"
            }
        },
        es: {
            ui: {
                start: "Iniciar Juego",
                options: "Opciones",
                language: "Idioma",
                keybindings: "Controles",
                back: "Atrás",
                victory: "¡Victoria!",
                defeat: "Derrota"
            },
            techniques: {
                water_slash: "Corte de Agua",
                tidal_wave: "Maremoto",
                aqua_shield: "Escudo Aqua"
            },
            dossiers: {
                hero_desc: "Un valiente luchador de las profundidades azules.",
                villain_desc: "Una fuerza caótica de las trincheras abisales."
            },
            victory_ceremonies: {
                hero_win: "¡Los cielos lloran por tu derrota!",
                villain_win: "Las profundidades reclaman otra alma."
            }
        },
        fr: {
            ui: {
                start: "Démarrer",
                options: "Options",
                language: "Langue",
                keybindings: "Contrôles",
                back: "Retour",
                victory: "Victoire !",
                defeat: "Défaite"
            },
            techniques: {
                water_slash: "Tranchant d'Eau",
                tidal_wave: "Raz-de-marée",
                aqua_shield: "Bouclier Aqua"
            },
            dossiers: {
                hero_desc: "Un vaillant combattant des profondeurs azur.",
                villain_desc: "Une force chaotique des fosses abyssales."
            },
            victory_ceremonies: {
                hero_win: "Les cieux pleurent votre défaite !",
                villain_win: "Les profondeurs réclament une autre âme."
            }
        }
    };

    function setLanguage(lang) {
        if (dictionary[lang]) {
            currentLang = lang;
            if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined' && typeof window.dispatchEvent === 'function') {
                const event = new CustomEvent('language_changed', { detail: { language: lang } });
                window.dispatchEvent(event);
            }
        } else {
            console.warn("Language not supported:", lang);
        }
    }

    function getLanguage() {
        return currentLang;
    }

    function t(category, key) {
        const langDict = dictionary[currentLang] || dictionary[defaultLang];
        if (langDict[category] && langDict[category][key]) {
            return langDict[category][key];
        }
        if (dictionary[defaultLang][category] && dictionary[defaultLang][category][key]) {
            return dictionary[defaultLang][category][key];
        }
        if ((category === "techniques" || category === "tech") && typeof TECH !== "undefined" && TECH[key]) {
            return TECH[key].name || key;
        }
        if ((category === "fighters" || category === "dossiers") && typeof FIGHTERS !== "undefined") {
            if (typeof key === "number" && FIGHTERS[key]) return FIGHTERS[key].name;
            const match = FIGHTERS.find(function(f) { return f && (f.id === key || f.name === key); });
            if (match) return match.name;
        }
        return (typeof key === "string" && key.indexOf(".") < 0) ? key : `${category}.${key}`;
    }

    function getSupportedLanguages() {
        return Object.keys(dictionary);
    }

    return {
        setLanguage: setLanguage,
        getLanguage: getLanguage,
        t: t,
        getSupportedLanguages: getSupportedLanguages
    };
})();
