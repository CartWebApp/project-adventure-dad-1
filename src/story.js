import { Player } from './character.js';
import { Entity } from './combat.js';
import { CHARACTER_CHOICES, STATES } from './constants.js';
import { Game } from './game.js';
import { Ground, Sun, Tree } from './objects.js';
import { Renderer } from './renderer.js';
import { clear, dialog, input, select } from './ui.js';
import {
    CombatBuilder,
    DIFFICULTY,
    pickEnemiesForDifficulty
} from './battle.js';
import {
    items,
    spells,
    weapons,
    potions,
    getArmorForRarity
} from './obtainables.js';

export class Step {
    /** @type {(typeof STATES)[keyof typeof STATES]} */
    state = STATES.TRAVEL;
    /** @type {Step | null} */
    next = null;
    /** @type {Step | null} */
    prev = null;
    /** @type {Step | null} */
    parent = null;
    /** @type {Step | null} */
    head = null;
    /** @type {Step | null} */
    tail = null;
    static id = 0;
    id = Step.id++;
    /** @type {Step[]} */
    static #steps = [];
    constructor() {
        Step.#steps[this.id] = this;
    }
    /**
     * @param {number} id
     */
    static goto(id) {
        return this.#steps[id];
    }

    /**
     * @param {Game} game
     */
    async execute(game) {}
    /**
     * @param {(typeof STATES)[keyof typeof STATES]} state
     */
    with_state(state) {
        this.state = state;
        return this;
    }

    /**
     * @template {Step} Next
     * @param {Next} step
     * @returns {Next}
     */
    then(step) {
        this.next = step;
        step.prev = this;
        return step;
    }
}

class Branch extends Step {
    determiner;

    /** @type {Step[]} */
    branches = [];

    /**
     * @param {(game: Game) => number | Promise<number>} determiner
     */
    constructor(determiner) {
        super();
        this.determiner = determiner;
    }

    /**
     * @param {Array<Step | null>} branches
     */
    with_branches(...branches) {
        this.branches = branches.map(branch =>
            branch !== null ? branch : new Execute(() => {})
        );
        for (const branch of this.branches) {
            branch.parent = this;
        }
        return this;
    }

    /**
     * @param {Game} game
     */
    async execute(game) {
        const branch = this.branches[await this.determiner(game)];
        await branch.execute(game);
        this.next = branch.next;
    }

    /**
     * @template {Step} Next
     * @param {Next} step
     * @returns {Next}
     */
    then(step) {
        for (const branch of this.branches) {
            branch.next = step;
            step.prev = branch;
        }
        return step;
    }
}

class Execute extends Step {
    executor;
    /**
     * @param {(game: Game) => Promise<void> | void} executor
     */
    constructor(executor) {
        super();
        this.executor = executor;
    }

    /**
     * @param {Game} game
     */
    async execute(game) {
        await this.executor(game);
    }
}

const BattleEncounter = new Execute(async game => {
    // Choose difficulty dynamically if you want; here we use MEDIUM
    const difficulty = DIFFICULTY.MEDIUM;

    const enemies = pickEnemiesForDifficulty(difficulty);

    // Build and start combat
    const combat = new CombatBuilder()
        .with_difficulty(difficulty)
        .with_player(game.player)
        .with_enemies(enemies)
        .build();

    const result = await combat.start();

    // store result on game for subsequent steps
    game._lastCombatResult = Object.assign({}, result, { difficulty });
});

// Steps to run after a battle outcome. Keep them lightweight so they can
// be reused by any Branch that wants to route based on combat results.
const AfterWin = new Execute(async game => {
    await dialog('You defeated your foes!');
    if (!game.player) return;
    // small reward: restore some stamina/mana and give a bit of luck
    game.player.stamina = Math.min(
        game.player.max_stamina,
        game.player.stamina + 10
    );
    game.player.mana = Math.min(game.player.max_mana, game.player.mana + 5);
    game.player.luck = (game.player.luck || 0) + 1;

    // Award money and an item based on difficulty
    const difficulty = game._lastCombatResult?.difficulty || DIFFICULTY.MEDIUM;
    let minMoney = 25,
        maxMoney = 100;
    let tier = 1; // 0=low,1=mid,2=high
    if (difficulty === DIFFICULTY.EASY) {
        minMoney = 25;
        maxMoney = 100;
        tier = 0;
    } else if (difficulty === DIFFICULTY.MEDIUM) {
        minMoney = 200;
        maxMoney = 600;
        tier = 1;
    } else if (difficulty === DIFFICULTY.HARD) {
        minMoney = 1200;
        maxMoney = 5000;
        tier = 2;
    }
    const money =
        Math.floor(Math.random() * (maxMoney - minMoney + 1)) + minMoney;
    game.player.money = (game.player.money || 0) + money;

    // Select an item from the items array biased by value tiers
    const sorted = [...items].sort((a, b) => (a.value || 0) - (b.value || 0));
    const third = Math.max(1, Math.floor(sorted.length / 3));
    let pool = [];
    if (tier === 0) pool = sorted.slice(0, third);
    else if (tier === 1) pool = sorted.slice(third, third * 2);
    else pool = sorted.slice(third * 2);
    if (pool.length === 0) pool = sorted;
    const item = pool[Math.floor(Math.random() * pool.length)];
    game.player.inventory = game.player.inventory || [];
    game.player.inventory.push(item);

    // Award a potion (always) chosen by difficulty-tier
    const potionPool = potions || [];
    let potionCandidates = potionPool;
    if (difficulty === DIFFICULTY.EASY)
        potionCandidates = potionPool.filter(
            p => (p.costs?.common ?? p.value ?? 0) < 200
        );
    else if (difficulty === DIFFICULTY.MEDIUM)
        potionCandidates = potionPool.filter(
            p => (p.costs?.rare ?? p.value ?? 0) < 2000
        );
    else potionCandidates = potionPool;
    if (potionCandidates.length > 0) {
        const chosenPotion = JSON.parse(
            JSON.stringify(
                potionCandidates[
                    Math.floor(Math.random() * potionCandidates.length)
                ]
            )
        );
        game.player.inventory.push(chosenPotion);
    }

    // Possibly award armor/weapon (chance scales with difficulty)
    const armorChance =
        difficulty === DIFFICULTY.EASY
            ? 0.3
            : difficulty === DIFFICULTY.MEDIUM
              ? 0.6
              : 0.9;
    if (Math.random() < armorChance) {
        const rarity =
            difficulty === DIFFICULTY.EASY
                ? 'common'
                : difficulty === DIFFICULTY.MEDIUM
                  ? 'rare'
                  : 'epic';
        const armorPool = getArmorForRarity(rarity) || [];
        if (armorPool.length > 0) {
            const chosenArmor = JSON.parse(
                JSON.stringify(
                    armorPool[Math.floor(Math.random() * armorPool.length)]
                )
            );
            game.player.inventory.push(chosenArmor);
        }
    }

    // Possibly award a spell (chance scales with difficulty)
    const spellChance =
        difficulty === DIFFICULTY.EASY
            ? 0.2
            : difficulty === DIFFICULTY.MEDIUM
              ? 0.5
              : 0.8;
    if (Math.random() < spellChance && spells.length > 0) {
        // Prefer spells that have params or costs for the target rarity
        const targetRarity =
            difficulty === DIFFICULTY.EASY
                ? 'common'
                : difficulty === DIFFICULTY.MEDIUM
                  ? 'rare'
                  : 'epic';
        const candidates = spells.filter(s => {
            return (
                (s.params_by_rarity && s.params_by_rarity[targetRarity]) ||
                (s.mana_cost_by_rarity &&
                    s.mana_cost_by_rarity[targetRarity]) ||
                true
            );
        });
        const chosenSpell = JSON.parse(
            JSON.stringify(
                candidates[Math.floor(Math.random() * candidates.length)]
            )
        );
        game.player.spells = game.player.spells || [];
        game.player.spells.push(chosenSpell);
    }

    await dialog(`You found ${item.name} and ${money} copper!`);
});

const AfterLoss = new Execute(async game => {
    await dialog('You were defeated... You awaken later, bruised but alive.');
    // revive the player to half health and remove one extra life if present
    if (game.player) {
        game.player.health = Math.max(
            1,
            Math.floor((game.player.max_life || 100) * 0.5)
        );
        if (game.player.extra_lives > 0) game.player.extra_lives -= 1;
    }
});

// Branch that runs the battle and then chooses the next step
const BattleBranch = new Branch(async game => {
    // run the encounter
    await BattleEncounter.execute(game);
    // read the result
    const won = !!game._lastCombatResult?.won;
    return won ? 0 : 1;
}).with_branches(AfterWin, AfterLoss);

class Battle extends Step {
    /** @type {(game: Game) => Entity[] | Promise<Entity[]>} */
    opponents = () => [];
    state = STATES.BATTLE;
    won = false;
    /** @type {Step | null} */
    #if_won = null;
    /** @type {Step | null} */
    #if_lost = null;

    /**
     * @param {(game: Game) => Entity[] | Promise<Entity[]>} opponents
     */
    with_opponents(opponents) {
        this.opponents = opponents;
        return this;
    }

    /**
     * @param {Game} game
     */
    async execute(game) {
        const opponents = await this.opponents(game);
        while (
            opponents.some(opponent => opponent.health > 0) ||
            game.player.health > 0
        ) {}
    }

    /**
     * @param {Step} step
     */
    if_won(step) {
        this.#if_won = step;
        this.next = new Branch(() => (this.won ? 0 : 1)).with_branches(
            this.#if_won,
            this.#if_lost
        );
        return this;
    }

    /**
     * @param {Step} step
     */
    if_lost(step) {
        this.#if_lost = step;
        this.next = new Branch(() => (this.won ? 0 : 1)).with_branches(
            this.#if_won,
            this.#if_lost
        );
        return this;
    }
}

/**
 * @template {string} T
 */
class Input extends Step {
    prompt;
    /** @type {(input: string) => input is T} */
    validator = input => true;
    /** @type {T | undefined} */
    value;
    /** @type {(value: T) => void} */
    handler = () => {};
    max_length = Infinity;
    /**
     * @param {string} prompt
     */
    constructor(prompt) {
        super();
        this.prompt = prompt;
    }

    /**
     * @param {(input: string) => input is T} validator
     */
    with_validator(validator) {
        this.validator = validator;
        return this;
    }

    /**
     * @param {number} max_length
     */
    with_max_length(max_length) {
        this.max_length = max_length;
        return this;
    }

    /**
     * @param {(input: T) => void} handler
     */
    handle(handler) {
        this.handler = handler;
        return this;
    }

    async execute() {
        this.value = await input(this.prompt, this.validator, this.max_length);
        this.handler(this.value);
    }
}

class Dialog extends Step {
    dialog;
    /** @type {(renderer: Renderer, x: number, y: number) => void} */
    render_icon = () => {};
    per_letter_duration = 75;
    /**
     * @param {string} dialog
     */
    constructor(dialog) {
        super();
        this.dialog = dialog;
    }

    /**
     * @param {number} duration
     */
    with_overall_duration(duration) {
        this.per_letter_duration = duration / this.dialog.length;
        return this;
    }

    /**
     * @param {number} duration
     */
    with_per_letter_duration(duration) {
        this.per_letter_duration = duration;
        return this;
    }

    /**
     * @param {(renderer: Renderer, x: number, y: number) => void} render_icon
     */
    with_icon(render_icon) {
        this.render_icon = render_icon;
        return this;
    }

    async execute() {
        await dialog(this.dialog, this.render_icon);
    }
}

class Parallel extends Step {
    /** @type {Step[]} */
    steps = [];
    /**
     * @param {Step[]} steps
     */
    constructor(...steps) {
        super();
        this.steps = steps;
    }
    /**
     * @param {Game} game
     */
    async execute(game) {
        await Promise.all(this.steps.map(step => step.execute(game)));
    }
}

class Delayed extends Step {
    delay;
    /**
     * @param {number} delay
     */
    constructor(delay) {
        super();
        this.delay = delay;
    }
    async execute() {
        await new Promise(resolve => setTimeout(resolve, this.delay));
    }
}

class Loop extends Step {
    body;
    /** @type {(game: Game) => boolean} */
    condition = () => true;
    /**
     * @param {(game: Game) => (Promise<void> | void)} fn
     */
    constructor(fn) {
        super();
        this.body = fn;
    }

    /**
     * @param {(game: Game) => boolean} condition
     */
    until(condition) {
        this.condition = condition;
        return this;
    }

    /**
     * @param {Game} game
     */
    async execute(game) {
        while (this.condition(game)) {
            await this.body(game);
        }
    }
}

/**
 * @template State
 */
class StatefulLoop extends Step {
    /** @type {(game: Game) => (State | Promise<State>)} */
    body;
    /** @type {(game: Game, state: State) => boolean} */
    condition = () => true;
    /**
     * @param {(game: Game) => (State | Promise<State>)} body
     */
    constructor(body) {
        super();
        this.body = body;
    }

    /**
     * @param {(game: Game, state: State) => boolean} condition
     */
    until(condition) {
        this.condition = (game, state) => !condition(game, state);
        return this;
    }

    /**
     * @param {(game: Game, state: State) => boolean} condition
     */
    while(condition) {
        this.condition = condition;
        return this;
    }

    /**
     * @param {Game} game
     */
    async execute(game) {
        let state;
        do {
            state = await this.body(game);
        } while (this.condition(game, state));
    }
}

class Render extends Step {
    render;
    logic;
    batch = false;
    /**
     * @param {(game: Game) => (void | Promise<void>)} render
     * @param {(game: Game) => (void | Promise<void>)} logic
     */
    constructor(render, logic) {
        super();
        this.render = render;
        this.logic = logic;
    }

    /**
     * @param {boolean} batch
     */
    with_batch(batch) {
        this.batch = batch;
        return this;
    }

    /**
     * @param {Game} game
     */
    async execute(game) {
        const { promise, resolve } = /** @type {PromiseWithResolvers<void>} */ (
            Promise.withResolvers()
        );
        let done = false;
        const loop = async () => {
            if (this.batch) {
                await game.renderer.batch_async(
                    async () => await this.render(game)
                );
            } else {
                await this.render(game);
            }
            if (!done) {
                return requestAnimationFrame(loop);
            }
        };
        loop();
        Promise.resolve(this.logic(game)).then(() => {
            done = true;
            resolve();
        });
        return promise;
    }
}

localStorage.name ??= '';
export const story = new Parallel(
    new Input('Choose a name.')
        .with_validator(
            // @ts-expect-error
            /** @type {string} */ value =>
                typeof value === 'string' && value.length > 0
        )
        .with_max_length(15)
        .handle(
            /** @type {string} */ value => {
                localStorage.name = value;
            }
        ),
    new Execute(({ renderer }) => {
        const gradient = renderer.ctx.createLinearGradient(
            0,
            0,
            0,
            renderer.height
        );
        gradient.addColorStop(0, 'black');
        gradient.addColorStop(0.75, 'oklch(43.8% 0.218 303.724)');
        renderer.background(gradient);
    })
)
    .then(
        new Branch(async () => {
            const choice = await select(
                `What character do you prefer, ${localStorage.name}?`,
                ['Knight', 'Beggar', 'Slave']
            );
            return choice === 'Knight' ? 0 : choice === 'Beggar' ? 1 : 2;
        }).with_branches(
            new Execute(game => {
                game.player = new Player(
                    localStorage.name,
                    CHARACTER_CHOICES.KNIGHT
                );
            }),
            new Execute(game => {
                game.player = new Player(
                    localStorage.name,
                    CHARACTER_CHOICES.BEGGAR
                );
            }),
            new Execute(game => {
                game.player = new Player(
                    localStorage.name,
                    CHARACTER_CHOICES.SLAVE
                );
            })
        )
    )
    .then(
        new Parallel(
            new Execute(async ({ renderer }) => {
                for (let i = 0; i < 21; i++) {
                    const gradient = renderer.ctx.createLinearGradient(
                        0,
                        0,
                        0,
                        renderer.height
                    );
                    gradient.addColorStop(0, 'black');
                    gradient.addColorStop(0.25 * (i / 20), 'black');
                    if (i <= 19) {
                        gradient.addColorStop(
                            0.75 + 0.25 * (i / 20),
                            'oklch(43.8% 0.218 303.724)'
                        );
                    }
                    renderer.background(gradient);
                    await new Promise(resolve => setTimeout(resolve, 125));
                }
            }),
            new Dialog(
                `Excellent choice${'​'.repeat(5)}.${'​'.repeat(7)}.${'​'.repeat(
                    10
                )}.`
            ).with_overall_duration(2500)
        )
    )
    .then(
        new Parallel(
            new Parallel(
                new Render(
                    async ({ renderer, time }) => {
                        // renderer.batch(() => {
                        clear();
                        renderer.clear();
                        renderer.entity(new Ground(), 0, 0);
                        renderer.entity(
                            new Sun(),
                            renderer.width * 0.9,
                            (Math.sin(time / 60) * 0.05 + 0.05) *
                                renderer.height
                        );
                        renderer.entity(new Tree(), renderer.width * 0.9, 0);
                        // });
                    },
                    () => {
                        return new Promise(resolve => {});
                    }
                ).with_batch(true)
            ),
            new Loop(async game => {
                game.time++;
                game.renderer.refresh();

                try {
                    if (Math.random() < 0.01) {
                        await dialog('You sense danger nearby...');
                        await BattleEncounter.execute(game);
                        const won = !!game._lastCombatResult?.won;
                        if (won) await AfterWin.execute(game);
                        else await AfterLoss.execute(game);
                    }
                } catch (e) {
                    // don't let a battle break the main loop
                    console.error('Battle error', e);
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            })
        )
    );
