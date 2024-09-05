// setup.mjs    
export function setup(ctx) {

    const generalSettings = ctx.settings.section('General');

    generalSettings.add(
        [{
            type: "dropdown",
            name: "Resources",
            label: "Resources",
            hint: "Which resource to heal your town with.",
            default: "Auto",
            options: [
                { value: "Auto", display: "Auto" },
                { value: "melvorF:Herbs", display: "Herbs" },
                { value: "melvorF:Potions", display: "Potions" }
            ]
        },
        {
            type: "number",
            name: "Minimum Money",
            label: "Minimum Money",
            hint: "Limit minimum amount of money that mod will leave in your bank.",
            default: 0,
            min: 0
        },
        {
            type: 'switch',
            name: 'repair-in-winter',
            label: 'Repair in Winter?',
            hint: 'Determines if township should continue repairing during winter season.',
            default: true
        }]
    );

    const intoTheAbyssSettings = ctx.settings.section('Into the Abyss');

    intoTheAbyssSettings.add(
        [{
            type: 'switch',
            name: 'wave-if-suboptimal',
            label: 'Fight current wave if suboptimal?',
            hint: 'Determines if township should fight waves if fortification upgrades are available (Recommended OFF).',
            default: false
        },
        {
            type: 'number',
            name: 'minimum-armour-and-weaponary',
            label: 'Minimum Armour & Weaponary',
            hint: 'Minimum amount of armour & weaponary left in bank for trading.',
            default: 0,
        }]
    );

    ctx.patch(Township, 'tick').after(function () {
        // Get the GP cost to repair all
        let repairCost = game.township.getTotalRepairCosts().get(game.township.resources.getObjectByID("melvorF:GP"))

        // If the repair will leave you with above the set minimum GP, repair all
        if ((game.gp.amount - repairCost > generalSettings.get("Minimum Money")) &&
            (game.township.townData.season.id != "melvorF:Winter" || generalSettings.get("repair-in-winter"))) {
                // Leaving here to avoid breaking if another storage type is added
                game.township.repairAllBuildings();
                // For some reason game.township.repairAllBuildings() doesn't repair both individually
                // So two seperate calls stop ItA repair costs preventing normal repair and vice versa
                game.township.repairAllBuildingsFromStorageType('Normal');
                if (game.township.canFightAbyssalWaves) {
                    game.township.repairAllBuildingsFromStorageType('Soul');
                }
        }

        let resourceName = getResourceToUse(generalSettings);
        let resourceToUse = game.township.resources.getObjectByID(resourceName);

        // Calculate amount of healing required
        let healthToHeal = 100 - game.township.townData.health;

        // Apply healing
        this.increaseHealth(resourceToUse, healthToHeal);

        // Auto Abyssal Wave Fighting
        if (game.township.canFightAbyssalWaves) {
            const armourAndWeaponary = game.township.resources.getObjectByID("melvorItA:ArmourWeaponry").amount;
            const minimumArmourAndWeaponary = intoTheAbyssSettings.get("minimum-armour-and-weaponary");
            const abyssalWaveSize = game.township.abyssalWaveSize;
            const minimumArmourAndWeaponaryMet = (armourAndWeaponary - abyssalWaveSize) >= minimumArmourAndWeaponary;

            const healthSufficient = game.township.townData.health >= 100;
            const conditionsMet = healthSufficient && game.township.canWinAbyssalWave && minimumArmourAndWeaponaryMet;

            if (!conditionsMet) return;

            if (intoTheAbyssSettings.get("wave-if-suboptimal") || fortificationsUpgraded()) {
                game.township.processAbyssalWaveOnClick();
            }
        }
    });
}

function getResourceToUse(generalSettings) {
    let resourceName = generalSettings.get("Resources");
    let herbGeneration = game.township.resources.getObjectByID("melvorF:Herbs").generation;
    let potionGeneration = game.township.resources.getObjectByID("melvorF:Potions").generation;

    if (resourceName == "Auto") {
        if (herbGeneration >= potionGeneration) {
            return "melvorF:Herbs";
        } else {
            return "melvorF:Potions";
        }
    } else {
        return resourceName;
    }
}

// Hardcoded, probably doesn't matter though doubt these will change.
const FORTIFICATION_REQUIREMENTS = [
    { level: 10, requirement: 7.5 },
    { level: 20, requirement: 7.5 },
    { level: 30, requirement: 27.5 },
    { level: 40, requirement: 70 },
    { level: 50, requirement: 130 },
];

function fortificationsUpgraded() {
    const fortification = game.township.townData.fortification;
    const level = game.township.abyssalLevel;

    for (const { level: maxLevel, requirement } of FORTIFICATION_REQUIREMENTS) {
        if (level < maxLevel && fortification >= requirement) {
            return true;
        }
    }

    if (level >= 50 && fortification >= FORTIFICATION_REQUIREMENTS[4].requirement) {
        return true;
    }

    return false;
}