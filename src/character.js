// @ts-check
import { CHARACTER_CHOICES, ORIENTATIONS } from './constants.js';
import { Animation, Image } from './objects.js';
import { Item, items, Spell } from './obtainables.js';
import { asset } from './utils.js';
// Character Stats and Inventory

class Player {
    name;
    max_life;
    /** @type {number} */
    #health;
    get health() {
        return this.#health;
    }
    set health(value) {
        this.#health = Math.max(0, Math.min(value, this.max_life));
    }
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
    /** @type {Array<Item | null>} */
    inventory;
    /** @type {Spell[]} */
    spells;
    equipped;
    /** @type {(typeof CHARACTER_CHOICES)[keyof typeof CHARACTER_CHOICES]} */
    character;
    x = 500;
    /** @type {(typeof ORIENTATIONS)[keyof typeof ORIENTATIONS]} */
    direction = ORIENTATIONS.EAST;
    /** @type {Animation} */
    cast_animation;

    /**
     * @param {string} name
     * @param {(typeof CHARACTER_CHOICES)[keyof typeof CHARACTER_CHOICES]} character
     */
    constructor(name, character) {
        this.name = name;
        this.character = character;
        // defaults
        this.max_life = 100;
        this.#health = this.max_life;
        this.max_mana = 50;
        this.mana = this.max_mana;
        this.max_stamina = 100;
        this.stamina = this.max_stamina;
        this.stamina_regen = 10;
        this.mana_regen = 5;
        this.health_regen = 5;
        this.luck = 0;
        this.block_chance = 0;
        // Whole number converts to percent (50 -> 50% or 0.5)
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
        this.inventory = Array(175).fill(null);
        this.inventory[0] = items[1];
        this.spells = [];
        this.equipped = {
            weapon: null,
            armor: null,
            accessory: null,
            spells: []
        };
        this.money = 0;
        this.cast_animation = new Animation(
            ...Array(this.character === CHARACTER_CHOICES.SLAVE ? 7 : 8)
                .fill(0)
                .map((_, index) =>
                    asset(
                        `${
                            this.character === CHARACTER_CHOICES.BEGGAR
                                ? 'beggar'
                                : this.character === CHARACTER_CHOICES.SLAVE
                                ? 'slave'
                                : 'knight'
                        }/cast/${index + 1}.png`
                    )
                )
                .map(
                    name => new Image(name, { width: 92, height: 92, scale: 7 })
                )
        );
    }

    toJSON() {
        // object destructuring omits properties that aren't enumerable
        // and since accessors aren't enumerable by default, we must specify `health`
        const {
            equip,
            applyAttributes,
            get_entity,
            cast_animation,
            health,
            inventory,
            ...props
        } = this;
        return {
            ...props,
            health,
            inventory: inventory.map(item => item?.name ?? null)
        };
    }

    /**
     * @param {(typeof ORIENTATIONS)[keyof typeof ORIENTATIONS]} orientation
     * @param {number} scale
     */
    get_entity(orientation, scale) {
        return new Image(
            asset(
                `${
                    this.character === CHARACTER_CHOICES.BEGGAR
                        ? 'beggar'
                        : this.character === CHARACTER_CHOICES.SLAVE
                        ? 'slave'
                        : 'knight'
                }/${orientation}.png`
            ),
            { scale }
        );
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
                    this.damage_reduction += 10;
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
 * Apply a single attribute key to a player. Keys may be top-level player stats
 * or named resistances. We accept string keys and any value to keep the
 * runtime flexible; precise typing causes excessive @ts-check issues here.
 * @param {Player} self
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
                /** @type {any} */ (self.resistances)[key] += v;
            }
    }
}

export { Player };
