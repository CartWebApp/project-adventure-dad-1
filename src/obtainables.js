import { BaseBuilder, effects } from './combat.js';
import { damageReduction, combatTimer } from './character.js';
import { stamina_regen } from './character.js';

/**
 * @param {string} spellName
 * @returns {Object|null}
 */
function getSpellEffect(spellName) {
    const key = String(spellName || '').toLowerCase();
    return effects[key] || null;
}

const commonAttributes = {
    lifeRegen: [5, 10],
    maxLife: [10, 15],
    blockChance: [5, 8],
    maxMana: [5, 15],
    manaRegen: [4, 6],
    luck: [1, 5]
};
const rareAttributes = {
    lifeRegen: [8, 15],
    maxLife: [15, 20],
    blockChance: [10, 13],
    maxMana: [10, 17],
    manaRegen: [7, 9],
    luck: [3, 8]
};
const epicAttributes = {
    lifeRegen: [10, 20],
    maxLife: [15, 25],
    blockChance: 15,
    maxMana: [15, 20],
    manaRegen: [10, 13],
    luck: [5, 10]
};
const legendaryAttributes = {
    lifeRegen: 25,
    maxLife: 50,
    blockChance: 20,
    maxMana: 25,
    manaRegen: 15,
    luck: 15
};

const specialAttributes = {
    common() {
        return damageReduction * 1.1;
    },
    rare() {
        return combatTimer * 0.9;
    },
    epic() {
        return stamina_regen * 1.5;
    },
    legendary: [
        '1 extra life',
        'All mana regen *2 becomes health regen (remove mana regen)',
        'Luck +100'
    ]
};

const ATTRIBUTES_BY_RARITY = {
    common: commonAttributes,
    rare: rareAttributes,
    epic: epicAttributes,
    legendary: legendaryAttributes
};
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];
const WEIGHT_BY_RARITY = { common: 1, rare: 2, epic: 4, legendary: 8 };

function getAttributeKeys(rarity) {
    const pool = ATTRIBUTES_BY_RARITY[rarity];
    if (!pool) return [];
    if (Array.isArray(pool)) return pool.slice();
    if (typeof pool === 'object') return Object.keys(pool);
    return [];
}

function rarityForAttribute(attr) {
    for (let i = 0; i < RARITY_ORDER.length; i++) {
        const r = RARITY_ORDER[i];
        const pool = ATTRIBUTES_BY_RARITY[r];
        if (Array.isArray(pool)) {
            if (pool.includes(attr)) return r;
        } else if (pool && typeof pool === 'object') {
            if (Object.prototype.hasOwnProperty.call(pool, attr)) return r;
        }
    }
    for (const r of Object.keys(specialAttributes)) {
        const val = specialAttributes[r];
        if (Array.isArray(val) && val.includes(attr)) return r;
    }
    return 'common';
}

function randInt(max) {
    return Math.floor(Math.random() * max);
}

function pickRandomAttributes(rarity, n = 1) {
    const pool = getAttributeKeys(rarity);
    const out = [];
    const used = new Set();
    const attemptsLimit = pool.length * 3 || 0;
    let attempts = 0;
    while (out.length < n && attempts < attemptsLimit && pool.length > 0) {
        const idx = randInt(pool.length);
        const candidate = pool[idx];
        if (candidate && !used.has(candidate)) {
            used.add(candidate);
            out.push(candidate);
        }
        attempts++;
    }
    return out;
}

// armor templates (base data). We'll generate per-rarity copies with randomly picked attributes.
const armorTemplates = [
    { material: 'Cloth', type: 'Full Body', defense: 5, baseCost: 10 },
    { material: 'Leather', type: 'Cap', defense: 5, baseCost: 10 },
    { material: 'Leather', type: 'Breastplate', defense: 10, baseCost: 20 },
    { material: 'Leather', type: 'Bracers', defense: 15, baseCost: 30 },
    { material: 'Leather', type: 'Gloves', defense: 20, baseCost: 40 },
    { material: 'Leather', type: 'Leggings', defense: 5, baseCost: 10 },
    { material: 'Leather', type: 'Boots', defense: 25, baseCost: 50 },
    { material: 'iron', type: 'Helm', defense: 30, baseCost: 60 },
    { material: 'iron', type: 'Chestplate', defense: 40, baseCost: 80 },
    { material: 'iron', type: 'Bracers', defense: 35, baseCost: 70 },
    { material: 'iron', type: 'Gauntlets', defense: 25, baseCost: 50 },
    { material: 'iron', type: 'Greaves', defense: 30, baseCost: 60 },
    { material: 'iron', type: 'Boots', defense: 20, baseCost: 40 }
];

// Determine how many attributes to attach by rarity (kept inline if needed later)

/**
 * @param {string} rarity
 * @returns {Array<{ material: string, type: string, defense: number, effects: string[], cost: number }>}
 */
function buildArmorForRarity(rarity) {
    // Return rarities cascade up to target, ex: "epic" -> ["common","rare","epic"]
    /**
     * @param {string} target
     * @returns {string[]}
     */
    function getCascadeRarities(target) {
        const order = ['common', 'rare', 'epic', 'legendary'];
        const idx = order.indexOf(target);
        return idx === -1 ? ['common'] : order.slice(0, idx + 1);
    }

    // Randomly degrade the cascade slightly
    // while preserving the total attribute count ex: [1 common,2 rare,0 epic,1 legendary].
    /**
     * @param {string} target
     * @returns {Record<string, number>}
     */
    function getRandomizedDistribution(target) {
        const cascade = getCascadeRarities(target);
        // start with one slot per rarity in the cascade
        const counts = cascade.map(() => 1);

        // downgrade probability: chance to move one slot from higher rarity to the next lower
        const downgradeProb = 0.3; // adjustable
        const upgradeProb = 0.1; // adjustable

        // iterate from lowest rarity upward and attempt to move slots up (except legendary, which is highest)
        for (let i = 0; i < counts.length - 1; i++) {
            // try to move as many as possible (but bounded) based on random chance
            let attempts = 0;
            const maxAttempts = counts[i];
            while (attempts < maxAttempts && counts[i] > 0) {
                if (Math.random() < upgradeProb) {
                    counts[i] -= 1;
                    counts[i + 1] += 1;
                }
                attempts++;
            }
        }

        // iterate from highest rarity downward and attempt to move slots down
        for (let i = counts.length - 1; i >= 1; i--) {
            // try to move as many as possible (but bounded) based on random chance
            let attempts = 0;
            const maxAttempts = counts[i];
            while (attempts < maxAttempts && counts[i] > 0) {
                if (Math.random() < downgradeProb) {
                    counts[i] -= 1;
                    counts[i - 1] += 1;
                }
                attempts++;
            }
        }

        // counts array corresponds to cascade rarities in order
        /**
         * @type {Record<string, number>}
         */
        const result = {};
        for (let i = 0; i < cascade.length; i++) result[cascade[i]] = counts[i];
        return result;
    }

    return armorTemplates.map(t => {
        // small chance to replace the whole cascade with a single special attribute for the target rarity
        const specialChance = 0.05; // 5% chance
        if (
            Array.isArray(specialAttributes[rarity]) &&
            Math.random() <= specialChance
        ) {
            const sa = specialAttributes[rarity];
            const picked = sa[randInt(sa.length)];
            const weightSum = WEIGHT_BY_RARITY[rarity] || 0;
            return {
                material: t.material,
                type: t.type,
                defense: t.defense,
                effects: [picked],
                cost: t.baseCost + 1 + weightSum
            };
        }
        const distribution = getRandomizedDistribution(rarity);
        const totalNeeded = Object.values(distribution).reduce(
            (a, b) => a + b,
            0
        );
        const effects = [];
        const used = new Set();

        // For each rarity in order (from common up), pick the required number of attributes from that rarity's full pool
        for (const r of Object.keys(distribution)) {
            let needed = distribution[r] || 0;
            if (needed <= 0) continue;
            const poolKeys = getAttributeKeys(r);
            if (poolKeys.length === 0) continue;
            /**
             * @type {string[]}
             */
            const picked = [];
            const attemptsLimit = poolKeys.length * 3;
            let attempts = 0;
            while (picked.length < needed && attempts < attemptsLimit) {
                const candidate = pickRandomAttributes(r, 1)[0];
                if (!candidate) break;
                if (!used.has(candidate) && !picked.includes(candidate))
                    picked.push(candidate);
                attempts++;
            }

            // fallback: take first non-used entries from poolKeys
            if (picked.length < needed) {
                for (const p of poolKeys) {
                    if (picked.length >= needed) break;
                    if (!used.has(p) && !picked.includes(p)) picked.push(p);
                }
            }

            for (const p of picked) {
                effects.push(p);
                used.add(p);
            }
        }

        // If still short, fill from any rarity pools starting from common until we reach totalNeeded
        if (effects.length < totalNeeded) {
            const fallbackOrder = ['common', 'rare', 'epic', 'legendary'];
            let i = 0;
            let safety = 0;
            while (effects.length < totalNeeded && safety < 100) {
                const r = fallbackOrder[i % fallbackOrder.length];
                const pool = /** @type {any} */ (ATTRIBUTES_BY_RARITY)[r] || [];
                for (const p of /** @type {any[]} */ (pool)) {
                    if (effects.length >= totalNeeded) break;
                    if (!used.has(p)) {
                        effects.push(p);
                        used.add(p);
                    }
                }
                i++;
                safety++;
            }
        }

        // compute cost based on baseCost, number of effects, and rarity weights
        const weightSum = effects.reduce((sum, e) => {
            const r = rarityForAttribute(e);
            return sum + (WEIGHT_BY_RARITY[r] || 0);
        }, 0);

        return {
            material: t.material,
            type: t.type,
            defense: t.defense,
            effects,
            cost: t.baseCost + effects.length + weightSum
        };
    });
}

// Now build obtainables arrays
const commonArmor = [...buildArmorForRarity('common')];

const rareArmor = [...buildArmorForRarity('rare')];

const epicArmor = [...buildArmorForRarity('epic')];

const legendaryArmor = [...buildArmorForRarity('legendary')];

// obtainables will be assembled after we define spells/items/weapons/potions (below)

// Currency helpers (1 silver = 100 copper, 1 gold = 10000 copper)
const COPPER = 1;
const SILVER = 100 * COPPER;
const GOLD = 100 * SILVER;

// Use builder pattern and classes for potions, items, weapons, and spells

class Potion {
    name;
    effects;
    costs;
    constructor({ name, effect, costs }) {
        this.name = name;
        this.effect = effect;
        this.costs = costs;
    }
}

class PotionBuilder extends BaseBuilder {
    constructor() {
        super(data => new Potion(data), 'name', 'effect', 'costs');
    }
    build() {
        return new Potion(this.data);
    }
}

class Item {
    name;
    description;
    throwable;
    uses;
    edible_uses;
    value;
    /**
     * @param {{ name: string; description?: string; throwable?: boolean; uses?: number; edible_uses?: number; value?: number }} options
     */
    constructor({
        name,
        description = '',
        throwable = false,
        uses = 1,
        edible_uses = 0,
        value = 0
    }) {
        this.name = name;
        this.description = description;
        this.throwable = throwable;
        this.uses = uses;
        this.edible_uses = edible_uses;
        this.value = value;
    }
}

class ItemBuilder extends BaseBuilder {
    constructor() {
        super(
            data => new Item(data),
            'name',
            'description',
            'throwable',
            'uses',
            'edible_uses',
            'value',
            'assets'
        );
    }
}

class Weapon {
    name;
    general;
    stats_by_rarity;
    constructor({ name, general = '', stats_by_rarity = {} }) {
        this.name = name;
        this.general = general;
        this.stats_by_rarity = stats_by_rarity;
    }
}

class WeaponBuilder extends BaseBuilder {
    constructor() {
        super(data => new Weapon(data), 'name', 'general', 'stats_by_rarity');
    }
}

export class Spell {
    name;
    cast;
    effect;
    mana_cost_by_rarity;
    constructor({ name, cast = '', effect = {}, mana_cost_by_rarity = {} }) {
        this.name = name;
        this.cast = cast;
        this.effect = effect;
        this.mana_cost_by_rarity = mana_cost_by_rarity;
    }
}

class SpellBuilder extends BaseBuilder {
    constructor() {
        super(
            data => {
                // ensure fields exist bcs someone desided to make my life hell by making spells wierd
                if (!data.mana_cost_by_rarity) data.mana_cost_by_rarity = {};
                if (!data.params_by_rarity) data.params_by_rarity = {};
                return new Spell(data);
            },
            'name',
            'mana_cost_by_rarity',
            'cast',
            'effect',
            'params_by_rarity'
        );
    }
}

// Create instances using builders
const potions = [
    new PotionBuilder()
        .with_name('Swiftness Potion')
        .with_effect({
            type: 'combatTimerPercent',
            valuesByRarity: { common: 10, rare: 20, epic: 35, legendary: 50 }
        })
        .with_costs({
            common: 25 * COPPER,
            rare: 5 * SILVER,
            epic: 35 * SILVER,
            legendary: 75 * SILVER
        })
        .build(),
    new PotionBuilder()
        .with_name('Health Potion')
        .with_effect({
            type: 'healthRegenPercent',
            valuesByRarity: { common: 10, rare: 25, epic: 50, legendary: 100 }
        })
        .with_costs({
            common: 10 * COPPER,
            rare: 1 * SILVER,
            epic: 10 * SILVER,
            legendary: 1 * GOLD
        })
        .build(),
    new PotionBuilder()
        .with_name('Mana Potion')
        .with_effect({
            type: 'manaRegenPercent',
            valuesByRarity: { common: 10, rare: 25, epic: 50, legendary: 100 }
        })
        .with_costs({
            common: 10 * COPPER,
            rare: 1 * SILVER,
            epic: 10 * SILVER,
            legendary: 1 * GOLD
        })
        .build(),
    new PotionBuilder()
        .with_name('Inf Mana Potion')
        .with_effect({
            type: 'infiniteMana',
            valuesByRarity: {
                epic: { durationSeconds: 5 },
                legendary: { durationSeconds: 10 }
            }
        })
        .with_costs({ epic: 3 * GOLD, legendary: 9 * GOLD })
        .build(),
    new PotionBuilder()
        .with_name('Shamrock Shake')
        .with_effect({ type: 'applyPoison', damagePerSecond: 1 })
        .with_costs({ common: 5 * SILVER })
        .build(),
    new PotionBuilder()
        .with_name('Stamina Potion')
        .with_effect({
            type: 'staminaRegenPercent',
            valuesByRarity: { common: 15, rare: 30, epic: 50, legendary: 100 }
        })
        .with_costs({
            common: 15 * COPPER,
            rare: 1 * SILVER,
            epic: 10 * SILVER,
            legendary: 1 * GOLD
        })
        .build(),
    new PotionBuilder()
        .with_name('Rock Skin Potion')
        .with_effect({
            type: 'physicalDamageBlockPercent',
            valuesByRarity: { common: 10, rare: 20, epic: 35, legendary: 60 }
        })
        .with_costs({
            common: 20 * COPPER,
            rare: 2 * SILVER,
            epic: 20 * SILVER,
            legendary: 2 * GOLD
        })
        .build(),
    new PotionBuilder()
        .with_name('Luck Potion')
        .with_effect({
            type: 'battleLuck',
            valuesByRarity: { common: 5, rare: 10, epic: 25, legendary: 100 }
        })
        .with_costs({
            common: 10 * COPPER,
            rare: 1 * SILVER,
            epic: 10 * SILVER,
            legendary: 1 * GOLD
        })
        .build()
];

const items = [
    new ItemBuilder()
        .with_name('Holy Hand Grenade')
        .with_description(
            'When activated, must be thrown within 3 seconds before it explodes; deals up to 50 damage and may blind (75% chance, 30s).'
        )
        .with_throwable(true)
        .with_uses(1)
        .with_value(5 * GOLD)
        .with_assets(['assets/holy_hand_grenade.png'])
        .build(),
    new ItemBuilder()
        .with_name('Rock')
        .with_description('Can be thrown to deal ~5 damage.')
        .with_throwable(true)
        .with_uses(1)
        .with_value(2 * COPPER)
        .with_assets(['assets/rock.png'])
        .build(),
    new ItemBuilder()
        .with_name('Molotov Cocktail')
        .with_description(
            'Thrown explosive that applies burning to enemies (8s).'
        )
        .with_throwable(true)
        .with_uses(1)
        .with_value(30 * SILVER)
        .with_assets(['assets/molotov_cocktail.png'])
        .build(),
    new ItemBuilder()
        .with_name('Old Boot')
        .with_description('Can be thrown to deal 1 damage.')
        .with_throwable(true)
        .with_uses(1)
        .with_value(1 * COPPER)
        .with_assets(['assets/old_boot.png'])
        .build(),
    new ItemBuilder()
        .with_name('Potato')
        .with_description(
            'Throwable and edible: throw to deal 1 damage or eat for +5 health.'
        )
        .with_throwable(true)
        .with_uses(1)
        .with_edible_uses(1)
        .with_value(10 * COPPER)
        .with_assets(['assets/potato.png'])
        .build(),
    new ItemBuilder()
        .with_name('Thinkpad X1 Carbon')
        .with_description(
            'Throwable: deals 5 explosive damage and applies burning for the rest of the battle.'
        )
        .with_throwable(true)
        .with_uses(1)
        .with_value(10 * GOLD)
        .with_assets(['assets/thinkpad_x1_carbon.png'])
        .build(),
    new ItemBuilder()
        .with_name('Sock Puppet')
        .with_description('Comfort item; edible for small regen (0.1).')
        .with_throwable(false)
        .with_uses(1)
        .with_value(10 * COPPER)
        .with_assets([
            'assets/sock_puppet_1.png',
            'assets/sock_puppet_2.png',
            'assets/sock_puppet_3.png',
            'assets/sock_puppet_4.png',
            'assets/sock_puppet_5.png',
            'assets/sock_puppet_6.png',
            'assets/sock_puppet_7.png',
            'assets/sock_puppet_8.png'
        ])
        .build(),
    new ItemBuilder()
        .with_name('The Last Straw')
        .with_description(
            'When held, prevents death (leaves you at 1HP) but halves health regen for the battle.'
        )
        .with_throwable(false)
        .with_uses(1)
        .with_value(15 * SILVER)
        .with_assets([
            'assets/the_last_straw_1.png',
            'assets/the_last_straw_2.png',
            'assets/the_last_straw_3.png',
            'assets/the_last_straw_4.png',
            'assets/the_last_straw_5.png'
        ])
        .build(),
    new ItemBuilder()
        .with_name('Napkin')
        .with_description('When thrown deals brief blindness (70% for 1s).')
        .with_throwable(true)
        .with_uses(1)
        .with_value(10 * COPPER)
        .with_assets(['assets/napkin.png'])
        .build(),
    new ItemBuilder()
        .with_name('Anvil')
        .with_description('Drop on enemies to deal 20 damage.')
        .with_throwable(true)
        .with_uses(3)
        .with_value(50 * SILVER)
        .with_assets(['assets/anvil.png'])
        .build()
];

const weapons = [
    new WeaponBuilder()
        .with_name('Basic Sword')
        .with_general('Deals 10 damage')
        .with_stats_by_rarity({
            common: { damage: 10, stamina: 10 },
            rare: { damage: 12, stamina: 10 },
            epic: { damage: 14, stamina: 10 },
            legendary: { damage: 16, stamina: 10 }
        })
        .build(),
    new WeaponBuilder()
        .with_name('Basic Dagger')
        .with_general('Deals 5 damage')
        .with_stats_by_rarity({
            common: { damage: 5, stamina: 5 },
            rare: { damage: 7, stamina: 5 },
            epic: { damage: 9, stamina: 5 },
            legendary: { damage: 11, stamina: 5 }
        })
        .build(),
    new WeaponBuilder()
        .with_name('Basic Axe')
        .with_general('Deals 15 damage')
        .with_stats_by_rarity({
            common: { damage: 15, stamina: 15 },
            rare: { damage: 17, stamina: 15 },
            epic: { damage: 19, stamina: 15 },
            legendary: { damage: 21, stamina: 15 }
        })
        .build(),
    new WeaponBuilder()
        .with_name('Lifesteal Blade')
        .with_general('Steals % of opponents life as health')
        .with_stats_by_rarity({
            common: { stealPercent: 5, stamina: 20 },
            rare: { stealPercent: 10, stamina: 15 },
            epic: { stealPercent: 10, stamina: 10 },
            legendary: { stealPercent: 12, stamina: 8 }
        })
        .build(),
    new WeaponBuilder()
        .with_name('Swift Dagger')
        .with_general('Fast dagger')
        .with_stats_by_rarity({
            common: { damage: 7, stamina: 5 },
            rare: { damage: 8, stamina: 4 },
            epic: { damage: 10, stamina: 3 },
            legendary: { damage: 9, stamina: 2 }
        })
        .build(),
    new WeaponBuilder()
        .with_name('Fire Axe')
        .with_general('Deals damage and applies burning')
        .with_stats_by_rarity({
            common: { damage: 8, stamina: 10, burnSeconds: 4 },
            rare: { damage: 10, stamina: 10, burnSeconds: 6 },
            epic: { damage: 14, stamina: 15, burnSeconds: 8 },
            legendary: { damage: 18, stamina: 15, burnSeconds: 10 }
        })
        .build()
];

const spells = [
    new SpellBuilder()
        .with_name('Mana Bolt')
        .with_cast('battle')
        .with_effect({ type: 'directDamage' })
        .with_mana_cost_by_rarity({
            common: 15,
            rare: 20,
            epic: 30,
            legendary: 50
        })
        .build(),
    new SpellBuilder()
        .with_name('Black Hole')
        .with_cast('battle')
        .with_effect({ type: 'areaSuck' })
        .with_params_by_rarity({
            epic: { radius: 10, damagePerTick: 15 },
            legendary: { radius: 15, damagePerTick: 20 }
        })
        .with_mana_cost_by_rarity({ epic: 40, legendary: 50 })
        .build(),
    new SpellBuilder()
        .with_name('Guardian Angel')
        .with_cast('anywhere')
        .with_effect({ type: 'guidance' })
        .with_params_by_rarity({ legendary: { persistent: true } })
        .with_mana_cost_by_rarity({ legendary: 100 })
        .build(),
    new SpellBuilder()
        .with_name('Magic Missile')
        .with_cast('battle/doors')
        .with_effect({ type: 'explosive' })
        .with_params_by_rarity({
            common: { damage: 18 },
            rare: { damage: 22 },
            epic: { damage: 28 },
            legendary: { damage: 36 }
        })
        .with_mana_cost_by_rarity({
            common: 12,
            rare: 22,
            epic: 30,
            legendary: 40
        })
        .build(),
    new SpellBuilder()
        .with_name('Portal')
        .with_cast('non-battle')
        .with_effect({ type: 'teleport' })
        .with_mana_cost_by_rarity({})
        .build(),
    new SpellBuilder()
        .with_name('Earthquake')
        .with_cast('battle')
        .with_effect({ type: 'areaDamage', damage: 15 })
        .with_params_by_rarity({
            rare: { durationMinutes: 1 },
            epic: { durationMinutes: 2.5 },
            legendary: { durationMinutes: 5 }
        })
        .with_mana_cost_by_rarity({ rare: 25, epic: 40, legendary: 60 })
        .build(),
    new SpellBuilder()
        .with_name('Curse of the Plague')
        .with_cast('battle')
        .with_effect({ type: 'randomEffect' })
        .with_params_by_rarity({
            rare: { effectPercent: 10, duration: 30 },
            epic: { effectPercent: 10, duration: 40 },
            legendary: { effectPercent: 15, duration: 50 }
        })
        .with_mana_cost_by_rarity({ rare: 30, epic: 40, legendary: 50 })
        .build(),
    new SpellBuilder()
        .with_name("Zeus's Blessing")
        .with_cast('battle')
        .with_effect({ type: 'lightningStorm' })
        .with_params_by_rarity({
            rare: { targets: 'enemies', durationMinutes: 2 },
            epic: { targets: 'enemies', durationMinutes: 4 },
            legendary: { targets: 'enemies', durationMinutes: 8 }
        })
        .with_mana_cost_by_rarity({ rare: 25, epic: 35, legendary: 55 })
        .build(),
    new SpellBuilder()
        .with_name('Godlike')
        .with_cast('battle')
        .with_effect({ type: 'omniBuff' })
        .with_params_by_rarity({ legendary: { durationSeconds: 20 } })
        .with_mana_cost_by_rarity({ legendary: 80 })
        .build(),
    new SpellBuilder()
        .with_name('Bloody Exchange')
        .with_cast('battle')
        .with_effect({ type: 'healthTrade' })
        .with_params_by_rarity({
            rare: { percent: 20 },
            epic: { percent: 50 },
            legendary: { percent: 80 }
        })
        .with_mana_cost_by_rarity({ rare: 0, epic: 0, legendary: 0 })
        .build(),
    new SpellBuilder()
        .with_name('Blessing of Life')
        .with_cast('anywhere')
        .with_effect({ type: 'fullRegen' })
        .with_params_by_rarity({
            epic: { castTimeSeconds: 90 },
            legendary: { castTimeSeconds: 45 }
        })
        .with_mana_cost_by_rarity({ epic: 0, legendary: 0 })
        .build(),
    new SpellBuilder()
        .with_name('Fireball')
        .with_cast('battle')
        .with_effect({ type: 'explosiveWithBurn' })
        .with_params_by_rarity({
            common: { damage: 5, burnSeconds: 4 },
            rare: { damage: 8, burnSeconds: 8 },
            epic: { damage: 12, burnSeconds: 10 },
            legendary: { damage: 24, burnSeconds: 15 }
        })
        .with_mana_cost_by_rarity({
            common: 14,
            rare: 24,
            epic: 28,
            legendary: 32
        })
        .build(),
    new SpellBuilder()
        .with_name('Raise Dead')
        .with_cast('battle')
        .with_effect({ type: 'summon' })
        .with_params_by_rarity({
            rare: { count: 2 },
            epic: { count: 6 },
            legendary: { count: 8 }
        })
        .with_mana_cost_by_rarity({ rare: 30, epic: 45, legendary: 60 })
        .build(),
    new SpellBuilder()
        .with_name('Cleanse')
        .with_cast('anywhere')
        .with_effect({ type: 'clearEffects' })
        .with_mana_cost_by_rarity({ legendary: 75 })
        .build()
];

// Now assemble obtainables using the constructed spell and armor arrays
const obtainables = [
    ...spells,
    ...commonArmor,
    ...rareArmor,
    ...epicArmor,
    ...legendaryArmor
];

// Now export utility functions and data for other modules or testing
export {
    randInt,
    pickRandomAttributes,
    buildArmorForRarity as getArmorForRarity,
    obtainables,
    potions,
    items,
    weapons,
    spells,
    getSpellEffect,
    BaseBuilder
};
