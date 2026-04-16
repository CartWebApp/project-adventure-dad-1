import {
    effects,
} from './combat.js'

function getSpellEffect(spellName) {
    const key = String(spellName || "").toLowerCase();
    return effects[key] || null;
}

// Attribute pools by rarity
const commonAttributes = [
    "5-10% life regen",
    "10-15% max life",
    "5-8% block chance",
    "5-15% max mana",
    "4-6% mana regen",
    "1-5 luck",
];
const rareAttributes = [
    "8-15% life regen",
    "15-20% max life",
    "10-13% block chance",
    "10-17% max mana",
    "7-9% mana regen",
    "3-8 luck",
];
const epicAttributes = [
    "10-20% life regen",
    "15-25% max life",
    "15% block chance",
    "15-20% max mana",
    "10-13% mana regen",
    "5-10 luck",
];
const legendaryAttributes = [
    "25% life regen",
    "50% max life",
    "20% block chance",
    "25% max mana",
    "15% mana regen",
    "15 luck",
];
const specialAttributes = {
    common: ["Defense *2"],
    rare: ["combat timer +10%"],
    epic: ["Resistance to all damage types +10%"],
    legendary: [
        "1 extra life",
        "All mana regen *2 becomes health regen (remove mana regen)",
        "Luck +100",
    ],
};

const ATTRIBUTES_BY_RARITY = {
    common: commonAttributes,
    rare: rareAttributes,
    epic: epicAttributes,
    legendary: legendaryAttributes,
};

// Weight per rarity for cost (adjustible)
const WEIGHT_BY_RARITY = {
    common: 1,
    rare: 2,
    epic: 4,
    legendary: 8,
};

function rarityForAttribute(attr) {
    for (const r of Object.keys(ATTRIBUTES_BY_RARITY)) {
        if ((ATTRIBUTES_BY_RARITY[r] || []).includes(attr)) return r;
    }
    // also check special attributes
    for (const r of Object.keys(specialAttributes)) {
        if ((specialAttributes[r] || []).includes(attr)) return r;
    }
    return "common";
}

// Small helper: get a random integer in [0, max)
function randInt(max) {
    return Math.floor(Math.random() * max);
}

// Choose n unique random attributes from a rarity's pool.
function pickRandomAttributes(rarity, n = 1) {
    const pool = ATTRIBUTES_BY_RARITY[rarity] || [];
    const result = [];
    const used = new Set();
    const attemptsLimit = pool.length * 3;
    let attempts = 0;
    while (result.length < n && attempts < attemptsLimit && pool.length > 0) {
        const idx = randInt(pool.length);
        if (!used.has(idx)) {
            used.add(idx);
            result.push(pool[idx]);
        }
        attempts++;
    }
    return result;
}

// armor templates (base data). We'll generate per-rarity copies with randomly picked attributes.
const armorTemplates = [
    { material: "Cloth", type: "Full Body", defense: 5, baseCost: 10 },
    { material: "Leather", type: "Cap", defense: 5, baseCost: 10 },
    { material: "Leather", type: "Breastplate", defense: 10, baseCost: 20 },
    { material: "Leather", type: "Bracers", defense: 15, baseCost: 30 },
    { material: "Leather", type: "Gloves", defense: 20, baseCost: 40 },
    { material: "Leather", type: "Leggings", defense: 5, baseCost: 10 },
    { material: "Leather", type: "Boots", defense: 25, baseCost: 50 },
    { material: "iron", type: "Helm", defense: 30, baseCost: 60 },
    { material: "iron", type: "Chestplate", defense: 40, baseCost: 80 },
    { material: "iron", type: "Bracers", defense: 35, baseCost: 70 },
    { material: "iron", type: "Gauntlets", defense: 25, baseCost: 50 },
    { material: "iron", type: "Greaves", defense: 30, baseCost: 60 },
    { material: "iron", type: "Boots", defense: 20, baseCost: 40 },
];

// Determine how many attributes to attach by rarity
const ATTR_COUNT_BY_RARITY = {
    common: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
};

function buildarmorForRarity(rarity) {
    // Return rarities cascade up to target, ex: "epic" -> ["common","rare","epic"]
    function getCascadeRarities(target) {
        const order = ["common", "rare", "epic", "legendary"];
        const idx = order.indexOf(target);
        return idx === -1 ? ["common"] : order.slice(0, idx + 1);
    }

    // Randomly degrade the cascade slightly
    // while preserving the total attribute count ex: [1 common,2 rare,0 epic,1 legendary].
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
        const result = {};
        for (let i = 0; i < cascade.length; i++) result[cascade[i]] = counts[i];
        return result;
    }

    return armorTemplates.map((t) => {
        // small chance to replace the whole cascade with a single special attribute for the target rarity
        const specialChance = 0.05; // 5% chance
        if (
            specialAttributes[rarity] &&
            specialAttributes[rarity].length > 0 &&
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
                cost: t.baseCost + 1 + weightSum,
            };
        }
        const distribution = getRandomizedDistribution(rarity);
        const totalNeeded = Object.values(distribution).reduce(
            (a, b) => a + b,
            0,
        );
        const effects = [];
        const used = new Set();

        // For each rarity in order (from common up), pick the required number of attributes from that rarity's full pool
        for (const r of Object.keys(distribution)) {
            let needed = distribution[r] || 0;
            if (needed <= 0) continue;
            const pool = ATTRIBUTES_BY_RARITY[r] || [];
            if (pool.length === 0) continue;

            const picked = [];
            const attemptsLimit = pool.length * 3;
            let attempts = 0;
            while (picked.length < needed && attempts < attemptsLimit) {
                const candidate = pickRandomAttributes(r, 1)[0];
                if (!candidate) break;
                if (!used.has(candidate) && !picked.includes(candidate))
                    picked.push(candidate);
                attempts++;
            }

            // fallback: take first non-used entries from pool
            if (picked.length < needed) {
                for (const p of pool) {
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
            const fallbackOrder = ["common", "rare", "epic", "legendary"];
            let i = 0;
            let safety = 0;
            while (effects.length < totalNeeded && safety < 100) {
                const r = fallbackOrder[i % fallbackOrder.length];
                const pool = ATTRIBUTES_BY_RARITY[r] || [];
                for (const p of pool) {
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
            cost: t.baseCost + effects.length + weightSum,
        };
    });
}

// Now build obtainables arrays
const commonArmor = [...buildarmorForRarity("common")];

const rareArmor = [...buildarmorForRarity("rare")];

const epicArmor = [...buildarmorForRarity("epic")];

const legendaryArmor = [...buildarmorForRarity("legendary")];

// obtainables will be assembled after we define spells/items/weapons/potions (below)

// Currency helpers (1 silver = 100 copper, 1 gold = 10000 copper)
const COPPER = 1;
const SILVER = 100 * COPPER;
const GOLD = 100 * SILVER;

// Use builder pattern and classes for potions, items, weapons, and spells

class BaseBuilder {
    data;
    constructor() {
        this.data = {};
    }
    setName(name) {
        this.data.name = name;
        return this;
    }
}

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
    setEffect(effect) {
        this.data.effect = effect;
        return this;
    }
    setCosts(costs) {
        this.data.costs = costs;
        return this;
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
    edibleUses;
    value;
    constructor({
        name,
        description = "",
        throwable = false,
        uses = 1,
        edibleUses = 0,
        value = 0,
    }) {
        this.name = name;
        this.description = description;
        this.throwable = throwable;
        this.uses = uses;
        this.edibleUses = edibleUses;
        this.value = value;
    }
}

class ItemBuilder extends BaseBuilder {
    setDescription(desc) {
        this.data.description = desc;
        return this;
    }
    setThrowable(flag) {
        this.data.throwable = flag;
        return this;
    }
    setUses(uses) {
        this.data.uses = uses;
        return this;
    }
    setEdibleUses(u) {
        this.data.edibleUses = u;
        return this;
    }
    setValue(v) {
        this.data.value = v;
        return this;
    }
    build() {
        return new Item(this.data);
    }
}

class Weapon {
    name;
    general;
    statsByRarity;
    constructor({ name, general = "", statsByRarity = {} }) {
        this.name = name;
        this.general = general;
        this.statsByRarity = statsByRarity;
    }
}

class WeaponBuilder extends BaseBuilder {
    setGeneral(g) {
        this.data.general = g;
        return this;
    }
    setStatsByRarity(s) {
        this.data.statsByRarity = s;
        return this;
    }
    build() {
        return new Weapon(this.data);
    }
}

class Spell {
    name;
    cast;
    effect;
    manaCostByRarity;
    constructor({ name, cast = "", effect = {}, manaCostByRarity = {} }) {
        this.name = name;
        this.cast = cast;
        this.effect = effect;
        this.manaCostByRarity = manaCostByRarity;
    }
}

class SpellBuilder extends BaseBuilder {
    setCast(c) {
        this.data.cast = c;
        return this;
    }
    setEffect(e) {
        this.data.effect = e;
        return this;
    }
    setManaCostByRarity(m) {
        this.data.manaCostByRarity = m;
        return this;
    }
    setParamsByRarity(p) {
        this.data.paramsByRarity = p;
        return this;
    }
    build() {
        // ensure fields exist bcs someone desided to make my life hell by making spells wierd
        if (!this.data.manaCostByRarity) this.data.manaCostByRarity = {};
        if (!this.data.paramsByRarity) this.data.paramsByRarity = {};
        return new Spell(this.data);
    }
}

// Create instances using builders
const potions = [
    new PotionBuilder()
        .setName("Swiftness Potion")
        .setEffect({
            type: "combatTimerPercent",
            valuesByRarity: { common: 10, rare: 20, epic: 35, legendary: 50 },
        })
        .setCosts({
            common: 25 * COPPER,
            rare: 5 * SILVER,
            epic: 35 * SILVER,
            legendary: 75 * SILVER,
        })
        .build(),
    new PotionBuilder()
        .setName("Health Potion")
        .setEffect({
            type: "healthRegenPercent",
            valuesByRarity: { common: 10, rare: 25, epic: 50, legendary: 100 },
        })
        .setCosts({
            common: 10 * COPPER,
            rare: 1 * SILVER,
            epic: 10 * SILVER,
            legendary: 1 * GOLD,
        })
        .build(),
    new PotionBuilder()
        .setName("Mana Potion")
        .setEffect({
            type: "manaRegenPercent",
            valuesByRarity: { common: 10, rare: 25, epic: 50, legendary: 100 },
        })
        .setCosts({
            common: 10 * COPPER,
            rare: 1 * SILVER,
            epic: 10 * SILVER,
            legendary: 1 * GOLD,
        })
        .build(),
    new PotionBuilder()
        .setName("Inf Mana Potion")
        .setEffect({
            type: "infiniteMana",
            valuesByRarity: {
                epic: { durationSeconds: 5 },
                legendary: { durationSeconds: 10 },
            },
        })
        .setCosts({ epic: 3 * GOLD, legendary: 9 * GOLD })
        .build(),
    new PotionBuilder()
        .setName("Shamrock Shake")
        .setEffect({ type: "applyPoison", damagePerSecond: 1 })
        .setCosts({ common: 5 * SILVER })
        .build(),
    new PotionBuilder()
        .setName("Stamina Potion")
        .setEffect({
            type: "staminaRegenPercent",
            valuesByRarity: { common: 15, rare: 30, epic: 50, legendary: 100 },
        })
        .setCosts({
            common: 15 * COPPER,
            rare: 1 * SILVER,
            epic: 10 * SILVER,
            legendary: 1 * GOLD,
        })
        .build(),
    new PotionBuilder()
        .setName("Rock Skin Potion")
        .setEffect({
            type: "physicalDamageBlockPercent",
            valuesByRarity: { common: 10, rare: 20, epic: 35, legendary: 60 },
        })
        .setCosts({
            common: 20 * COPPER,
            rare: 2 * SILVER,
            epic: 20 * SILVER,
            legendary: 2 * GOLD,
        })
        .build(),
    new PotionBuilder()
        .setName("Luck Potion")
        .setEffect({
            type: "battleLuck",
            valuesByRarity: { common: 5, rare: 10, epic: 25, legendary: 100 },
        })
        .setCosts({
            common: 10 * COPPER,
            rare: 1 * SILVER,
            epic: 10 * SILVER,
            legendary: 1 * GOLD,
        })
        .build(),
];

const items = [
    new ItemBuilder()
        .setName("Holy Hand Grenade")
        .setDescription(
            "When activated, must be thrown within 3 seconds before it explodes; deals up to 50 damage and may blind (75% chance, 30s).",
        )
        .setThrowable(true)
        .setUses(1)
        .setValue(5 * GOLD)
        .build(),
    new ItemBuilder()
        .setName("Rock")
        .setDescription("Can be thrown to deal ~5 damage.")
        .setThrowable(true)
        .setUses(1)
        .setValue(2 * COPPER)
        .build(),
    new ItemBuilder()
        .setName("Molotov Cocktail")
        .setDescription(
            "Thrown explosive that applies burning to enemies (8s).",
        )
        .setThrowable(true)
        .setUses(1)
        .setValue(30 * SILVER)
        .build(),
    new ItemBuilder()
        .setName("Old Boot")
        .setDescription("Can be thrown to deal 1 damage.")
        .setThrowable(true)
        .setUses(1)
        .setValue(1 * COPPER)
        .build(),
    new ItemBuilder()
        .setName("Potato")
        .setDescription(
            "Throwable and edible: throw to deal 1 damage or eat for +5 health.",
        )
        .setThrowable(true)
        .setUses(1)
        .setEdibleUses(1)
        .setValue(10 * COPPER)
        .build(),
    new ItemBuilder()
        .setName("Thinkpad X1 Carbon")
        .setDescription(
            "Throwable: deals 5 explosive damage and applies burning for the rest of the battle.",
        )
        .setThrowable(true)
        .setUses(1)
        .setValue(10 * GOLD)
        .build(),
    new ItemBuilder()
        .setName("Sock Puppet")
        .setDescription("Comfort item; edible for small regen (0.1).")
        .setThrowable(false)
        .setUses(1)
        .setValue(10 * COPPER)
        .build(),
    new ItemBuilder()
        .setName("The Last Straw")
        .setDescription(
            "When held, prevents death (leaves you at 1HP) but halves health regen for the battle.",
        )
        .setThrowable(false)
        .setUses(1)
        .setValue(15 * SILVER)
        .build(),
    new ItemBuilder()
        .setName("Napkin")
        .setDescription("When thrown deals brief blindness (70% for 1s).")
        .setThrowable(true)
        .setUses(1)
        .setValue(10 * COPPER)
        .build(),
    new ItemBuilder()
        .setName("Anvil")
        .setDescription("Drop on enemies to deal 20 damage.")
        .setThrowable(true)
        .setUses(3)
        .setValue(50 * SILVER)
        .build(),
];

const weapons = [
    new WeaponBuilder()
        .setName("Basic Sword")
        .setGeneral("Deals 10 damage")
        .setStatsByRarity({
            common: { damage: 10, stamina: 10 },
            rare: { damage: 12, stamina: 10 },
            epic: { damage: 14, stamina: 10 },
            legendary: { damage: 16, stamina: 10 },
        })
        .build(),
    new WeaponBuilder()
        .setName("Basic Dagger")
        .setGeneral("Deals 5 damage")
        .setStatsByRarity({
            common: { damage: 5, stamina: 5 },
            rare: { damage: 7, stamina: 5 },
            epic: { damage: 9, stamina: 5 },
            legendary: { damage: 11, stamina: 5 },
        })
        .build(),
    new WeaponBuilder()
        .setName("Basic Axe")
        .setGeneral("Deals 15 damage")
        .setStatsByRarity({
            common: { damage: 15, stamina: 15 },
            rare: { damage: 17, stamina: 15 },
            epic: { damage: 19, stamina: 15 },
            legendary: { damage: 21, stamina: 15 },
        })
        .build(),
    new WeaponBuilder()
        .setName("Lifesteal Blade")
        .setGeneral("Steals % of opponents life as health")
        .setStatsByRarity({
            common: { stealPercent: 5, stamina: 20 },
            rare: { stealPercent: 10, stamina: 15 },
            epic: { stealPercent: 10, stamina: 10 },
            legendary: { stealPercent: 12, stamina: 8 },
        })
        .build(),
    new WeaponBuilder()
        .setName("Swift Dagger")
        .setGeneral("Fast dagger")
        .setStatsByRarity({
            common: { damage: 7, stamina: 5 },
            rare: { damage: 8, stamina: 4 },
            epic: { damage: 10, stamina: 3 },
            legendary: { damage: 9, stamina: 2 },
        })
        .build(),
    new WeaponBuilder()
        .setName("Fire Axe")
        .setGeneral("Deals damage and applies burning")
        .setStatsByRarity({
            common: { damage: 8, stamina: 10, burnSeconds: 4 },
            rare: { damage: 10, stamina: 10, burnSeconds: 6 },
            epic: { damage: 14, stamina: 15, burnSeconds: 8 },
            legendary: { damage: 18, stamina: 15, burnSeconds: 10 },
        })
        .build(),
];

const spells = [
    new SpellBuilder()
        .setName("Mana Bolt")
        .setCast("battle")
        .setEffect({ type: "directDamage" })
        .setManaCostByRarity({ common: 15, rare: 20, epic: 30, legendary: 50 })
        .build(),
    new SpellBuilder()
        .setName("Black Hole")
        .setCast("battle")
        .setEffect({ type: "areaSuck" })
        .setParamsByRarity({
            epic: { radius: 10, damagePerTick: 15 },
            legendary: { radius: 15, damagePerTick: 20 },
        })
        .setManaCostByRarity({ epic: 40, legendary: 50 })
        .build(),
    new SpellBuilder()
        .setName("Guardian Angel")
        .setCast("anywhere")
        .setEffect({ type: "guidance" })
        .setParamsByRarity({ legendary: { persistent: true } })
        .setManaCostByRarity({ legendary: 100 })
        .build(),
    new SpellBuilder()
        .setName("Magic Missile")
        .setCast("battle/doors")
        .setEffect({ type: "explosive" })
        .setParamsByRarity({
            common: { damage: 18 },
            rare: { damage: 22 },
            epic: { damage: 28 },
            legendary: { damage: 36 },
        })
        .setManaCostByRarity({ common: 12, rare: 22, epic: 30, legendary: 40 })
        .build(),
    new SpellBuilder()
        .setName("Portal")
        .setCast("non-battle")
        .setEffect({ type: "teleport" })
        .setManaCostByRarity({})
        .build(),
    new SpellBuilder()
        .setName("Earthquake")
        .setCast("battle")
        .setEffect({ type: "areaDamage", damage: 15 })
        .setParamsByRarity({
            rare: { durationMinutes: 1 },
            epic: { durationMinutes: 2.5 },
            legendary: { durationMinutes: 5 },
        })
        .setManaCostByRarity({ rare: 25, epic: 40, legendary: 60 })
        .build(),
    new SpellBuilder()
        .setName("Curse of the Plague")
        .setCast("battle")
        .setEffect({ type: "randomEffect" })
        .setParamsByRarity({
            rare: { effectPercent: 10, duration: 30 },
            epic: { effectPercent: 10, duration: 40 },
            legendary: { effectPercent: 15, duration: 50 },
        })
        .setManaCostByRarity({ rare: 30, epic: 40, legendary: 50 })
        .build(),
    new SpellBuilder()
        .setName("Zeus\'s Blessing")
        .setCast("battle")
        .setEffect({ type: "lightningStorm" })
        .setParamsByRarity({
            rare: { targets: "enemies", durationMinutes: 2 },
            epic: { targets: "enemies", durationMinutes: 4 },
            legendary: { targets: "enemies", durationMinutes: 8 },
        })
        .setManaCostByRarity({ rare: 25, epic: 35, legendary: 55 })
        .build(),
    new SpellBuilder()
        .setName("Godlike")
        .setCast("battle")
        .setEffect({ type: "omniBuff" })
        .setParamsByRarity({ legendary: { durationSeconds: 20 } })
        .setManaCostByRarity({ legendary: 80 })
        .build(),
    new SpellBuilder()
        .setName("Bloody Exchange")
        .setCast("battle")
        .setEffect({ type: "healthTrade" })
        .setParamsByRarity({
            rare: { percent: 20 },
            epic: { percent: 50 },
            legendary: { percent: 80 },
        })
        .setManaCostByRarity({ rare: 0, epic: 0, legendary: 0 })
        .build(),
    new SpellBuilder()
        .setName("Blessing of Life")
        .setCast("anywhere")
        .setEffect({ type: "fullRegen" })
        .setParamsByRarity({
            epic: { castTimeSeconds: 90 },
            legendary: { castTimeSeconds: 45 },
        })
        .setManaCostByRarity({ epic: 0, legendary: 0 })
        .build(),
    new SpellBuilder()
        .setName("Fireball")
        .setCast("battle")
        .setEffect({ type: "explosiveWithBurn" })
        .setParamsByRarity({
            common: { damage: 5, burnSeconds: 4 },
            rare: { damage: 8, burnSeconds: 8 },
            epic: { damage: 12, burnSeconds: 10 },
            legendary: { damage: 24, burnSeconds: 15 },
        })
        .setManaCostByRarity({ common: 14, rare: 24, epic: 28, legendary: 32 })
        .build(),
    new SpellBuilder()
        .setName("Raise Dead")
        .setCast("battle")
        .setEffect({ type: "summon" })
        .setParamsByRarity({
            rare: { count: 2 },
            epic: { count: 6 },
            legendary: { count: 8 },
        })
        .setManaCostByRarity({ rare: 30, epic: 45, legendary: 60 })
        .build(),
    new SpellBuilder()
        .setName("Cleanse")
        .setCast("anywhere")
        .setEffect({ type: "clearEffects" })
        .setManaCostByRarity({ legendary: 75 })
        .build(),
];

// Now assemble obtainables using the constructed spell and armor arrays
const obtainables = [
    ...spells,
    ...commonArmor,
    ...rareArmor,
    ...epicArmor,
    ...legendaryArmor,
];

// Now export utility functions and data for other modules or testing
export {
    randInt,
    pickRandomAttributes,
    buildarmorForRarity as getarmorForRarity,
    obtainables,
    potions,
    items,
    weapons,
    spells,
    getSpellEffect,
    BaseBuilder,
};
