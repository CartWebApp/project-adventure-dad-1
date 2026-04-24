// @ts-check

export const damageReduction = 0;
export const combatTimer = 100;

// Character Stats and Inventory

/**
 * @class Character
 */
class Character {
    name;
    maxLife;
    health;
    maxMana;
    mana;
    maxStamina;
    stamina;
    staminaRegen;
    manaRegen;
    healthRegen;
    luck;
    blockChance;
    damageReduction;
    combatTimer;
    extraLives;
    resistances;
    /** @type {any[]} */
    inventory;
    /** @type {any[]} */
    spells;
    equipped;

    /**
     * @param {string} name
     */
    constructor(name) {
        this.name = name;
        // defaults
        this.maxLife = 100;
        this.health = this.maxLife;
        this.maxMana = 50;
        this.mana = this.maxMana;
        this.maxStamina = 100;
        this.stamina = this.maxStamina;
        this.staminaRegen = 10;
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

    /**
     * @param {any} armorObj
     */
    equipArmor(armorObj) {
        if (!armorObj) return alert('Wrong value error (equipArmor)');
        this.equipped.armor = armorObj;
        const attributes = armorObj.effects || [];
        this.applyAttributes(attributes);
    }

    /**
     * @param {any} attributes
     */
    applyAttributes(attributes) {
        // Safe guard
        if (!attributes)
            return alert("Wrong value error (applyAttributes)");
        const attrs = Array.isArray(attributes) ? attributes : [attributes];
        for (const attr of attrs) {
            if (!attr) continue;

            // Object: key -> [value] / [min,max]
            if (typeof attr === "object" && !Array.isArray(attr)) {
                for (const [k, v] of Object.entries(attr)) {
                    applyAttributeKey(this, k, v);
                }
                continue;
            }

            // Special string patterns
            if (typeof attr === "string") {
                const s = attr.toLowerCase();

                // Extra life
                if (s.includes("extra life")) {
                    this.extraLives += 1;
                    continue;
                }

                // Luck +100
                if (s.includes("luck")) {
                    const m = s.match(/\+?(\d+)/);
                    if (m) {
                        const val = parseInt(m[1], 10);
                        this.luck += val;
                    }
                    continue;
                }

                // 'resistance to all damage types +10%'
                if (s.includes("resistance to all damage types")) {
                    const m = s.match(/\+(\d+)%/);
                    if (m) this.damageReduction += parseInt(m[1], 10);
                    continue;
                }
                if (s.includes("'All mana regen *2 becomes health regen (remove mana regen)")) {
                    this.healthRegen = (this.manaRegen * 2);
                    this.manaregen = 0;
                    continue;
                }
            }
        }
    }
}

/**
 * @param {Character|any} self
 * @param {string} key
 * @param {any} value
 */
function applyAttributeKey(self, key, value) {
    const min = Math.min(Number(value[0]), Number(value[1]));
    const max = Math.max(Number(value[0]), Number(value[1]));

    const v = Array.isArray(value)
        ? Math.floor(Math.random() * (max - min + 1)) + min
        : Number(value);
    switch (key) {
        case "lifeRegen":
        case "healthRegen":
            self.healthRegen += v;
            break;
        case "maxLife":
            self.maxLife += v;
            self.health = Math.min(self.health, self.maxLife);
            break;
        case "blockChance":
            self.blockChance += v;
            break;
        case "maxMana":
            self.maxMana += v;
            self.mana = Math.min(self.mana, self.maxMana);
            break;
        case "manaRegen":
            self.manaRegen += v;
            break;
        case "maxStamina":
            self.maxStamina += v;
            self.stamina = Math.min(self.stamina, self.maxStamina);
            break;
        case "staminaRegen":
            self.staminaRegen += v;
            break;
        case "luck":
            self.luck += v;
            break;
        case "combatTimer":
            self.combatTimer += v;
            break;
        case "damageReduction":
            self.damageReduction += v;
            break;
        default:
            // unknown key: store on resistances if it exists
            if (key in self.resistances) {
                self.resistances[key] += v;
            } else {
                // attach as a generic property so data isn't lost
                self[key] = (self[key] || 0) + v;
            }
    }
}

export { Character };
