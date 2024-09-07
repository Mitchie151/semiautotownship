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
            label: 'Fight Current Wave if Suboptimal?',
            hint: 'Determines if township should fight waves if fortification upgrades are available (Recommended OFF).',
            default: false
        },
        {
            type: 'number',
            name: 'minimum-armour-and-weaponry',
            label: 'Minimum Armour & Weaponry',
            hint: 'Minimum amount of armour & weaponry left in bank for trading.',
            default: 0,
            min: 0
        }]
    );

    const semiCoreSettings = ctx.settings.section('SEMI Core');

    semiCoreSettings.add([
        {
            type: 'switch',
            name: 'auto-swap-equipment',
            label: 'Auto Swap Equipment? (Requires SEMI Core mod)',
            hint: 'Determines if township should automatically swap equipment to reduce repair costs and increase XP gain per abyssal wave fought (Recommended ON).',
            default: true
        }
    ]);

    // Equipment Swap code is almost entirely repurposed from SEMI Auto Farming by Psycast. Link is here: https://mod.io/g/melvoridle/m/semi-auto-farming
    const id = 'auto-township';
    const debugLog = (...msg) => {
        mod.api.SEMI.log(`${id}`, ...msg);
    };

    const bankQty = (item) => game.bank.getQty(item);
    const getGearSlot = (slotID) => game.combat.player.equipment.equippedItems[slotID];
    const canEquipGearItem = (item) => game.checkRequirements(item.equipRequirements, false);
    const isItemEquipped = (item) => game.combat.player.equipment.getSlotOfItem(item) != undefined;
    const equipGearItem = (slotID, item, qty = 1000000) => {
        const slot = game.equipmentSlots.getObjectByID(slotID);
        if (!slot) return false;
        game.combat.player.equipItem(item, game.combat.player.selectedEquipmentSet, slot, qty);
    };

    const gearSlots = game.equipmentSlots.allObjects.map(slot => slot.id);

    const gearPriority = {};

    const gearPriorityIDs = {
        'melvorD:Cape': [
            'melvorTotH:Superior_Cape_Of_Completion',
            'melvorTotH:Superior_Max_Skillcape',
            'melvorTotH:Superior_Township_Skillcape',
            'melvorF:Cape_of_Completion',
            'melvorF:Max_Skillcape',
            'melvorF:Township_Skillcape',
        ],
        'melvorD:Ring': ['melvorItA:Lost_Ring_of_the_Abyss'],
        'melvorD:Weapon': ['melvorItA:Abyssal_Hourglass_Upright'],
        'melvorD:Gloves': ['melvorItA:Golem_Gloves'],
        'melvorD:Amulet': ['melvorItA:Voidtaker_Amulet'],
        'melvorD:Gem': ['melvorItA:Abyssal_Skilling_Gem'],
    };

    gearSlots.forEach(slotID => {
        if (gearPriorityIDs[slotID]) {
            gearPriority[slotID] = [];
            gearPriorityIDs[slotID].forEach(itemID => {
                let item = game.items.getObjectByID(itemID);
                if (item) {
                    gearPriority[slotID].push(item);
                }
            });
        }
    });

    let gearSwapped = null;

    const canChangeEquipment = () => {
        debugLog(`canChangeEquipment:`, game.combat.player.manager.areaType == CombatAreaType.None, !game.isGolbinRaid);
        return game.combat.player.manager.areaType == CombatAreaType.None && !game.isGolbinRaid;
    }

    const equipmentSwap = () => {
        if (!canChangeEquipment())
            return;

        debugLog(`Doing Equipment Swap:`);
        const oldEquipment = mod.api.SEMI.equipmentSnapshot();

        gearSlots.forEach(slotID => {
            let gear = gearPriority[slotID];
            if (gear) {
                for (let i = 0; i < gear.length; i++) {
                    let toEquipItem = gear[i];
                    let gearSlot = getGearSlot(slotID);

                    if (isItemEquipped(toEquipItem))
                        break;

                    if (bankQty(toEquipItem) <= 0 || !canEquipGearItem(toEquipItem))
                        continue;

                    if (gearSlot.item != toEquipItem) {
                        equipGearItem(slotID, toEquipItem);
                        break;
                    }
                }
            }
        });

        gearSwapped = mod.api.SEMI.equipmentDifferences(oldEquipment);
        writeEquipmentChangeDebug(gearSwapped);
    };

    const equipmentRestore = () => {
        debugLog(`Restoring Equipment Swap:`, (gearSwapped != null));
    
        if (gearSwapped != null) {
            const oldEquipment = mod.api.SEMI.equipmentSnapshot();

            mod.api.SEMI.equipmentDifferencesRestore(gearSwapped);
            gearSwapped = null;

            writeEquipmentChangeDebug(mod.api.SEMI.equipmentDifferences(oldEquipment));
        }
    };        

    const writeEquipmentChangeDebug = (snapshot) => {
        gearSlots.forEach(slotKey => {
            if (snapshot[slotKey] != null) {
                debugLog(`${slotKey}: ${snapshot[slotKey].old.item.id} x ${snapshot[slotKey].old.quantity} -> ${snapshot[slotKey].new.item.id} x ${snapshot[slotKey].new.quantity}`);
            }
        });
    };

    // Requires setting to be on as well as SEMI Core mod to be installed
    const equipmentSwapActivated = semiCoreSettings.get("auto-swap-equipment") && mod.api.SEMI != null;

    ctx.patch(Township, 'tick').after(function () {
        // Swap Gear
        if (equipmentSwapActivated) {
            equipmentSwap();
        }

        // Get the GP cost to repair all
        let repairCost = game.township.getTotalRepairCosts().get(game.township.resources.getObjectByID("melvorF:GP"));

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

        // Heal the town
        let resourceName = getResourceToUse(generalSettings);
        let resourceToUse = game.township.resources.getObjectByID(resourceName);

        // Calculate amount of healing required
        let healthToHeal = 100 - game.township.townData.health;

        // Apply healing
        this.increaseHealth(resourceToUse, healthToHeal);

        // Abyssal Wave Fighting
        if (game.township.canFightAbyssalWaves) {
            const armourAndWeaponary = game.township.resources.getObjectByID("melvorItA:ArmourWeaponry").amount;
            const minimumArmourAndWeaponary = intoTheAbyssSettings.get("minimum-armour-and-weaponry");
            const abyssalWaveSize = game.township.abyssalWaveSize;
            const minimumArmourAndWeaponaryMet = (armourAndWeaponary - abyssalWaveSize) >= minimumArmourAndWeaponary;
            const healthSufficient = game.township.townData.health >= 100;
            const notCurrentlyFighting = !game.township.isFightingAbyssalWave;
            const canWinAbyssalWave = game.township.canWinAbyssalWave;

            const conditionsMet = healthSufficient && game.township.canWinAbyssalWave && minimumArmourAndWeaponaryMet && notCurrentlyFighting && canWinAbyssalWave;

            if (conditionsMet && (intoTheAbyssSettings.get("wave-if-suboptimal") || fortificationsUpgraded())) {
                game.township.processAbyssalWave();
            }
        }

        // Restore gear
        if (equipmentSwapActivated) {
            equipmentRestore();
        }
    });

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
};