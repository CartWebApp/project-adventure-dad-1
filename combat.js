// Local BaseBuilder
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

// Utility functions
function randMinMax(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
}

// Seeder function used to create a unique RNG per enemy instance (Andrew has one that will prob replace this)
function seeding(seed) {
    // Random seeder I found
    let t = seed >>> 0;
    return function() {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function randIntRng(min, max, rng) {
    const mn = Math.ceil(min);
    const mx = Math.floor(max);
    return Math.floor(rng() * (mx - mn + 1)) + mn;
}

function randFloatRng(min, max, rng) {
    return min + rng() * (max - min);
}

// Effects
/**
 * @param {string} spellName
 * @returns {object}
 */

const effects = {
    // Burning: Deals 2 damage every second over x time
    burning: (durationSeconds = 5, damagePerSecond = 2) => ({
        name: "Burning",
        type: "damageOverTime",
        damagePerSecond,
        duration: durationSeconds,
    }),

    // Blindness: Reduces visibility/accuracy by x% over y time.
    blindness: (durationSeconds = 5, accuracyPenaltyPercent = 50) => ({
        name: "Blindness",
        type: "accuracyDebuff",
        accuracyPenaltyPercent,
        duration: durationSeconds,
    }),

    // Withering: Deals 20 damage every 5 seconds over x time.
    withering: (
        durationSeconds = 15,
        damagePerTick = 20,
        tickInterval = 5,
    ) => ({
        name: "Withering",
        type: "damageOverTime",
        damagePerTick,
        tickInterval,
        duration: durationSeconds,
    }),

    // Poison: Deals x damage every second until dead or cured
    poison: (damagePerSecond = 1) => ({
        name: "Poison",
        type: "damageOverTime",
        damagePerSecond,
        duration: Infinity,
        untilCured: true,
    }),

    // Shocked: Can"t use items/spells/attacks for x time
    shocked: (durationSeconds = 3) => ({
        name: "Shocked",
        type: "disable",
        disabled: true,
        duration: durationSeconds,
    }),

    // Petrified: Target is completely immobilized and cannot act for x time; takes +25% damage while petrified
    petrified: (durationSeconds = 4) => ({
        name: "Petrified",
        type: "immobilize",
        immobilized: true,
        duration: durationSeconds,
        damageTakenMultiplier: 1.25,
    }),

    // Rooted: Affected individual always is hit with attacks, deals 1 damage every second over 5 seconds
    rooted: (durationSeconds = 5, damagePerSecond = 1, alwaysHit = true) => ({
        name: "Rooted",
        type: "root",
        alwaysHit,
        damagePerSecond,
        duration: durationSeconds,
    }),

    // Weakness: All attacks deal half damage for x time
    weakness: (durationSeconds = 10, damageMultiplier = 0.5) => ({
        name: "Weakness",
        type: "damageDebuff",
        damageMultiplier,
        duration: durationSeconds,
    }),

    // Iced: Reduces combat timer by x seconds
    iced: (reduceSeconds = 5) => ({
        name: "Iced",
        type: "combatTimer",
        reduceBySeconds: reduceSeconds,
    }),

    // Cursed: Target takes +50% damage and receives reduced healing for x time
    cursed: (
        durationSeconds = 10,
        damageTakenMultiplier = 1.5,
        reducedHealing = true,
    ) => ({
        name: "Cursed",
        type: "damageAmplify",
        damageTakenMultiplier,
        reducedHealing,
        duration: durationSeconds,
    }),
};

// Enemies
// Create base builders and constructors
class Enemy {
    name;
    health;
    healthRegen;
    attackSpeed;
    attack1;
    attack2;
    attack3;
    constructor({name, health = 0, healthRegen = 0, attackSpeed = 0, attack1 = '', attack2 = '', attack3= ''}) {
        this.name = name;
        this.health = health;
        this.healthRegen = healthRegen;
        this.attackSpeed = attackSpeed;
        this.attack1 = attack1;
        this.attack2 = attack2;
        this.attack3 = attack3;
    }
}

class EnemyBuilder extends BaseBuilder {
    static _instanceCounter = 1;
    _healthRange;
    _attackSpeedRange;
    _attackSpeedStrategy;
    _seed;
    constructor() {
        super();
        this._healthRange = null;
        this._attackSpeedRange = null;
        this._attackSpeedStrategy = null; // for behaviours like 'matchPlayer' or 'scalesWithHealth'
        this._seed = Math.floor(Date.now() % 2147483647) ^ Math.floor(Math.random() * 0xffffffff) ^ (EnemyBuilder._instanceCounter++);
    }
    setDescription(desc) {
        this.data.description = desc;
        return this;
    }
    // explicit health (overrides ranges)
    setHealth(h) {
        this.data.health = h;
        return this;
    }
    // set a randomized range for health
    setHealthRange(min, max) {
        this._healthRange = { min, max };
        return this;
    }
    setHealthReg(hr) {
        this.data.healthRegen = hr;
        return this;
    }
    // explicit attack speed
    setAttackSpeed(as) {
        this.data.attackSpeed = as;
        return this;
    }
    // set a randomized range for attack speed
    setAttackSpeedRange(min, max) {
        this._attackSpeedRange = { min, max };
        return this;
    }
    setAttackSpeedStrategy(strategy) {
        this._attackSpeedStrategy = strategy;
        return this;
    }
    setAttack1(a1) {
        this.data.attack1 = a1;
        return this;
    }
    setAttack2(a2) {
        this.data.attack2 = a2;
        return this;
    }
    setAttack3(a3) {
        this.data.attack3 = a3;
        return this;
    }
    // internal: create the RNG for this instance
    _createInstanceRng() {
        return seeding(this._seed);
    }
    build() {
        const rng = this._createInstanceRng();

        let healthVal;
        if (typeof this.data.health === 'number') {
            healthVal = this.data.health;
        } else if (this._healthRange) {
            healthVal = randIntRng(this._healthRange.min, this._healthRange.max, rng);
        } else {
            healthVal = randMinMax(10, 30);
        }

        // compute healthRegen if not explicitly provided
        if (typeof this.data.healthRegen !== 'number') {
            // base factor by health tiers
            let baseFactor;
            if (healthVal > 140) baseFactor = 0.06; // very large enemies regen faster
            else if (healthVal > 80) baseFactor = 0.04; // large
            else if (healthVal > 40) baseFactor = 0.03; // medium
            else baseFactor = 0.02; // small

            // overrides for special cases
            const nameLower = String(this.data.name || '').toLowerCase();
            if (nameLower.includes('troll')) {
                baseFactor = Math.max(baseFactor, 0.08);
            } else if (nameLower.includes('mimic')) {
                baseFactor = Math.max(baseFactor, 0.05);
            } else if (nameLower.includes('plant') || nameLower.includes('slime')) {
                // plant and slime have passive sustain
                baseFactor = Math.max(baseFactor, 0.045);
            } else if (nameLower.includes('beserker')) {
                // beserker becomes more dangerous as health drops; give moderate regen
                baseFactor = Math.max(baseFactor, 0.035);
            }

            // convert to an integer regen value (HP per tick)
            const regenVal = Math.max(1, Math.round(healthVal * baseFactor));
            this.data.healthRegen = regenVal;
        }

        // decide attack speed
        let attackSpeedVal;
        if (typeof this.data.attackSpeed === 'number') {
            attackSpeedVal = this.data.attackSpeed;
        } else if (this._attackSpeedRange) {
            attackSpeedVal = Number(randFloatRng(this._attackSpeedRange.min, this._attackSpeedRange.max, rng).toFixed(2));
        } else if (this._attackSpeedStrategy) {
            attackSpeedVal = this._attackSpeedStrategy; // leave strategy marker for runtime logic
        } else {
            attackSpeedVal = Number(randFloatRng(2.5, 3.5, rng).toFixed(2));
        }

        if (!this.data.attack2) this.data.attack2 = null;
        if (!this.data.attack3) this.data.attack3 = null;

        this.data.rngSeed = this._seed;
        this.data.health = healthVal;
        this.data.attackSpeed = attackSpeedVal;

        return new Enemy(this.data);
    }
}

// create instances using builders
const enemies = [
    new EnemyBuilder()
        .setName("Assassin")
        .setDescription("Deadly killer specializing in quick eliminations")
        .setHealthRange(20, 40)
        .setAttackSpeedRange(1, 1.8)
        .setAttack1("Backstab (Basic damage)")
        .setAttack2("Poison Blade (Poison)")
        .setAttack3("Vanish (becomes untargetable briefly)")
        .build(),

    new EnemyBuilder()
        .setName("Bandit")
        .setDescription("Opportunistic thief who strikes quickly")
        .setHealthRange(41, 80)
        .setAttackSpeedRange(1.8, 2.5)
        .setAttack1("Dagger Slash (Basic damage)")
        .setAttack2("Dirty Trick (Blindness)")
        .setAttack3("Steal (takes money)")
        .build(),

    new EnemyBuilder()
        .setName("Basilisk")
        .setDescription("Mythical serpent whose gaze turns victims to stone")
        .setHealthRange(81, 140)
        .setAttackSpeedRange(3.5, 5)
        .setAttack1("Tail Whip (Basic damage)")
        .setAttack2("Bite (Poison)")
        .setAttack3("Petrifying Gaze (Petrified)")
        .build(),

    new EnemyBuilder()
        .setName("Beserker")
        .setDescription("Frenzied warrior that grows stronger as it fights")
        .setHealthRange(81, 140)
        .setAttackSpeedStrategy("scalesWithHealth")
        .setAttack1("Rage Strike (Damage based on health)")
        .setAttack2("Frenzy (attack speed increases)")
        .setAttack3("Reckless Swing (Player and self damage)")
        .build(),

    new EnemyBuilder()
        .setName("Doppelgänger")
        .setDescription("Mimics the player\’s abilities")
        .setHealthRange(41, 80)
        .setAttackSpeedStrategy("matchPlayer")
        .setAttack1("Mirror Strike (copies last move)")
        .setAttack2("Confuse (Cursed)")
        .build(),

    new EnemyBuilder()
        .setName("Druid")
        .setDescription("Nature mage who controls plants and animals")
        .setHealthRange(41, 80)
        .setAttackSpeedRange(2.5, 3.5)
        .setAttack1("Vine Whip (Basic damage + 10% to apply rooted)")
        .setAttack2("Nature\'s Curse (Cursed)")
        .setAttack3("Vine grasp (Rooted)")
        .build(),

    new EnemyBuilder()
        .setName("Fire Elemental")
        .setDescription("Living flame that scorches everything")
        .setHealthRange(41, 80)
        .setAttackSpeedRange(2.5, 3.5)
        .setAttack1("Fire Slash (Basic attack with 50% to burn)")
        .setAttack2("Ignite (+50% damage next turn)")
        .setAttack3("Frost Burn (Burning + Iced)")
        .build(),

    new EnemyBuilder()
        .setName("Fire Salamander")
        .setDescription("Lava-born lizard immune to heat")
        .setHealthRange(41, 80)
        .setAttackSpeedRange(1.8, 2.5)
        .setAttack1("Flame Bite (Burning)")
        .setAttack2("Lava Spit (Burning)")
        .setAttack3("Heat Shield (reduces damage +10%)")
        .build(),

    new EnemyBuilder()
        .setName("Gargoyle")
        .setDescription("Stone guardian that comes alive")
        .setHealthRange(81, 140)
        .setAttackSpeedRange(3.5, 5)
        .setAttack1("Stone Claw (Basic damage)")
        .setAttack2("Petrify Touch (Petrified)")
        .setAttack3("Harden (reduces damage taken +50%)")
        .build(),

    new EnemyBuilder()
        .setName("Goblin")
        .setDescription("Small, sneaky creature that fights dirty")
        .setHealthRange(20, 40)
        .setAttackSpeedRange(1.8, 2.5)
        .setAttack1("Stab (Basic attack)")
        .setAttack2("Escape (dodges next attack)")
        .setAttack3("Cowardice (+20% dodge chance)")
        .build(),

    new EnemyBuilder()
        .setName("Lightning Elemental")
        .setDescription("Pure electrical energy crackling with power")
        .setHealthRange(41, 80)
        .setAttackSpeedRange(1, 1.8)
        .setAttack1("Lightning Strike (Basic attack, 10% chance to shock)")
        .setAttack2("Static Surge (Shock)")
        .setAttack3("Lightning Dash (Dodge next attack)")
        .build(),

    new EnemyBuilder()
        .setName("Mimic")
        .setDescription("Chest monster that ambushes victims")
        .setHealthRange(81, 140)
        .setAttackSpeedRange(3.5, 5)
        .setAttack1("Bite Trap (Basic Attack)")
        .setAttack2("Slight Heal (+5% health regain)")
        .setAttack3("Close (+100% damage resistance)")
        .build(),

    new EnemyBuilder()
        .setName("Plant monster")
        .setDescription("Living vegetation that traps prey")
        .setHealthRange(81, 140)
        .setAttackSpeedRange(3.5, 5)
        .setAttack1("Vine Grab (Rooted)")
        .setAttack2("Spore Cloud (Blindness)")
        .setAttack3("Drain Life (heals 30% of damage dealt)")
        .build(),

    new EnemyBuilder()
        .setName("Rogue Knight")
        .setDescription("Fallen knight using dishonorable tactics")
        .setHealthRange(81, 140)
        .setAttackSpeedRange(2.5, 3.5)
        .setAttack1("Heavy Slash (Basic damage)")
        .setAttack2("Shield Bash (Stunned)")
        .setAttack3("Dark Resolve (Weakness)")
        .build(),

    new EnemyBuilder()
        .setName("Skeleton")
        .setDescription("Fragile undead warrior")
        .setHealthRange(20, 40)
        .setAttackSpeedRange(2.5, 3.5)
        .setAttack1("Bone Slash (Basic damage)")
        .setAttack2("Cursed Formation (curse)")
        .setAttack3("Reassemble (regenerate)")
        .build(),

    new EnemyBuilder()
        .setName("Slime")
        .setDescription("Gelatinous creature that absorbs attacks")
        .setHealthRange(41, 80)
        .setAttackSpeedRange(3.5, 5)
        .setAttack1("Slam (Basic damage)")
        .setAttack2("Acid Splash (Poison)")
        .setAttack3("Split (duplicates at low health)")
        .build(),

    new EnemyBuilder()
        .setName("Troll")
        .setDescription("Huge brute with regeneration abilities")
        .setHealthRange(141, 220)
        .setAttackSpeedRange(3.5, 5)
        .setAttack1("Club Smash (Basic damage)")
        .setAttack2("Regenerate (heals over time)")
        .setAttack3("Ground Slam (Stunned)")
        .build(),

    new EnemyBuilder()
        .setName("Wicked Mage")
        .setDescription("Corrupt spellcaster using forbidden magic")
        .setHealthRange(20, 40)
        .setAttackSpeedRange(2.5, 3.5)
        .setAttack1("Dark Bolt (Cursed)")
        .setAttack2("Wither Spell (Withering)")
        .setAttack3("Elemental Bolt (Random element)")
        .build(),

    new EnemyBuilder()
        .setName("Wind Elemental")
        .setDescription("A fast-moving spirit of air")
        .setHealthRange(20, 40)
        .setAttackSpeedRange(1, 1.8)
        .setAttack1("Quick Gust (Basic damage)")
        .setAttack2("Wind Dash (+25% dodge chance)")
        .setAttack3("Harsh Winds (-15% accuracy)")
        .build(),

    new EnemyBuilder()
        .setName("Woodland Spider")
        .setDescription("Giant spider lurking in forests")
        .setHealthRange(41, 80)
        .setAttackSpeedRange(2.5, 3.5)
        .setAttack1("Bite (Poison)")
        .setAttack2("Web Shot (Rooted)")
        .setAttack3("Skitter (speed boost)")
        .build(),

    new EnemyBuilder()
        .setName("Zombie")
        .setDescription("Slow undead warrior")
        .setHealthRange(81, 140)
        .setAttackSpeedRange(3.5, 5)
        .setAttack1("Slash (Basic damage)")
        .setAttack2("Rotting Bite (Poison)")
        .setAttack3("Insidious Strike (Weakness)")
        .build(),
];

export {
    effects,
    enemies,
};