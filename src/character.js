// @ts-check
import { CHARACTER_CHOICES } from './constants.js';
import { Spell } from './obtainables.js';
export const damageReduction = 0;
export const combatTimer = 100;

// Character Stats and Inventory

class Player {
    name;
    max_life;
    health;
    max_mana;
    mana;
    max_stamina;
    stamina;
    stamina_regen;
    mana_regen;
    health_regen;
    luck;
    block_chance;
    damage_reduction;
    combat_timer;
    extra_lives;
    resistances;
    /** @type {any[]} */
    inventory;
    /** @type {Spell[]} */
    spells;
    equipped;
    /** @type {(typeof CHARACTER_CHOICES)[keyof typeof CHARACTER_CHOICES]} */
    character;

    /**
     * @param {string} name
     * @param {(typeof CHARACTER_CHOICES)[keyof typeof CHARACTER_CHOICES]} character
     */
    constructor(name, character) {
        this.name = name;
        this.character = character;
        // defaults
        this.max_life = 100;
        this.health = this.max_life;
        this.max_mana = 50;
        this.mana = this.max_mana;
        this.max_stamina = 100;
        this.stamina = this.max_stamina;
        this.stamina_regen = 10;
        this.mana_regen = 5;
        this.health_regen = 5;
        this.luck = 0;
        this.block_chance = 0;
        this.damage_reduction = 0;
        this.combat_timer = 100;
        this.extra_lives = 0;
        this.resistances = {
            burning: 0,
            blindness: 0,
            withering: 0,
            poison: 0,
            shocked: 0,
            petrified: 0,
            rooted: 0,
            weakness: 0
        };
        this.inventory = [];
        this.spells = [];
        this.equipped = {
            weapon: null,
            armor: null,
            accessory: null
        };
    }

    /**
     * @param {any} armorObj
     */
    equip(armorObj) {
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
        if (!attributes) return alert('Wrong value error (applyAttributes)');
        const attrs = Array.isArray(attributes) ? attributes : [attributes];
        for (const attr of attrs) {
            if (!attr) continue;

            // Object: key -> [value] / [min,max]
            if (typeof attr === 'object' && !Array.isArray(attr)) {
                for (const [k, v] of Object.entries(attr)) {
                    applyAttributeKey(this, k, v);
                }
                continue;
            }

            // Special string patterns
            if (typeof attr === 'string') {
                const s = attr.toLowerCase();

                // Extra life
                if (s.includes('extra life')) {
                    this.extra_lives += 1;
                    continue;
                }

                // Luck +100
                if (s.includes('luck')) {
                    const m = s.match(/\+?(\d+)/);
                    if (m) {
                        const val = parseInt(m[1], 10);
                        this.luck += val;
                    }
                    continue;
                }

                // 'resistance to all damage types +10%'
                if (s.includes('resistance to all damage types')) {
                    const m = s.match(/\+(\d+)%/);
                    if (m) this.damage_reduction += parseInt(m[1], 10);
                    continue;
                }
                // All mana regen * 2 becomes health regen (Remove mana regen)
                if (s.includes('becomes health regen')) {
                    this.health_regen = this.mana_regen * 2;
                    this.manaregen = 0;
                    continue;
                }
            }
        }
    }
}

/**
 * @template {keyof Player | keyof Player['resistances']} const K
 * @param {Player} self
 * @param {K} key
 * @param {K extends keyof Player ? [Player[K], Player[K]] : K extends keyof Player['resistances'] ? [Player['resistances'][K], Player['resistances'][K]] : never} value
 */
function applyAttributeKey(self, key, value) {
    const min = Math.min(Number(value[0]), Number(value[1]));
    const max = Math.max(Number(value[0]), Number(value[1]));

    const v = Array.isArray(value)
        ? Math.floor(Math.random() * (max - min + 1)) + min
        : Number(value);
    switch (key) {
        case 'max_life':
            self.max_life += v;
            self.health = Math.min(self.health, self.max_life);
            break;
        case 'block_chance':
            self.block_chance += v;
            break;
        case 'max_mana':
            self.max_mana += v;
            self.mana = Math.min(self.mana, self.max_mana);
            break;
        case 'health_regen':
        case 'block_chance':
        case 'mana_regen':
        case 'stamina_regen':
        case 'combat_timer':
        case 'damage_reduction':
        case 'luck':
            self[key] += v;
            break;
        case 'max_stamina':
            self.max_stamina += v;
            self.stamina = Math.min(self.stamina, self.max_stamina);
            break;
        default:
            // unknown key: store on resistances if it exists
            if (key in self.resistances) {
                self.resistances[key] += v;
            }
    }
}

export { Player as Character };
