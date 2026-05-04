// @ts-check
/** @import { Effect } from './types.js' */
import {
    BaseBuilder,
    enemies as ENEMY_POOL,
    effects as COMBAT_EFFECTS,
    Enemy
} from './combat.js';
import { spells as SPELL_DEFINITIONS } from './obtainables.js';
import { Player } from './character.js';
import { TICKS_PER_SEC } from './combat.js';
import { clear, dialog, input, select } from './ui.js';
import { Game } from './game.js';
import { asset, sleep } from './utils.js';
import { BattleGround, Image } from './objects.js';
import { RaytracingRenderer } from './raytracing.js';

/** @type {{EASY:'easy', MEDIUM:'medium', HARD:'hard'}} */
const DIFFICULTY = {
    EASY: 'easy',
    MEDIUM: 'medium',
    HARD: 'hard'
};

/**
 * @param {any} enemy
 */
function cloneEnemy(enemy) {
    return Object.assign(
        Object.create(Object.getPrototypeOf(enemy)),
        structuredClone(enemy)
    );
}

/**
 * @param {'easy'|'medium'|'hard'} difficulty
 * @returns {Array<Enemy>}
 */
function pickEnemiesForDifficulty(difficulty) {
    // categorize pool by health tiers (small/medium/large)
    const small = ENEMY_POOL.filter(e => e.health <= 40);
    const medium = ENEMY_POOL.filter(e => e.health > 40 && e.health <= 100);
    const large = ENEMY_POOL.filter(e => e.health > 100);

    const out = [];
    if (difficulty === DIFFICULTY.EASY) {
        // EASY: 1-2 small enemies
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++)
            out.push(
                cloneEnemy(small[Math.floor(Math.random() * small.length)])
            );
    } else if (difficulty === DIFFICULTY.MEDIUM) {
        // MEDIUM: 2-3 mixed
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            const pool = Math.random() < 0.6 ? medium : small;
            out.push(cloneEnemy(pool[Math.floor(Math.random() * pool.length)]));
        }
    } else {
        // HARD: 3-4 medium/large
        const count = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            const pool = Math.random() < 0.6 ? large.concat(medium) : medium;
            out.push(cloneEnemy(pool[Math.floor(Math.random() * pool.length)]));
        }
    }
    // ensure each enemy has runtime fields
    return out.map(e => {
        e.health = e.health;
        e.effects = []; // active
        e._tickCounter = 0;
        return e;
    });
}

/**
 * Damage calculation
 * @param {Player | Enemy} _attacker
 * @param {{health:number, damage_reduction?:number, block_chance?:number}} defender
 * @param {number} baseDamage
 */
function calculateDamage(_attacker, defender, baseDamage) {
    // block chance
    const block =
        (defender.block_chance || 0) > 0 &&
        Math.random() * 100 < (defender.block_chance || 0);
    if (block) return { final: 0, blocked: true };

    // damage reduction percent (flat percent)
    const dr = defender.damage_reduction || 0;
    const afterDR = Math.max(0, baseDamage * (1 - dr / 100));

    // clamp to at least 1 if baseDamage > 0
    const final = baseDamage > 0 ? Math.max(1, Math.round(afterDR)) : 0;
    return { final, blocked: false };
}

/**
 * @param {{health:number, max_life?:number, extra_lives?:number}} target
 * @param {number} dmg
 */
function applyDamage(target, dmg) {
    if (dmg <= 0) return;
    target.health = Math.max(0, target.health - dmg);
}

/**
 * @param {Player | Enemy} target
 * @param {Effect} effect
 */
function applyEffect(target, effect) {
    // copy effect with runtime fields
    const { ...e } = effect;
    e.remaining =
        effect.duration === Infinity ? Infinity : Math.max(0, effect.duration);
    target.effects = target.effects || [];
    target.effects.push(e);
}

/**
 * Process active effects for one tick (1 second)
 * @param {Player | Enemy} actor
 */
async function processEffects(actor) {
    if (!actor.effects || actor.effects.length === 0) return;
    const remaining = [];
    for (const e of actor.effects) {
        if (e.type === 'damageOverTime') {
            // prefer damagePerTick; if damagePerSecond present convert to per-tick
            const perTick =
                e.damagePerTick ??
                (typeof e.damagePerSecond === 'number'
                    ? e.damagePerSecond / TICKS_PER_SEC
                    : 0);
            // support fractional damage accumulation per actor
            actor._dot_acc = actor._dot_acc || 0;
            actor._dot_acc += perTick;
            const apply = Math.floor(actor._dot_acc);
            if (apply > 0) {
                await dialog(
                    `${actor.name || 'Player'} takes ${apply} ${e.name} damage.`
                );
                applyDamage(actor, apply);
                actor._dot_acc -= apply;
            }
        }
        // reduce duration (if not infinite)
        if (e.remaining !== Infinity) {
            e.remaining -= 1; // one tick
            if (e.remaining > 0) remaining.push(e);
        } else {
            remaining.push(e);
        }
    }
    actor.effects = remaining;
}

/**
 * Simple enemy AI
 * @param {Enemy} enemy
 * @param {Player} player
 */
async function enemyAct(enemy, player) {
    // skip dead
    if (enemy.health <= 0) return;

    // choose attack by weight
    const r = Math.random();
    let chosen = enemy.primary_attack;
    if (enemy.secondary_attack && r > 0.7) chosen = enemy.secondary_attack;
    if (enemy.tertiary_attack && r > 0.9) chosen = enemy.tertiary_attack;

    // parse simple attack descriptors
    const name = String(chosen || '').toLowerCase();
    if (name.includes('poison')) {
        await dialog(`${enemy.name} uses ${chosen} — applied Poison.`);
        applyEffect(player, COMBAT_EFFECTS.poison(1));
    } else if (name.includes('burn')) {
        await dialog(`${enemy.name} uses ${chosen} — applied Burning.`);
        applyEffect(player, COMBAT_EFFECTS.burning(5, 2));
    } else if (name.includes('petrif') || name.includes('petrified')) {
        await dialog(`${enemy.name} uses ${chosen} — applied Petrified.`);
        applyEffect(player, COMBAT_EFFECTS.petrified(3));
    } else if (name.includes('stun') || name.includes('shocked')) {
        await dialog(`${enemy.name} uses ${chosen} — applied Shocked.`);
        applyEffect(player, COMBAT_EFFECTS.shocked(2));
    } else {
        // default: basic damage
        const base = Math.max(3, Math.round(enemy.health * 0.03));
        const { final } = calculateDamage(enemy, player, base);
        await dialog(`${enemy.name} hits for ${final} damage.`);
        applyDamage(player, final);
    }
}

/**
 * Player actions
 * - melee: consumes stamina, deals damage
 * - castSpell: consumes mana, applies effect or damage
 */

/**
 * Player melee attack
 * @param {Player} player
 * @param {Enemy} enemy
 */
async function playerMelee(player, enemy) {
    // Determine stamina cost from equipped weapon (by rarity) or default
    /** @type {any} */
    const weapon = player.equipped?.weapon;

    /** @param {any} w */
    const resolveWeaponRarity = w => {
        if (!w) return 'common';
        return w.rarity || w.rarity_name || w.tier || 'common';
    };

    const wRarity = resolveWeaponRarity(weapon);
    const staminaCost =
        weapon?.stats_by_rarity?.[wRarity]?.stamina ??
        weapon?.stats_by_rarity?.common?.stamina ??
        10;

    if (player.stamina < staminaCost) {
        // weak attack
        const base = 3;
        const { final } = calculateDamage(player, enemy, base);
        applyDamage(enemy, final);
        await dialog(`Weak strike deals ${final} damage (low stamina).`);
        return;
    }
    player.stamina -= staminaCost;
    const weaponDamage =
        weapon?.stats_by_rarity?.[wRarity]?.damage ??
        weapon?.stats_by_rarity?.common?.damage ??
        10;
    const base = Math.round(weaponDamage + player.luck * 0.01 * weaponDamage);
    const { final } = calculateDamage(player, enemy, base);
    applyDamage(enemy, final);
    await dialog(`You strike ${enemy.name} for ${final} damage.`);
}

/**
 * Player cast spell (basic)
 * @param {Player} player
 * @param {Enemy | null} enemy - primary target (may be null for AoE spells)
 * @param {Array<Enemy>} enemies - full enemies array for AoE spells
 * @param {string} spellName
 */
async function playerCast(player, enemy, enemies, spellName) {
    const name = String(spellName || '').toLowerCase();

    /** @param {string} n */
    const getSpellDef = n =>
        SPELL_DEFINITIONS.find(s => String(s.name || '').toLowerCase() === n) ||
        null;

    /**
     * @param {{spells?: any[]}} pl
     * @param {string} n
     * @returns {string}
     */
    const getPlayerSpellRarity = (pl, n) => {
        if (!pl || !Array.isArray(pl.spells)) return 'common';
        let found = null;
        for (const s of pl.spells) {
            if (String(s?.name || s).toLowerCase() === n) {
                found = s;
                break;
            }
        }
        if (!found) return 'common';
        // allow either simple { name, rarity } or full Spell object with rarity
        return found.rarity || found.rarity_name || found.tier || 'common';
    };

    /** @param {any} def @param {any} pl */
    const resolveManaCost = (def, pl) => {
        if (!def) return 0;
        const rarity = getPlayerSpellRarity(pl, name) || 'common';
        return (
            def.mana_cost_by_rarity?.[rarity] ??
            def.mana_cost_by_rarity?.common ??
            0
        );
    };

    /** @param {any} def @param {any} pl @param {string} paramName @param {any} fallback */
    const resolveParam = (def, pl, paramName, fallback) => {
        if (!def) return fallback;
        const rarity = getPlayerSpellRarity(pl, name) || 'common';

        /** @param {string} key */
        const tryLookup = key =>
            def.params_by_rarity?.[rarity]?.[key] ??
            def.params_by_rarity?.common?.[key];

        // candidate keys: original, seconds->Ticks, minutes->Ticks, seconds->seconds (lower), ticks
        const candidates = [
            paramName,
            paramName.replace(/Seconds$/i, 'Ticks'),
            paramName.replace(/Minutes$/i, 'Ticks'),
            paramName.replace(/seconds$/i, 'Ticks'),
            paramName.replace(/minutes$/i, 'Ticks'),
            paramName.replace(/Ticks$/i, 'Ticks')
        ];

        let raw;
        for (const c of candidates) {
            raw = tryLookup(c);
            if (raw !== undefined) break;
        }
        if (raw === undefined) return fallback;

        // If the value is already tick-based (key contains 'tick' or 'Ticks'), return as-is
        const keyLower = paramName.toLowerCase();
        if (typeof raw === 'number') {
            if (keyLower.includes('ticks') || keyLower.includes('tick'))
                return raw;
            if (keyLower.includes('seconds'))
                return Math.round(raw * TICKS_PER_SEC);
            if (keyLower.includes('minutes'))
                return Math.round(raw * 60 * TICKS_PER_SEC);
            if (
                keyLower.includes('damagepersecond') ||
                keyLower.includes('dps')
            )
                return raw / TICKS_PER_SEC;
        }
        return raw;
    };

    // helpers
    const aliveEnemies = (enemies || []).filter(e => e.health > 0);
    /** @type {any} */
    const p = player;
    /** @param {number} cost */
    const spendMana = async cost => {
        if ((player.mana || 0) < cost) {
            await dialog('Not enough mana.');
            return false;
        }
        player.mana -= cost;
        return true;
    };

    /**
     * @param {Player | Enemy} target
     * @param {number} base
     */
    const hitSingle = (target, base) => {
        if (!target || target.health <= 0) return 0;
        const { final } = calculateDamage(player, target, base);
        applyDamage(target, final);
        return final;
    };

    // Spell handlers
    /** @type {Record<string, () => Promise<void>>} */
    const handlers = {
        fireball: async () => {
            const def = getSpellDef('fireball');
            const cost = resolveManaCost(def, p) || 14;
            if (!(await spendMana(cost))) return;
            const dmg =
                resolveParam(def, p, 'damage', 5) +
                Math.floor(player.luck * 0.02 * 8);
            const burnTicks = resolveParam(
                def,
                p,
                'burnTicks',
                4 * TICKS_PER_SEC
            );
            const burnPerTick = resolveParam(
                def,
                p,
                'damagePerTick',
                2 / TICKS_PER_SEC
            );
            const dealt = hitSingle(enemy, dmg);
            applyEffect(enemy, COMBAT_EFFECTS.burning(burnTicks, burnPerTick));
            const burnSecsHuman = Math.round(burnTicks / TICKS_PER_SEC);
            await dialog(
                `${spellName} hits ${enemy.name} for ${dealt} and applies Burning (${burnSecsHuman}s).`
            );
        },

        'mana bolt': async () => {
            const def = getSpellDef('mana bolt');
            const cost = resolveManaCost(def, p) || 15;
            if (!(await spendMana(cost))) return;
            const dmg =
                resolveParam(def, p, 'damage', 15) +
                Math.floor(player.luck * 0.01 * 15);
            const dealt = hitSingle(enemy, dmg);
            await dialog(`${spellName} deals ${dealt} damage.`);
        },

        'magic missile': async () => {
            const def = getSpellDef('magic missile');
            const cost = resolveManaCost(def, p) || 12;
            if (!(await spendMana(cost))) return;
            const damage = resolveParam(def, p, 'damage', 18);
            const primary = hitSingle(enemy, damage);
            let splashTotal = 0;
            for (const e of aliveEnemies) {
                if (e === enemy) continue;
                const s = Math.max(1, Math.round(primary * 0.25));
                applyDamage(e, s);
                splashTotal += s;
            }
            await dialog(
                `${spellName} hits ${enemy.name} for ${primary} (+${splashTotal} splash).`
            );
        },

        'black hole': async () => {
            const def = getSpellDef('black hole');
            const cost = resolveManaCost(def, p) || 40;
            if (!(await spendMana(cost))) return;
            const radius = resolveParam(def, p, 'radius', 10);
            const damagePerTick = resolveParam(def, p, 'damagePerTick', 15);
            const durationTicks = resolveParam(
                def,
                p,
                'durationTicks',
                5 * TICKS_PER_SEC
            );
            let total = 0;
            for (const e of aliveEnemies) {
                // For simplicity assume all enemies are within radius
                applyEffect(e, {
                    name: 'Black Hole',
                    type: 'damageOverTime',
                    damagePerTick,
                    duration: durationTicks
                });
                total += Math.round(damagePerTick * durationTicks);
            }
            const durationSecsHuman = Math.round(durationTicks / TICKS_PER_SEC);
            await dialog(
                `${spellName} creates a black hole (r=${radius}) dealing ${damagePerTick}/tick for ${durationSecsHuman}s to nearby enemies.`
            );
        },

        earthquake: async () => {
            const def = getSpellDef('earthquake');
            const cost = resolveManaCost(def, p) || 25;
            if (!(await spendMana(cost))) return;
            const durationTicks = resolveParam(
                def,
                p,
                'durationTicks',
                1 * 60 * 60
            );
            const perTick = 15; // instant per-tick damage applied once here as well
            let total = 0;
            for (const e of aliveEnemies) {
                const { final } = calculateDamage(player, e, perTick);
                applyDamage(e, final);
                // withering: damagePerTick param kept at 5 here
                applyEffect(e, COMBAT_EFFECTS.withering(durationTicks, 5, 1));
                total += final;
            }
            const durationMinsHuman = Math.round(
                durationTicks / (60 * TICKS_PER_SEC)
            );
            await dialog(
                `${spellName} shakes the ground for ${total} damage and applies Withering for ${durationMinsHuman} minutes.`
            );
        },

        'blessing of life': async () => {
            const def = getSpellDef('blessing of life');
            const cost = resolveManaCost(def, p) || 0;
            if (!(await spendMana(cost))) return;
            const castTimeTicks = resolveParam(
                def,
                p,
                'castTimeTicks',
                90 * TICKS_PER_SEC
            );
            // For now heal instantly but record cast time in log
            p.health = p.max_life;
            p.health = p.health;
            const castTimeHuman = Math.round(castTimeTicks / TICKS_PER_SEC);
            await dialog(
                `${spellName} restores you to full health (cast time ${castTimeHuman}s).`
            );
        },

        cleanse: async () => {
            const def = getSpellDef('cleanse');
            const cost = resolveManaCost(def, p) || 10;
            if (!(await spendMana(cost))) return;
            p.effects = p.effects || [];
            // keep only positive effects
            const newEff = [];
            for (const ef of p.effects) {
                if (ef && (ef.type === 'buff' || ef.type === 'heal'))
                    newEff.push(ef);
            }
            p.effects = newEff;
            await dialog(`${spellName} clears negative effects.`);
        },

        'bloody exchange': async () => {
            const def = getSpellDef('bloody exchange');
            const cost = resolveManaCost(def, p) || 0;
            if (!(await spendMana(cost))) return;
            const percent = resolveParam(def, p, 'percent', 0.2);
            const curr = p.health ?? p.health;
            const sacrifice = Math.max(1, Math.round(curr * percent));
            p.health = Math.max(1, curr - sacrifice);
            p.health = p.health;
            let total = 0;
            for (const e of aliveEnemies) {
                const share = Math.max(
                    1,
                    Math.round(sacrifice / Math.max(1, aliveEnemies.length))
                );
                const { final } = calculateDamage(p, e, share);
                applyDamage(e, final);
                total += final;
            }
            await dialog(
                `${spellName} trades ${sacrifice} HP (${Math.round(
                    percent * 100
                )}%) to deal ${total} total damage.`
            );
        },

        'curse of the plague': async () => {
            const def = getSpellDef('curse of the plague');
            const cost = resolveManaCost(def, p) || 30;
            if (!(await spendMana(cost))) return;
            const effectPercent = resolveParam(def, p, 'effectPercent', 10);
            const durationTicks = resolveParam(
                def,
                p,
                'durationTicks',
                30 * TICKS_PER_SEC
            );
            // damage per tick scaled by effectPercent (simple mapping)
            const dmgPerTick = resolveParam(
                def,
                p,
                'damagePerTick',
                Math.max(1, Math.round(effectPercent / 10))
            );
            applyEffect(enemy, COMBAT_EFFECTS.poison(dmgPerTick));
            // set duration on the effect instance
            if (enemy.effects && enemy.effects.length > 0) {
                enemy.effects[enemy.effects.length - 1].remaining =
                    durationTicks;
            }
            const durationSecsHuman = Math.round(durationTicks / TICKS_PER_SEC);
            await dialog(
                `${spellName} afflicts ${enemy.name} (effect ${effectPercent}%, ${durationSecsHuman}s).`
            );
        },

        "zeus's blessing": async () => {
            const def = getSpellDef("zeus's blessing");
            const cost = resolveManaCost(def, p) || 25;
            if (!(await spendMana(cost))) return;
            const durationMinutes = resolveParam(def, p, 'durationMinutes', 2);
            // choose number of strikes based on rarity
            const rarity = getPlayerSpellRarity(p, name);
            const strikes =
                rarity === 'legendary' ? 8 : rarity === 'epic' ? 4 : 2;
            let total = 0;
            for (let i = 0; i < strikes; i++) {
                if (aliveEnemies.length === 0) break;
                const idx = Math.floor(Math.random() * aliveEnemies.length);
                const e = aliveEnemies[idx];
                const dmg = 10;
                const { final } = calculateDamage(player, e, dmg);
                applyDamage(e, final);
                total += final;
            }
            await dialog(
                `${spellName} strikes ${strikes} times over ${durationMinutes}m for ${total} total damage.`
            );
        },

        'raise dead': async () => {
            const def = getSpellDef('raise dead');
            const cost = resolveManaCost(def, p) || 45;
            if (!(await spendMana(cost))) return;
            const count = resolveParam(def, p, 'count', 2);
            // For simplicity, heal a small amount per summoned ally
            const heal = Math.min(player.max_life, 5 * count);
            player.health = Math.min(player.max_life, player.health + heal);
            await dialog(
                `${spellName} summons ${count} undead and heals you for ${heal}.`
            );
        },

        godlike: async () => {
            const cost = 80;
            if (!(await spendMana(cost))) return;
            // apply strong buff to player
            const buff = {
                name: 'Godlike',
                type: 'buff',
                duration: 20,
                healthRegen: 10,
                damageReduction: 25
            };
            applyEffect(player, buff);
            await dialog(
                `${spellName} grants you godlike power for ${buff.duration}s.`
            );
        },

        default: async () => {
            // fallback
            await dialog('Spell has no implementation.');
        }
    };

    // find matching handler
    for (const key of Object.keys(handlers)) {
        if (name.includes(key.replace(/\(default\)/, '').trim())) {
            return {
                cast: handlers[key],
                render: getSpellDef(key)?.render_effect
            };
        }
    }

    await dialog('Not a known spell.');
}

/**
 * Tick: apply regen to player and enemies
 * @param {Player} player
 * @param {Array<any>} enemies
 */
function applyRegeneration(player, enemies) {
    // player regen
    player.stamina = Math.min(
        player.max_stamina,
        player.stamina + (player.stamina_regen || 0)
    );
    player.mana = Math.min(
        player.max_mana,
        player.mana + (player.mana_regen || 0)
    );
    player.health = Math.min(
        player.max_life,
        player.health + (player.health_regen || 0)
    );

    // enemies regen
    for (const e of enemies) {
        if (e.health <= 0) continue;
        const regen = e.health_regen || 0;
        e.health = Math.min(e.health, e.health + regen);
    }
}

/**
 * Combat class and builder
 */
/**
 * @typedef {Object} CombatOptions
 * @property {'easy'|'medium'|'hard'} [difficulty]
 * @property {any[]} [enemies]
 * @property {any} [player]
 * @property {number} [tickIntervalMs]
 */

class Combat {
    /** @type {'easy'|'medium'|'hard'} */
    difficulty;
    /** @type {any[]} */
    enemies;
    /** @type {any} */
    player;
    /** @type {number} */
    tickIntervalMs;
    /**
     * @param {CombatOptions} [options]
     */
    constructor({
        difficulty = DIFFICULTY.MEDIUM,
        enemies = /** @type {Enemy[]} */ ([]),
        player = null,
        // default to 60 FPS
        tickIntervalMs = Math.round(1000 / 60)
    } = {}) {
        this.difficulty = difficulty;
        this.enemies = enemies;
        this.player = player;
        this.tickIntervalMs = tickIntervalMs;
    }

    /**
     * Start the battle loop. Returns { won: boolean, log: string[] }
     * @returns {Promise<{ won:boolean, log:string[] }>}
     */
    async start() {
        return new Promise(async resolve => {
            /** @type {Player} */
            const player = this.player;
            const game = Game.current;
            const cast_animation = player.cast_animation;
            cast_animation.reset();
            await game.renderer.batch(() => {
                game.renderer.clear();
                game.renderer.entity(new BattleGround(), 0, 0);
                game.renderer.entity(
                    new Image(asset('beggar/cast/1.png'), { scale: 7 }),
                    game.renderer.width * 0.25,
                    game.renderer.height * 0.1
                );
                // game.renderer.entity(
                //     cast_animation,
                //     // player.get_entity(ORIENTATIONS.NORTHEAST, 10),
                //     game.renderer.width * 0.1,
                //     game.renderer.height * 0.1
                // );
            });
            /** @type {Enemy[]} */
            const enemies = this.enemies || [];
            const enemy_names = enemies.map(enemy => enemy.name);
            console.log(enemies);
            /**
             * @param {string[]} enemy_names
             */
            function stringify(enemy_names) {
                const [...set] = new Set(enemy_names);
                const quantities = set.map(
                    name =>
                        /** @type {[string, number]} */ ([
                            name,
                            enemy_names.filter(enemy => enemy === name).length
                        ])
                );
                const has_multiple = quantities.some(
                    ([_, quantity]) => quantity > 1
                );
                const names = quantities.map(([name, quantity]) =>
                    quantity === 1 && !has_multiple
                        ? name
                        : `${quantity === 1 ? (/^[aeiou]/i.test(name) ? 'an' : 'a') : quantity} ${name}${quantity > 1 ? 's' : ''}`
                );
                let res = /^[0-9]/.test(names[0]) || has_multiple ? '' : 'a';
                if (/^[aeiou]/i.test(names[0]) && !has_multiple) {
                    res += 'n';
                }
                if (!/^[0-9]/.test(names[0]) && !has_multiple) {
                    res += ' ';
                }
                const len = names.length;
                for (let index = 0; index < len; index++) {
                    if (index > 0 && index < len - 1) {
                        res += ', ';
                    } else if (index > 0 && index === len - 1) {
                        res += ' and ';
                    }
                    res += names[index];
                }
                return res;
            }
            await dialog(`You encounter ${stringify(enemy_names)}!`);
            await sleep(1000);
            /** @type {string[]} */
            const log = [];

            // ensure runtime fields exist
            // player.health =
            //     player.health ?? player.health ?? player.max_life ?? 0;
            player.effects = player.effects || [];
            for (const e of enemies) {
                e.effects = e.effects || [];
            }

            const fixedDt = 1000 / 60; // ms per tick (60Hz)

            // tick function that runs one logical tick
            async function tick() {
                // process effects
                await processEffects(player);
                for (const e of enemies) await processEffects(e);

                // apply regeneration
                applyRegeneration(player, enemies);

                // check for dead enemies
                const alive_enemies = enemies.filter(e => e.health > 0);

                // player action
                if (player.health > 0) {
                    const target = alive_enemies[0];
                    if (target) {
                        // choose action
                        if (player.stamina < 10 && player.mana < 12) {
                            await playerMelee(player, target);
                        } else if (
                            (await select(
                                'Do you want to perform a spell or melee attack?',
                                ['Spell', 'Melee']
                            )) === 'Melee'
                        ) {
                            await playerMelee(player, target);
                        } else {
                            const spell = await playerCast(
                                player,
                                target,
                                enemies,
                                await select(
                                    'Choose an attack.',
                                    SPELL_DEFINITIONS.map(spell => spell.name)
                                )
                            );
                            /**
                             * @param {{ cast(): Promise<void>; render_effect?(renderer: RaytracingRenderer, step: number): Promise<void> } | null | undefined} spell
                             */
                            async function animate(spell) {
                                while (cast_animation.next() !== 0) {
                                    await game.renderer.batch(async () => {
                                        game.renderer.clear();
                                        game.renderer.entity(
                                            new BattleGround(),
                                            0,
                                            0
                                        );
                                        game.renderer.entity(
                                            cast_animation,
                                            game.renderer.width * 0.25,
                                            game.renderer.height * 0.1
                                        );
                                        await spell?.render_effect?.(
                                            game.renderer,
                                            cast_animation.state /
                                                cast_animation.length
                                        );
                                    });
                                    await sleep(100);
                                }
                                await sleep(100);
                            }
                            await sleep(100);
                            clear();
                            await sleep(100);
                            await animate(spell);
                            await spell?.cast();
                        }
                    }
                    // Player action code goes here -------------------------------->
                }

                // enemies act
                for (const e of alive_enemies) {
                    const speed =
                        typeof e.attack_speed === 'number'
                            ? e.attack_speed
                            : 3.0;
                    const actChance = Math.min(1, 1 / Math.max(0.5, speed));
                    if (Math.random() < actChance) {
                        await enemyAct(e, player);
                    }
                }
            }

            // end check helper
            const checkEnd = async () => {
                const anyEnemyAlive = enemies.some(e => e.health > 0);
                const playerAlive = player.health > 0;
                if (!playerAlive || !anyEnemyAlive) {
                    await dialog(
                        playerAlive && !anyEnemyAlive
                            ? 'You won the battle!'
                            : 'You were defeated...'
                    );
                    resolve({ won: playerAlive && !anyEnemyAlive, log });
                    return true;
                }
                return false;
            };
            async function loop() {
                await tick();
                if (await checkEnd()) {
                    return;
                }
                requestAnimationFrame(loop);
            }
            requestAnimationFrame(loop);
        });
    }
}

class CombatBuilder
    extends /** @type {typeof BaseBuilder<{ [K in keyof Combat as Combat[K] extends Function ? never : K]: Combat[K] }, Combat>} */ (
        BaseBuilder
    )
{
    constructor() {
        super(
            data => new Combat(data),
            'difficulty',
            'enemies',
            'player',
            'tickIntervalMs'
        );
    }
}

export {
    Combat,
    CombatBuilder,
    DIFFICULTY,
    pickEnemiesForDifficulty,
    playerCast,
    playerMelee
};
