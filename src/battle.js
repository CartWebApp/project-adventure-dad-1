// battle.js
// @ts-check
import {
    BaseBuilder,
    enemies as ENEMY_POOL,
    effects as COMBAT_EFFECTS
} from './combat.js';
import { Player } from './character.js';

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
        JSON.parse(JSON.stringify(enemy))
    );
}

/**
 * @param {'easy'|'medium'|'hard'} difficulty
 * @returns {Array<any>}
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
        e.current_health = e.health;
        e.effects = []; // active
        e._tickCounter = 0;
        return e;
    });
}

/**
 * Damage calculation
 * @param {{damage:number}} attacker
 * @param {{current_health:number, damage_reduction?:number, block_chance?:number}} defender
 * @param {number} baseDamage
 */
function calculateDamage(attacker, defender, baseDamage) {
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
 * @param {{current_health:number, max_life?:number, extra_lives?:number}} target
 * @param {number} dmg
 */
function applyDamage(target, dmg) {
    if (dmg <= 0) return;
    target.current_health = Math.max(0, target.current_health - dmg);
}

/**
 * @param {any} target
 * @param {object} effect
 */
function applyEffect(target, effect) {
    // copy effect with runtime fields
    const e = Object.assign({}, effect);
    e.remaining =
        effect.duration === Infinity ? Infinity : Math.max(0, effect.duration);
    target.effects = target.effects || [];
    target.effects.push(e);
}

/**
 * Process active effects for one tick (1 second)
 * @param {any} actor
 * @param {Array} log
 */
function processEffects(actor, log) {
    if (!actor.effects || actor.effects.length === 0) return;
    const remaining = [];
    for (const e of actor.effects) {
        if (e.type === 'damageOverTime') {
            // Idk if we are gonna use damagePerSecond or damagePerTick so both I guess
            const dmg = e.damagePerSecond ?? e.damagePerTick ?? 0;
            if (dmg > 0) {
                applyDamage(actor, dmg);
                log.push(
                    `${actor.name || 'Player'} takes ${dmg} ${e.name} damage.`
                );
            }
        }
        // reduce duration (if not infinite)
        if (e.remaining !== Infinity) {
            e.remaining -= 1;
            if (e.remaining > 0) remaining.push(e);
        } else {
            remaining.push(e);
        }
    }
    actor.effects = remaining;
}

/**
 * Simple enemy AI
 * @param {any} enemy
 * @param {any} player
 * @param {Array} log
 */
function enemyAct(enemy, player, log) {
    // skip dead
    if (enemy.current_health <= 0) return;

    // choose attack by weight
    const r = Math.random();
    let chosen = enemy.primary_attack;
    if (enemy.secondary_attack && r > 0.7) chosen = enemy.secondary_attack;
    if (enemy.tertiary_attack && r > 0.9) chosen = enemy.tertiary_attack;

    // parse simple attack descriptors
    const name = String(chosen || '').toLowerCase();
    if (name.includes('poison')) {
        applyEffect(player, COMBAT_EFFECTS.poison(1));
        log.push(`${enemy.name} uses ${chosen} — applied Poison.`);
    } else if (name.includes('burn')) {
        applyEffect(player, COMBAT_EFFECTS.burning(5, 2));
        log.push(`${enemy.name} uses ${chosen} — applied Burning.`);
    } else if (name.includes('petrif') || name.includes('petrified')) {
        applyEffect(player, COMBAT_EFFECTS.petrified(3));
        log.push(`${enemy.name} uses ${chosen} — applied Petrified.`);
    } else if (name.includes('stun') || name.includes('shocked')) {
        applyEffect(player, COMBAT_EFFECTS.shocked(2));
        log.push(`${enemy.name} uses ${chosen} — applied Shocked.`);
    } else {
        // default: basic damage
        const base = Math.max(3, Math.round(enemy.health * 0.03));
        const { final } = calculateDamage(enemy, player, base);
        applyDamage(player, final);
        log.push(`${enemy.name} hits for ${final} damage.`);
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
 * @param {any} enemy
 * @param {Array} log
 */
function playerMelee(player, enemy, log) {
    // ------------------------------------------------------------------
    const staminaCost = 10;
    // ------------------------------------------------------------------
    if (player.stamina < staminaCost) {
        // weak attack
        const base = 3;
        const { final } = calculateDamage(player, enemy, base);
        applyDamage(enemy, final);
        log.push(`Weak strike deals ${final} damage (low stamina).`);
        return;
    }
    player.stamina -= staminaCost;
    const weaponDamage =
        player.equipped?.weapon?.stats_by_rarity?.common?.damage ?? 10;
    const base = Math.round(weaponDamage + player.luck * 0.01 * weaponDamage);
    const { final } = calculateDamage(player, enemy, base);
    applyDamage(enemy, final);
    log.push(`You strike ${enemy.name} for ${final} damage.`);
}

/**
 * Player cast spell (basic)
 * @param {Player} player
 * @param {any} enemy
 * @param {string} spellName
 * @param {Array} log
 */
function playerCast(player, enemy, spellName, log) {
    // simple mapping for basic spells (CHANGE TO THE SPELLS WE HAVE!!!!!!!)
    // ------------------------------------------------------------------
    const name = String(spellName || '').toLowerCase();
    if (name.includes('fireball')) {
        const manaCost = 14;
        if (player.mana < manaCost) {
            log.push('Not enough mana.');
            return;
        }
        player.mana -= manaCost;
        const base = 5;
        const { final } = calculateDamage(player, enemy, base);
        applyDamage(enemy, final);
        applyEffect(enemy, COMBAT_EFFECTS.burning(4, 2));
        log.push(
            `Fireball hits ${enemy.name} for ${final} and applies Burning.`
        );
    } else if (name.includes('mana bolt') || name.includes('magic missile')) {
        const manaCost = 15;
        if (player.mana < manaCost) {
            log.push('Not enough mana.');
            return;
        }
        player.mana -= manaCost;
        const base = 15;
        const { final } = calculateDamage(player, enemy, base);
        applyDamage(enemy, final);
        log.push(`${spellName} deals ${final} damage.`);
    } else {
        // default to nothing
        log.push(`Not a spell`);
    }
    // ------------------------------------------------------------------
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
        if (e.current_health <= 0) continue;
        const regen = e.health_regen || 0;
        e.current_health = Math.min(e.health, e.current_health + regen);
    }
}

/**
 * Combat class and builder
 */
class Combat {
    difficulty;
    enemies;
    player;
    tickIntervalMs;
    constructor({
        difficulty = DIFFICULTY.MEDIUM,
        enemies = [],
        player = null,
        tickIntervalMs = 1000
    } = {}) {
        this.difficulty = difficulty;
        this.enemies = enemies;
        this.player = player;
        this.tickIntervalMs = tickIntervalMs;
    }

    /**
     * Start the battle loop. Returns { won: boolean, log: string[] }
     * @returns {Promise<{won:boolean, log:string[]}>}
     */
    async start() {
        const log = [];
        // prepare player runtime fields
        const player = this.player;
        if (!player)
            throw new Error('Combat requires a Player instance as `player`');

        // ensure runtime fields exist
        player.current_health = player.health;
        player.stamina = player.stamina ?? player.max_stamina;
        player.mana = player.mana ?? player.max_mana;

        // prepare enemies
        const enemies = this.enemies.length
            ? this.enemies
            : pickEnemiesForDifficulty(this.difficulty);
        log.push(`Encounter: ${enemies.map(e => e.name).join(', ')}`);

        // scale enemies slightly by difficulty
        const scale =
            this.difficulty === DIFFICULTY.EASY
                ? 0.9
                : this.difficulty === DIFFICULTY.HARD
                  ? 1.25
                  : 1.0;
        for (const e of enemies) {
            e.current_health = Math.round(e.current_health * scale);
            e.health = Math.round(e.health * scale);
            e.health_regen = Math.max(
                0,
                Math.round((e.health_regen || 0) * scale)
            );
        }

        // battle loop (tick-based)
        return new Promise(resolve => {
            const interval = setInterval(() => {
                // process effects
                processEffects(player, log);
                for (const e of enemies) processEffects(e, log);

                // apply regeneration
                applyRegeneration(player, enemies);

                // check for dead enemies
                const aliveEnemies = enemies.filter(e => e.current_health > 0);

                // player action
                if (player.current_health > 0) {
                    const target = aliveEnemies[0];
                    if (target) {
                        // choose action
                        if (player.stamina >= 10) {
                            playerMelee(player, target, log);
                        } else if (player.mana >= 12) {
                            // ------------------------------------------------------------------
                            playerCast(player, target, 'Magic Missile', log);
                            // ------------------------------------------------------------------
                        } else {
                            playerMelee(player, target, log);
                        }
                    }
                }

                // enemies act
                for (const e of aliveEnemies) {
                    // convert attack_speed to chance to act this tick
                    const speed =
                        typeof e.attack_speed === 'number'
                            ? e.attack_speed
                            : 3.0;
                    // normalize
                    const actChance = Math.min(1, 1 / Math.max(0.5, speed));
                    if (Math.random() < actChance) {
                        enemyAct(e, player, log);
                    }
                }

                // 6) clamp player/enemy health to zero and update player.health for persistence
                player.current_health = Math.max(
                    0,
                    Math.min(player.current_health, player.max_life)
                );
                player.health = player.current_health;

                for (const e of enemies) {
                    e.current_health = Math.max(
                        0,
                        Math.min(e.current_health, e.health)
                    );
                }

                // check end conditions
                const anyEnemyAlive = enemies.some(e => e.current_health > 0);
                const playerAlive = player.current_health > 0;

                if (!playerAlive || !anyEnemyAlive) {
                    clearInterval(interval);
                    const won = playerAlive && !anyEnemyAlive;
                    log.push(
                        won ? 'You won the battle!' : 'You were defeated...'
                    );
                    // sync fields back to main
                    player.health = player.current_health;
                    player.mana = player.mana;
                    player.stamina = player.stamina;
                    resolve({ won, log });
                }
            }, this.tickIntervalMs);
        });
    }
}

class CombatBuilder extends BaseBuilder {
    constructor() {
        super(
            data => new Combat(data),
            'difficulty',
            'enemies',
            'player',
            'tickIntervalMs'
        );
    }
    build() {
        return new Combat(this.data);
    }
}

export { Combat, CombatBuilder, DIFFICULTY, pickEnemiesForDifficulty };
