/** @import { Game } from './game.js' */
import { Player } from './character.js';
import { Entity, createEnemyByName } from './combat.js';
import {
    CHARACTER_CHOICES,
    DIFFICULTY,
    STATES,
    TIME_SLOWDOWN
} from './constants.js';
// import { Ground, Knight, Moon, Sun, Tree } from './objects.js';
import { Renderer } from './renderer.js';
import { clear, dialog, health, input, select, status_bar } from './ui.js';
import { CombatBuilder, pickEnemiesForDifficulty } from './battle.js';
import { items, spells, potions, getArmorForRarity } from './obtainables.js';
import { asset, interpolate, sleep } from './utils.js';
import { Ground, Image, Moon, Sun, TallGround } from './objects.js';

/**
 * Base class for story building purposes.
 * A `Step` is a node in a tree of linked lists representing the story.
 */
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
    async execute(game) {
        game;
    }
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

/**
 * A `Step` to use when branching occurs.
 */
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

/**
 * A simple `Step` that runs the given function once.
 */
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

class BattleEncounter extends Step {
    state = STATES.BATTLE;

    /** @type {{
     *   type: "random" | "specific",
     *   difficulty: (typeof DIFFICULTY)[keyof typeof DIFFICULTY],
     *   enemy?: string
     * }}
     */
    config;

    static Loss = class Loss extends Step {
        /**
         * @param {*} game 
         */
        async execute(game) {
            await dialog(
                'You were defeated... You awaken later, bruised but alive.'
            );
            if (game.player) {
                game.player.health = Math.max(
                    1,
                    Math.floor((game.player.max_life || 100) * 0.5)
                );
                if (game.player.extra_lives > 0) game.player.extra_lives -= 1;
            }
        }
    };

    static Win = class Win extends Step {
        /**
         * @param {*} game 
         */
        async execute(game) {
            await dialog('You defeated your foes!');
            if (!game.player) return;

            game.player.stamina = Math.min(
                game.player.max_stamina,
                game.player.stamina + 10
            );
            game.player.mana = Math.min(
                game.player.max_mana,
                game.player.mana + 5
            );
            game.player.luck = (game.player.luck || 0) + 1;

            const difficulty =
                game.last_combat_result?.difficulty ?? DIFFICULTY.MEDIUM;

            let minMoney = 25,
                maxMoney = 100,
                tier = 1;
            switch (difficulty) {
                case DIFFICULTY.EASY:
                    minMoney = 25;
                    maxMoney = 100;
                    tier = 0;
                    break;
                case DIFFICULTY.MEDIUM:
                    minMoney = 200;
                    maxMoney = 600;
                    tier = 1;
                    break;
                case DIFFICULTY.HARD:
                    minMoney = 1200;
                    maxMoney = 5000;
                    tier = 2;
                    break;
            }

            const money = interpolate(minMoney, maxMoney, Math.random());
            game.player.money = (game.player.money || 0) + money;

            const sorted = items.toSorted(
                (a, b) => (a.value || 0) - (b.value || 0)
            );
            const third = Math.max(1, Math.floor(sorted.length / 3));
            let pool =
                tier === 0
                    ? sorted.slice(0, third)
                    : tier === 1
                      ? sorted.slice(third, third * 2)
                      : sorted.slice(third * 2);

            if (pool.length === 0) pool = sorted;

            const item = pool[Math.floor(Math.random() * pool.length)];
            game.player.inventory = game.player.inventory || [];
            game.player.inventory.push(item);

            const potionPool = potions || [];
            let potionCandidates = potionPool;
            if (difficulty === DIFFICULTY.EASY)
                potionCandidates = potionPool.filter(
                    p => (p.costs?.common ?? p.costs ?? 0) < 200
                );
            else if (difficulty === DIFFICULTY.MEDIUM)
                potionCandidates = potionPool.filter(
                    p => (p.costs?.rare ?? p.costs ?? 0) < 2000
                );

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
                            armorPool[
                                Math.floor(Math.random() * armorPool.length)
                            ]
                        )
                    );
                    game.player.inventory.push(chosenArmor);
                }
            }

            const spellChance =
                difficulty === DIFFICULTY.EASY
                    ? 0.2
                    : difficulty === DIFFICULTY.MEDIUM
                      ? 0.5
                      : 0.8;

            if (Math.random() < spellChance && spells.length > 0) {
                const targetRarity =
                    difficulty === DIFFICULTY.EASY
                        ? 'common'
                        : difficulty === DIFFICULTY.MEDIUM
                          ? 'rare'
                          : 'epic';

                const candidates = spells.filter(s => true);
                const chosenSpell = JSON.parse(
                    JSON.stringify(
                        candidates[
                            Math.floor(Math.random() * candidates.length)
                        ]
                    )
                );
                game.player.spells = game.player.spells || [];
                game.player.spells.push(chosenSpell);
            }

            await dialog(`You found ${item.name} and ${money} copper!`);
        }
    };

    /**
     * @param {{
     *   type: "specific",
     *   enemy: string,
     *   difficulty?: (typeof DIFFICULTY)[keyof typeof DIFFICULTY]
     * } | (typeof DIFFICULTY)[keyof typeof DIFFICULTY]} config
     */
    constructor(config) {
        super();

        if (typeof config === 'string') {
            this.config = {
                type: 'random',
                difficulty: config
            };
        } else {
            this.config = {
                type: 'specific',
                enemy: config.enemy,
                difficulty: config.difficulty ?? DIFFICULTY.MEDIUM
            };
        }

        this.next.prev = this;
    }

    next = new Branch(game => {
        return game.last_combat_result?.won ? 0 : 1;
    }).with_branches(new BattleEncounter.Win(), new BattleEncounter.Loss());

    /**
     * @param {*} step 
     * @returns 
     */
    then(step) {
        this.next.next = step;
        step.prev = this.next;
        return step;
    }

    /**
     * @param {*} game 
     */
    async execute(game) {
        await dialog('You sense danger nearby...');

        const difficulty = this.config.difficulty ?? DIFFICULTY.MEDIUM;

        let enemies;
        if (this.config.type === 'specific') {
            enemies = [createEnemyByName(this.config.enemy)];
        } else {
            enemies = pickEnemiesForDifficulty(difficulty);
        }

        const combat = new CombatBuilder()
            .with_difficulty(difficulty)
            .with_player(game.player)
            .with_enemies(enemies)
            .build();

        const result = await combat.start();
        game.last_combat_result = { ...result, difficulty };
    }
}

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
    // @ts-expect-error
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
     * @param {RegExp} pattern
     */
    with_matcher(pattern) {
        // @ts-expect-error
        this.validator = input => pattern.test(input);
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

    /**
     * @param {*} choices
     * @returns {this}
     */
    with_choices(choices) {
        this.choices = choices;
        return this;
    }

    /**
     * @param {*} game
     * @returns
     */
    async execute(game) {
        await dialog(this.dialog, this.render_icon);

        if (!this.choices || this.choices.length === 0) return;

        const labels = this.choices.map(/** @param {choice} c */ c => c.text);

        const selectedText = await select(this.dialog, labels);
        const index = labels.indexOf(selectedText);
        const choice = this.choices[index];

        if (choice.align !== null && choice.align !== undefined) {
            game.player.alignment = choice.align;
        }

        this.next = choice.next;
    }
}

/**
 * Executes a group of `Step`s in parallel.
 */
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
    /** @type {number | null} */
    delay = null;
    /**
     * @param {(game: Game) => (Promise<void> | void)} fn
     */
    constructor(fn) {
        super();
        this.body = fn;
    }

    /**
     * @param {number | null} delay
     */
    with_delay(delay) {
        this.delay = delay;
        return this;
    }

    /**
     * @param {(game: Game) => boolean} condition
     */
    until(condition) {
        this.condition = game => !condition(game);
        return this;
    }

    /**
     * @param {(game: Game) => boolean} condition
     */
    while(condition) {
        this.condition = condition;
        return this;
    }

    /**
     * @param {Game} game
     */
    async execute(game) {
        while (this.condition(game)) {
            await this.body(game);
            if (this.delay !== null) {
                const delay = this.delay;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}

class LoopedGroup extends Loop {
    /**
     * @param {Step} step
     */
    constructor(step) {
        super(async game => await step.execute(game));
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

/**
 * @param {*} dialogText
 * @param {*} choices
 * @returns {Step}
 */
function Choice(dialogText, choices) {
    return new Dialog(dialogText).then(
        new Branch(async _game => {
            const labels = choices.map(/** @param {*} c */ c => c.text);
            const selected = await select(dialogText, labels);
            return labels.indexOf(selected);
        }).with_branches(
            ...choices.map(
                /** @param {*} c */ c => {
                    const step = c.next;
                    return new Execute(game => {
                        if (c.align !== null && c.align !== undefined) {
                            game.player.alignment = c.align;
                        }
                    }).then(step);
                }
            )
        )
    );
}

/**
 * @param {*} title
 * @param {*} inventory
 * @returns {Step}
 */
function Shop(title, inventory) {
    return new Dialog(title).then(
        new Branch(async _game => {
            const labels = inventory.map(
                /** @param {*} i */ i => `${i.name} — ${i.value}c`
            );
            labels.push('Leave shop');
            const selected = await select(title, labels);
            return labels.indexOf(selected);
        }).with_branches(
            ...inventory.map(
                /** @param {*} item */ item =>
                    new Execute(game => {
                        if ((game.player.money || 0) >= item.value) {
                            game.player.money -= item.value;
                            game.player.inventory.push(
                                JSON.parse(JSON.stringify(item))
                            );
                        }
                    }).then(new Dialog('You continue shopping.'))
            ),
            new Dialog('You leave the shop.')
        )
    );
}

/**
 * @param {*} difficulty
 * @returns {Step}
 */
function Encounter(difficulty) {
    return new BattleEncounter(difficulty).then(
        new Dialog('You survived the encounter.')
    );
}

/**
 * @param {string} enemyName
 * @param {(typeof DIFFICULTY)[keyof typeof DIFFICULTY]} [difficulty]
 */
function EncounterWith(enemyName, difficulty = DIFFICULTY.MEDIUM) {
    return new BattleEncounter({
        type: 'specific',
        enemy: enemyName,
        difficulty
    }).then(new Dialog(`You defeated the ${enemyName}.`));
}

/**
 * @param {*} name
 * @returns
 */
function GiveItemByName(name) {
    return new Execute(game => {
        const reward = items.find(i => i.name === name);
        if (!reward) return;
        game.player.inventory = game.player.inventory || [];
        game.player.inventory.push(JSON.parse(JSON.stringify(reward)));
    });
}

/**
 * @param {*} rarity
 * @returns {Step}
 */
function GiveItemByRarity(rarity) {
    return new Execute(game => {
        const sorted = items.toSorted(
            (a, b) => (a.value || 0) - (b.value || 0)
        );
        const third = Math.max(1, Math.floor(sorted.length / 3));

        let pool = [];

        switch (rarity) {
            case 'common':
                pool = sorted.slice(0, third);
                break;

            case 'rare':
                pool = sorted.slice(third, third * 2);
                break;

            case 'epic':
                pool = sorted.slice(third * 2);
                break;

            default:
                pool = sorted;
                break;
        }

        if (pool.length === 0) return;

        const reward = pool[Math.floor(Math.random() * pool.length)];

        game.player.inventory = game.player.inventory || [];
        game.player.inventory.push(JSON.parse(JSON.stringify(reward)));
    });
}

/**
 * @param {*} name
 * @returns
 */
function GiveSpellByName(name) {
    return new Execute(game => {
        const spell = spells.find(s => s.name === name);
        if (!spell) return;

        game.player.spells = game.player.spells || [];
        game.player.spells.push(JSON.parse(JSON.stringify(spell)));
    });
}

localStorage.name ??= '';
// new LoopedGroup(
//     new Branch(() => {
//         const random = Math.random();
//         return random < 1 ? 0 : 1;
//     }).with_branches(new BattleEncounter(DIFFICULTY.MEDIUM), null)
// ).with_delay(100),
const cobblestone = new Image(asset('background/cobblestone.png'), {
    width: 16,
    height: 16,
    scale: 2
});
export const story = new Parallel(
    new Input('Choose a name.')
        .with_validator(
            // @ts-expect-error
            (/** @type {string} */ value) =>
                typeof value === 'string' && value.length > 0
        )
        .with_max_length(15)
        .handle((/** @type {string} */ value) => {
            localStorage.name = value;
        }),
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
                    await sleep(125);
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
        new Execute(({ player }) => {
            clear();
            status_bar(() => {
                health(player.health / player.max_life);
            });
        })
    )
    .then(
        new Parallel(
            new Execute(async ({ renderer, player }) => {
                await renderer.batch(async () => {
                    // renderer.clear();
                    renderer.entity(new TallGround(), 0, 0);
                    await cobblestone.promise;
                    // for (let i = 0; i < 100; i++) {
                    //     renderer.entity(cobblestone, renderer.width * (i / 100), renderer.height * (i / 100));
                    // }
                    for (let x = 0; x < renderer.width; x += 32) {
                        for (
                            let y = renderer.height * 0.55;
                            y < renderer.height * 0.65;
                            y += 32
                        ) {
                            renderer.entity(cobblestone, x, y);
                        }
                    }
                });
            }),
            // new Dialog('You awaken to the sound of someone calling your name')
            //                 .with_overall_duration(2000)
            //                 .then(
            //                     new Parallel(

            //                     )
            // ),
            // new Branch(game => game.player.character === CHARACTER_CHOICES.KNIGHT ? 0 : game.player.character === CHARACTER_CHOICES.SLAVE ? 1 : 2)
            //     .with_branches(
            //         new Step(),
            //         new Step(),
            //             new Dialog('You awaken to the sound of someone calling your name')
            //                 .with_overall_duration(2000)
            //                 .then(
            //                     new Parallel(
            //                         new Render(async ({ renderer, player }) => {
            //                             await renderer.batch(() => {
            //                                 const cobblestone = new Image(asset('background/cobblestone.png'), { width: 16, height: 16, scale: 2 });
            //                                 for (let x = 0; x < renderer.width; x += 32) {
            //                                     for (let y = renderer.height * 0.75; y < renderer.height * 0.825; y += 32) {
            //                                         renderer.entity(cobblestone, x, y);
            //                                     }
            //                                 }
            //                             });
            //                         },
            //                         game => sleep(2000))
            //                     )
            //                 )
            //     ),
            // This loop is the way that time works
            // DO NOT PUT ANYTHING ELSE HERE, YOU WILL LITERALLY STOP TIME ITSELF
            new Loop(async game => {
                await Promise.resolve();
                game.time++;
                game.renderer.refresh();
                game.save();
                await sleep(100);
            })
        )
    );

export {
    Execute,
    Branch,
    Dialog,
    Choice,
    Shop,
    Encounter,
    GiveItemByName,
    GiveItemByRarity,
    GiveSpellByName,
    EncounterWith
};
