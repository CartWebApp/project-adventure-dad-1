import { Player } from './character.js';
import { Entity } from './combat.js';
import { CHARACTER_CHOICES, STATES } from './constants.js';
import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { dialog, input, select } from './ui.js';

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

export class Parallel extends Step {
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

localStorage.name ??= '';

Game.story = new Parallel(
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
                `Excellent choice${'​'.repeat(10)}.${'​'.repeat(
                    10
                )}.${'​'.repeat(10)}.`
            ).with_overall_duration(2500)
        )
    );
