// src/progress/create-fighter.js
// Create-A-Fighter custom stance builder module

var CreateFighterMode = (function() {
    var fighterDraft = {
        name: "New Fighter",
        discipline: "boxing", 
        colorPalette: {
            primary: "#ff0000",
            secondary: "#000000"
        },
        attributes: {
            strength: 50,
            speed: 50,
            stamina: 50,
            chin: 50,
            heart: 50,
            cutResist: 50,
            takedownOffense: 50,
            takedownDefense: 50,
            punchPower: 50,
            kickPower: 50,
            punchSpeed: 50,
            kickSpeed: 50,
            footwork: 50,
            headMovement: 50,
            blocking: 50,
            submissionOffense: 50,
            submissionDefense: 50,
            groundAndPound: 50
        },
        availablePoints: 200
    };

    var DISCIPLINES = ["boxing", "muay_thai", "kickboxing", "wrestling", "bjj", "judo"];

    function init() {
        console.log("CreateFighterMode initialized.");
    }

    function setName(name) {
        fighterDraft.name = name;
        console.log("Fighter name set to: " + name);
    }

    function setDiscipline(disc) {
        if (DISCIPLINES.indexOf(disc) > -1) {
            fighterDraft.discipline = disc;
            console.log("Discipline set to: " + disc);
        } else {
            console.warn("Invalid discipline: " + disc);
        }
    }

    function setColor(type, hex) {
        if (fighterDraft.colorPalette[type] !== undefined) {
            fighterDraft.colorPalette[type] = hex;
            console.log("Set " + type + " color to " + hex);
        }
    }

    function allocatePoint(attribute, amount) {
        if (fighterDraft.attributes[attribute] !== undefined) {
            var cost = amount;
            var currentVal = fighterDraft.attributes[attribute];
            var newVal = currentVal + amount;
            
            if (fighterDraft.availablePoints >= cost && newVal <= 100 && newVal >= 0) {
                fighterDraft.attributes[attribute] = newVal;
                fighterDraft.availablePoints -= cost;
                console.log("Allocated " + amount + " to " + attribute + ". Remaining points: " + fighterDraft.availablePoints);
                return true;
            } else {
                console.warn("Invalid allocation for " + attribute);
                return false;
            }
        }
        return false;
    }

    function finishFighter() {
        console.log("Finished creating fighter: " + fighterDraft.name);
        // Returns the final data object for saving/integration
        return JSON.parse(JSON.stringify(fighterDraft));
    }

    return {
        init: init,
        draft: fighterDraft,
        setName: setName,
        setDiscipline: setDiscipline,
        setColor: setColor,
        allocatePoint: allocatePoint,
        finishFighter: finishFighter,
        DISCIPLINES: DISCIPLINES
    };
})();
