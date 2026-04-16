import {
    obtainables,
    commonObtainables,
    rareObtainables,
    epicObtainables,
    legendaryObtainables,
} from "./obtainables.js";

// Character Stats and Inventory

class Character {
    name;
    maxLife;
    health;
    maxMana;
    mana;
    manaRegen;
    healthRegen;
    luck;
    blockChance;
    damageReduction;
    combatTimer;
    extraLives;
    resistances;
    burning;
    blindness;
    withering;
    poison;
    shocked;
    petrified;
    rooted;
    weakness;
    inventory;
    spells;
    equipped;
    weapon;
    armor;
    accessory;
    constructor(name) {
        this.name = name;
        this.maxLife = 0;
        this.health = 100 * this.maxLife;
        this.maxMana = 0;
        this.mana = 100 * this.maxMana;
        this.manaRegen = 5;
        this.healthRegen = 5;
        this.luck = 0;
        this.blockChance = 0;
        this.damageReduction = 0;
        this.combatTimer = 100;
        this.extraLives = 0;
        this.resistances = {
            burning: 0,
            blindness: 0,
            withering: 0,
            poison: 0,
            shocked: 0,
            petrified: 0,
            rooted: 0,
            weakness: 0,
        };
        this.inventory = [];
        this.spells = [];
        this.equipped = {
            weapon: null,
            armor: null,
            accessory: null,
        };
    }
}

obtainables.forEach((obtainable) => {
    Character.prototype[obtainable] = function () {
        if (obtainable.includes("item")) {
            this.inventory.push(obtainable);
        } else if (obtainable.includes("spell")) {
            this.spells.push(obtainable);
        } else if (obtainable.includes("weapon")) {
            this.equipped.weapon = obtainable;
        } else if (obtainable.includes("armor")) {
            this.equipped.armor = obtainable;
            const attributes =
                ATTRIBUTES_BY_RARITY[this.getRarity(obtainable)] || [];
            this.applyAttributes(attributes);
        } else if (obtainable.includes("accessory")) {
            this.equipped.accessory = obtainable;
        }
    };
});

Character.prototype.applyAttributes = function (attributes) {
    for (const attr of attributes) {
        if (attr.includes("life regen")) {
            const match = attr.match(/(\d+)-?(\d+)?% life regen/);
            if (match) {
                const min = parseInt(match[1]);
                const max = match[2] ? parseInt(match[2]) : min;
                this.healthRegen += Math.floor((min + max) / 2);
            }
        } else if (attr.includes("max life")) {
            const match = attr.match(/(\d+)-?(\d+)?% max life/);
            if (match) {
                const min = parseInt(match[1]);
                const max = match[2] ? parseInt(match[2]) : min;
                this.maxLife += Math.floor((min + max) / 2);
                this.health = 100 * this.maxLife; // reset health to new max
            }
        } else if (attr.includes("block chance")) {
            const match = attr.match(/(\d+)-?(\d+)?% block chance/);
            if (match) {
                const min = parseInt(match[1]);
                const max = match[2] ? parseInt(match[2]) : min;
                this.blockChance += Math.floor((min + max) / 2);
            }
        } else if (attr.includes("max mana")) {
            const match = attr.match(/(\d+)-?(\d+)?% max mana/);
            if (match) {
                const min = parseInt(match[1]);
                const max = match[2] ? parseInt(match[2]) : min;
                this.maxMana += Math.floor((min + max) / 2);
                this.mana = 100 * this.maxMana; // reset mana to new max
            }
        } else if (attr.includes("mana regen")) {
            const match = attr.match(/(\d+)-?(\d+)?% mana regen/);
            if (match) {
                const min = parseInt(match[1]);
                const max = match[2] ? parseInt(match[2]) : min;
                this.manaRegen += Math.floor((min + max) / 2);
            }
        } else if (attr.includes("luck")) {
            const match = attr.match(/(\d+)-?(\d+)? luck/);
            if (match) {
                const min = parseInt(match[1]);
                const max = match[2] ? parseInt(match[2]) : min;
                this.luck += Math.floor((min + max) / 2);
            }
        } else if (attr.includes("combat timer")) {
            const match = attr.match(/combat timer \+(\d+)%/);
            if (match) {
                this.combatTimer += parseInt(match[1]);
            }
        } else if (attr.includes("extra life")) {
            this.extraLives += 1;
        } else if (attr.includes("Resistance to all damage types")) {
            const match = attr.match(/Resistance to all damage types \+(\d+)%/);
            if (match) {
                this.damageReduction += parseInt(match[1]);
            }
        } else if (attr.includes("Luck +100")) {
            this.luck = 100;
        }
    }
};
