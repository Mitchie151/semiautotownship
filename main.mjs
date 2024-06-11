// setup.mjs    
export function setup(ctx) {

    const generalSettings = ctx.settings.section('General');

    generalSettings.add(
        [{
            type: "dropdown",
            name: "Resources",
            label: "Resources",
            hint: "Which resource to heal your town with",
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
            hint: "Limit minimum amount of money that mod will leave in your bank",
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

    ctx.patch(Township, 'tick').after(function () {

        // Get the GP cost to repair all
        let repairCost = game.township.getTotalRepairCosts().get(game.township.resources.getObjectByID("melvorF:GP"))

        // If the repair will leave you with above the set minimum GP, repair all
        if ((game.gp.amount - repairCost > generalSettings.get("Minimum Money")) &&
            (game.township.townData.season.id != "melvorF:Winter" || generalSettings.get("repair-in-winter"))) {
            this.repairAllBuildings();
        }

        let resourceName = getResourceToUse(generalSettings);
        let resourceToUse = game.township.resources.getObjectByID(resourceName);

        // Calculate amount of healing required
        let healthToHeal = 100 - game.township.townData.health

        // Apply healing
        this.increaseHealth(resourceToUse, healthToHeal);
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