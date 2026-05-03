// @ts-check
/** @import { EnemyBuilderData } from './types.js' */
/// <reference lib="es2023" />
/**
 * @template {Record<string, unknown>} T
 * @template V
 * @typedef {{ [K in (keyof T & string) as `with_${K}`]: (value: T[K]) => Builder<T, V> } & { data: T; build(): V }} Builder<T, V>
 */
/**
 * @template {Record<string, unknown>} T
 * @template V
 * @param {(data: Partial<T>) => V} builder
 * @param {Array<(keyof T & string)>} keys
 * @returns {Builder<T, V>}
 */
function create_builder(builder, ...keys) {
    /** @type {{ [K in keyof T]?: T[K] }} */
    const data = {};
    const proxy = new Proxy(
        {},
        {
            get(fallback, property) {
                if (property === 'data') {
                    return data;
                }
                if (property === 'build') {
                    return () => builder(data);
                }
                if (
                    typeof property !== 'string' ||
                    !keys.some(key => property === `with_${key}`)
                ) {
                    return Object.hasOwn(fallback, property)
                        ? fallback[
                              /** @type {keyof typeof fallback} */ (property)
                          ]
                        : undefined;
                }
                /**
                 * @param {T[keyof T]} value
                 */
                return value => {
                    // @ts-expect-error
                    data[property.slice(5)] = value;
                    return proxy;
                };
            },
            ownKeys() {
                return [...keys.map(key => `with_${key}`), 'build'];
            }
        }
    );
    return /** @type {Builder<T, V>} */ (proxy);
}

/**
 * @template {Record<string, unknown>} T
 * @param {Array<keyof T & string>} keys
 */
export const BaseBuilder =
    /** @type {new <T extends Record<string, unknown>, V>(builder: (data: T) => V, ...keys: Array<keyof T & string>) => Builder<T, V>} */ (
        /** @type {unknown} */ (
            /**
             * @param {(data: Record<string, any>) => any} builder
             * @param {string[]} keys
             */
            function BaseBuilder(builder, ...keys) {
                return create_builder(builder, ...keys);
            }
        )
    );

// Utility functions
/**
 * @param {number} min
 * @param {number} max
 */
function randMinMax(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
}

// Seeder function used to create a unique RNG per enemy instance (Andrew has one that will prob replace this)
/**
 * @param {number} seed
 * @returns {() => number}
 */
function mulberry32(seed) {
    // Random seeder I found
    let t = seed >>> 0;
    return function () {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * @param {number} min
 * @param {number} max
 * @param {() => number} rng
 */
function randIntRng(min, max, rng) {
    const mn = Math.ceil(min);
    const mx = Math.floor(max);
    return Math.floor(rng() * (mx - mn + 1)) + mn;
}

/**
 * @param {number} min
 * @param {number} max
 * @param {() => number} rng
 */
function randFloatRng(min, max, rng) {
    return min + rng() * (max - min);
}

// Effects
/**
 * @param {string} spellName
 * @returns {object}
 */
const TICKS_PER_SEC = 60;

const effects = {
    // Burning: Deals damagePerTick each tick over duration (ticks)
    // Defaults keep previous semantics (5s @ 2 DPS => duration=5*TICKS_PER_SEC, damagePerTick=2/TICKS_PER_SEC)
    burning: (
        durationTicks = 5 * TICKS_PER_SEC,
        damagePerTick = 2 / TICKS_PER_SEC // default 2 DPS converted to per-tick
    ) => ({
        name: 'Burning',
        type: 'damageOverTime',
        damagePerTick,
        duration: durationTicks
    }),

    // Blindness: Reduces visibility/accuracy by x% over y time (duration in ticks)
    blindness: (
        durationTicks = 5 * TICKS_PER_SEC,
        accuracyPenaltyPercent = 50
    ) => ({
        name: 'Blindness',
        type: 'accuracyDebuff',
        accuracyPenaltyPercent,
        duration: durationTicks
    }),

    // Withering: Deals damagePerTick every tickInterval (in ticks) over duration (in ticks)
    withering: (
        durationTicks = 15 * TICKS_PER_SEC,
        // damagePerTick represents the damage applied every tickIntervalTicks
        damagePerTick = 20,
        tickIntervalTicks = 5 * TICKS_PER_SEC
    ) => ({
        name: 'Withering',
        type: 'damageOverTime',
        damagePerTick,
        tickInterval: tickIntervalTicks,
        duration: durationTicks
    }),

    // Poison: Deals damagePerTick each tick until cured
    poison: (damagePerTick = 1 / TICKS_PER_SEC) => ({
        name: 'Poison',
        type: 'damageOverTime',
        damagePerTick,
        duration: Infinity,
        untilCured: true
    }),

    // Shocked: Can't use items/spells/attacks for x ticks
    shocked: (durationTicks = 3 * TICKS_PER_SEC) => ({
        name: 'Shocked',
        type: 'disable',
        disabled: true,
        duration: durationTicks
    }),

    // Petrified: Target is completely immobilized and cannot act for x time; takes +25% damage while petrified
    petrified: (durationTicks = 4 * TICKS_PER_SEC) => ({
        name: 'Petrified',
        type: 'immobilize',
        immobilized: true,
        duration: durationTicks,
        damageTakenMultiplier: 1.25
    }),

    // Rooted: Affected individual always is hit with attacks, deals 1 damage every second over 5 seconds
    rooted: (
        durationTicks = 5 * TICKS_PER_SEC,
        damagePerTick = 1 / TICKS_PER_SEC,
        alwaysHit = true
    ) => ({
        name: 'Rooted',
        type: 'root',
        alwaysHit,
        damagePerTick,
        duration: durationTicks
    }),

    // Weakness: All attacks deal half damage for x time
    weakness: (durationTicks = 10 * TICKS_PER_SEC, damageMultiplier = 0.5) => ({
        name: 'Weakness',
        type: 'damageDebuff',
        damageMultiplier,
        duration: durationTicks
    }),

    // Iced: Reduces combat timer by x ticks
    iced: (reduceTicks = 5 * TICKS_PER_SEC) => ({
        name: 'Iced',
        type: 'combatTimer',
        reduceByTicks: reduceTicks
    }),

    // Cursed: Target takes +50% damage and receives reduced healing for x time
    cursed: (
        durationTicks = 10 * TICKS_PER_SEC,
        damageTakenMultiplier = 1.5,
        reducedHealing = true
    ) => ({
        name: 'Cursed',
        type: 'damageAmplify',
        damageTakenMultiplier,
        reducedHealing,
        duration: durationTicks
    })
};

// Enemies
// Create base builders and constructors
export class Entity {
    /** @type {string} */
    name = '';
    /** @type {number} */
    health = 0;
}

export class Enemy extends Entity {
    name;
    health;
    health_regen;
    attack_speed;
    primary_attack;
    secondary_attack;
    tertiary_attack;
    /**
     * @param {EnemyBuilderData} param
     */
    constructor({
        name,
        health = 0,
        health_regen = 0,
        attack_speed = 0,
        primary_attack = '',
        secondary_attack = '',
        tertiary_attack = ''
    }) {
        super();
        this.name = name;
        this.health = health;
        this.health_regen = health_regen;
        this.attack_speed = attack_speed;
        this.primary_attack = primary_attack;
        this.secondary_attack = secondary_attack;
        this.tertiary_attack = tertiary_attack;
    }
}

class EnemyBuilder
    extends /** @type {new (builder: (arg: any) => any, ...keys: string[]) => Builder<EnemyBuilderData, Enemy>} */ (
        BaseBuilder
    )
{
    static _instanceCounter = 1;
    /**
     * @param {EnemyBuilderData} data
     */
    static #builder(data) {
        const rng = mulberry32(data.seed);

        let healthVal;
        if (typeof data.health === 'number') {
            healthVal = data.health;
        } else if (data.health_range !== undefined) {
            healthVal = randIntRng(...data.health_range, rng);
        } else {
            healthVal = randMinMax(10, 30);
        }

        // compute healthRegen if not explicitly provided
        if (typeof data.health_regen !== 'number') {
            // base factor by health tiers
            let baseFactor;
            if (healthVal > 140)
                baseFactor = 0.06; // very large enemies regen faster
            else if (healthVal > 80)
                baseFactor = 0.04; // large
            else if (healthVal > 40)
                baseFactor = 0.03; // medium
            else baseFactor = 0.02; // small

            // overrides for special cases
            const nameLower = String(data.name || '').toLowerCase();
            if (nameLower.includes('troll')) {
                baseFactor = Math.max(baseFactor, 0.08);
            } else if (nameLower.includes('mimic')) {
                baseFactor = Math.max(baseFactor, 0.05);
            } else if (
                nameLower.includes('plant') ||
                nameLower.includes('slime')
            ) {
                // plant and slime have passive sustain
                baseFactor = Math.max(baseFactor, 0.045);
            } else if (nameLower.includes('beserker')) {
                // beserker becomes more dangerous as health drops; give moderate regen
                baseFactor = Math.max(baseFactor, 0.035);
            }

            // convert to an integer regen value (HP per tick)
            const regenVal = Math.max(1, Math.round(healthVal * baseFactor));
            data.health_regen = regenVal;
        }

        // decide attack speed
        let attackSpeedVal;
        if (typeof data.attack_speed === 'number') {
            attackSpeedVal = data.attack_speed;
        } else if (data.attack_speed_range !== undefined) {
            attackSpeedVal = Number(
                randFloatRng(...data.attack_speed_range, rng).toFixed(2)
            );
        } else if (data.attack_speed_strategy !== undefined) {
            attackSpeedVal = data.attack_speed_strategy; // leave strategy marker for runtime logic
        } else {
            attackSpeedVal = Number(randFloatRng(2.5, 3.5, rng).toFixed(2));
        }

        if (data.secondary_attack === undefined) data.secondary_attack = null;
        if (data.tertiary_attack === undefined) data.tertiary_attack = null;

        data.health = healthVal;
        if (typeof attackSpeedVal === 'number') {
            data.attack_speed = attackSpeedVal;
        }
        return new Enemy(data);
    }
    constructor() {
        super(
            data => EnemyBuilder.#builder(data),
            'name',
            'description',
            'health',
            'health_range',
            'health_regen',
            'attack_speed',
            'attack_speed_range',
            'attack_speed_strategy',
            'primary_attack',
            'secondary_attack',
            'tertiary_attack'
        );
        this.data.seed =
            Math.floor(Date.now() % 2147483647) ^
            Math.floor(Math.random() * 0xffffffff) ^
            EnemyBuilder._instanceCounter++;
    }
}

// create instances using builders
const enemies = [
    new EnemyBuilder()
        .with_name('Assassin')
        .with_description('Deadly killer specializing in quick eliminations')
        .with_health_range([20, 40])
        .with_attack_speed_range([1, 1.8])
        .with_primary_attack('Backstab (Basic damage)')
        .with_secondary_attack('Poison Blade (Poison)')
        .with_tertiary_attack('Vanish (becomes untargetable briefly)')
        .build(),

    new EnemyBuilder()
        .with_name('Bandit')
        .with_description('Opportunistic thief who strikes quickly')
        .with_health_range([41, 80])
        .with_attack_speed_range([1.8, 2.5])
        .with_primary_attack('Dagger Slash (Basic damage)')
        .with_secondary_attack('Dirty Trick (Blindness)')
        .with_tertiary_attack('Steal (takes money)')
        .build(),

    new EnemyBuilder()
        .with_name('Basilisk')
        .with_description('Mythical serpent whose gaze turns victims to stone')
        .with_health_range([81, 140])
        .with_attack_speed_range([3.5, 5])
        .with_primary_attack('Tail Whip (Basic damage)')
        .with_secondary_attack('Bite (Poison)')
        .with_tertiary_attack('Petrifying Gaze (Petrified)')
        .build(),

    new EnemyBuilder()
        .with_name('Beserker')
        .with_description('Frenzied warrior that grows stronger as it fights')
        .with_health_range([81, 140])
        .with_attack_speed_strategy('scalesWithHealth')
        .with_primary_attack('Rage Strike (Damage based on health)')
        .with_secondary_attack('Frenzy (attack speed increases)')
        .with_tertiary_attack('Reckless Swing (Player and self damage)')
        .build(),

    new EnemyBuilder()
        .with_name('Doppelgänger')
        .with_description('Mimics the player’s abilities')
        .with_health_range([41, 80])
        .with_attack_speed_strategy('matchPlayer')
        .with_primary_attack('Mirror Strike (copies last move)')
        .with_secondary_attack('Confuse (Cursed)')
        .build(),

    new EnemyBuilder()
        .with_name('Druid')
        .with_description('Nature mage who controls plants and animals')
        .with_health_range([41, 80])
        .with_attack_speed_range([2.5, 3.5])
        .with_primary_attack('Vine Whip (Basic damage + 10% to apply rooted)')
        .with_secondary_attack("Nature's Curse (Cursed)")
        .with_tertiary_attack('Vine grasp (Rooted)')
        .build(),

    new EnemyBuilder()
        .with_name('Fire Elemental')
        .with_description('Living flame that scorches everything')
        .with_health_range([41, 80])
        .with_attack_speed_range([2.5, 3.5])
        .with_primary_attack('Fire Slash (Basic attack with 50% to burn)')
        .with_secondary_attack('Ignite (+50% damage next turn)')
        .with_tertiary_attack('Frost Burn (Burning + Iced)')
        .build(),

    new EnemyBuilder()
        .with_name('Fire Salamander')
        .with_description('Lava-born lizard immune to heat')
        .with_health_range([41, 80])
        .with_attack_speed_range([1.8, 2.5])
        .with_primary_attack('Flame Bite (Burning)')
        .with_secondary_attack('Lava Spit (Burning)')
        .with_tertiary_attack('Heat Shield (reduces damage +10%)')
        .build(),

    new EnemyBuilder()
        .with_name('Gargoyle')
        .with_description('Stone guardian that comes alive')
        .with_health_range([81, 140])
        .with_attack_speed_range([3.5, 5])
        .with_primary_attack('Stone Claw (Basic damage)')
        .with_secondary_attack('Petrify Touch (Petrified)')
        .with_tertiary_attack('Harden (reduces damage taken +50%)')
        .build(),

    new EnemyBuilder()
        .with_name('Goblin')
        .with_description('Small, sneaky creature that fights dirty')
        .with_health_range([20, 40])
        .with_attack_speed_range([1.8, 2.5])
        .with_primary_attack('Stab (Basic attack)')
        .with_secondary_attack('Escape (dodges next attack)')
        .with_tertiary_attack('Cowardice (+20% dodge chance)')
        .build(),

    new EnemyBuilder()
        .with_name('Lightning Elemental')
        .with_description('Pure electrical energy crackling with power')
        .with_health_range([41, 80])
        .with_attack_speed_range([1, 1.8])
        .with_primary_attack(
            'Lightning Strike (Basic attack, 10% chance to shock)'
        )
        .with_secondary_attack('Static Surge (Shock)')
        .with_tertiary_attack('Lightning Dash (Dodge next attack)')
        .build(),

    new EnemyBuilder()
        .with_name('Mimic')
        .with_description('Chest monster that ambushes victims')
        .with_health_range([81, 140])
        .with_attack_speed_range([3.5, 5])
        .with_primary_attack('Bite Trap (Basic Attack)')
        .with_secondary_attack('Slight Heal (+5% health regain)')
        .with_tertiary_attack('Close (+100% damage resistance)')
        .build(),

    new EnemyBuilder()
        .with_name('Plant Monster')
        .with_description('Living vegetation that traps prey')
        .with_health_range([81, 140])
        .with_attack_speed_range([3.5, 5])
        .with_primary_attack('Vine Grab (Rooted)')
        .with_secondary_attack('Spore Cloud (Blindness)')
        .with_tertiary_attack('Drain Life (heals 30% of damage dealt)')
        .build(),

    new EnemyBuilder()
        .with_name('Rogue Knight')
        .with_description('Fallen knight using dishonorable tactics')
        .with_health_range([81, 140])
        .with_attack_speed_range([2.5, 3.5])
        .with_primary_attack('Heavy Slash (Basic damage)')
        .with_secondary_attack('Shield Bash (Stunned)')
        .with_tertiary_attack('Dark Resolve (Weakness)')
        .build(),

    new EnemyBuilder()
        .with_name('Skeleton')
        .with_description('Fragile undead warrior')
        .with_health_range([20, 40])
        .with_attack_speed_range([2.5, 3.5])
        .with_primary_attack('Bone Slash (Basic damage)')
        .with_secondary_attack('Cursed Formation (curse)')
        .with_tertiary_attack('Reassemble (regenerate)')
        .build(),

    new EnemyBuilder()
        .with_name('Slime')
        .with_description('Gelatinous creature that absorbs attacks')
        .with_health_range([41, 80])
        .with_attack_speed_range([3.5, 5])
        .with_primary_attack('Slam (Basic damage)')
        .with_secondary_attack('Acid Splash (Poison)')
        .with_tertiary_attack('Split (duplicates at low health)')
        .build(),

    new EnemyBuilder()
        .with_name('Troll')
        .with_description('Huge brute with regeneration abilities')
        .with_health_range([141, 220])
        .with_attack_speed_range([3.5, 5])
        .with_primary_attack('Club Smash (Basic damage)')
        .with_secondary_attack('Regenerate (heals over time)')
        .with_tertiary_attack('Ground Slam (Stunned)')
        .build(),

    new EnemyBuilder()
        .with_name('Wicked Mage')
        .with_description('Corrupt spellcaster using forbidden magic')
        .with_health_range([20, 40])
        .with_attack_speed_range([2.5, 3.5])
        .with_primary_attack('Dark Bolt (Cursed)')
        .with_secondary_attack('Wither Spell (Withering)')
        .with_tertiary_attack('Elemental Bolt (Random element)')
        .build(),

    new EnemyBuilder()
        .with_name('Wind Elemental')
        .with_description('A fast-moving spirit of air')
        .with_health_range([20, 40])
        .with_attack_speed_range([1, 1.8])
        .with_primary_attack('Quick Gust (Basic damage)')
        .with_secondary_attack('Wind Dash (+25% dodge chance)')
        .with_tertiary_attack('Harsh Winds (-15% accuracy)')
        .build(),

    new EnemyBuilder()
        .with_name('Woodland Spider')
        .with_description('Giant spider lurking in forests')
        .with_health_range([41, 80])
        .with_attack_speed_range([2.5, 3.5])
        .with_primary_attack('Bite (Poison)')
        .with_secondary_attack('Web Shot (Rooted)')
        .with_tertiary_attack('Skitter (speed boost)')
        .build(),

    new EnemyBuilder()
        .with_name('Zombie')
        .with_description('Slow undead warrior')
        .with_health_range([81, 140])
        .with_attack_speed_range([3.5, 5])
        .with_primary_attack('Slash (Basic damage)')
        .with_secondary_attack('Rotting Bite (Poison)')
        .with_tertiary_attack('Insidious Strike (Weakness)')
        .build()
];

export { effects, enemies, TICKS_PER_SEC };
