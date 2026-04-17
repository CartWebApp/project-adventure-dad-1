import { Entity } from './combat.js';
import { STATES } from './constants.js';
import { Game } from './game.js';

export class Step {
    /** @type {(typeof STATES)[keyof typeof STATES]} */
    state;
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
    async execute(game) {
        
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

class Branch extends Step {
    determiner;

    /** @type {Step[]} */
    branches;

    /**
     * @param {(game: Game) => number | Promise<number>} determiner
     */
    constructor(determiner) {
        super();
        this.determiner = determiner;
    }

    /**
     * @param {Step[]} branches
     */
    with_branches(...branches) {
        this.branches = branches;
        for (const branch of branches) {
            branch.parent = this;
        }
        return this;
    }

    then = null;

    async execute(game) {
        const branch = this.branches[await this.determiner(game)];
        await branch.execute(game);
    }
}

class Battle extends Step {
    /** @type {(game: Game) => Entity[] | Promise<Entity[]>} */
    opponents = () => [];
    state = STATES.BATTLE;
    won = false;
    #if_won = null;
    #if_lost = null;
    constructor() {
        super();
    }

    /**
     * @param {(game: Game) => Entity[] | Promise<Entity[]>} opponents
     */
    with_opponents(opponents) {
        this.opponents = opponents;
        return this;
    }

    async execute(game) {
        const opponents = await this.opponents(game);
        
    }

    /**
     * @param {Step} step
     */
    if_won(step) {
        this.#if_won = step;
        this.next = new Branch(() => this.won ? 0 : 1).with_branches(this.#if_won, this.#if_lost);
        return this;
    }

    /**
     * @param {Step} step
     */
    if_lost(step) {
        this.#if_lost = step;
        this.next = new Branch(() => this.won ? 0 : 1).with_branches(this.#if_won, this.#if_lost);
        return this;
    }
}

Game.story = new Branch(() => {

}).with_branches()