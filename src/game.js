import { Player } from './character.js';
import { RaytracingRenderer } from './raytracing.js';
import { Step, story } from './story.js';

/**
 * @template T
 */
class States {
    #flags = 0;
    #masks = new Map();
    /**
     * @param {T[]} keys
     */
    constructor(...keys) {
        let shift = 0;
        for (const key of keys) {
            this.#masks.set(key, 1 << shift++);
        }
    }
    /**
     * @param {T} key
     */
    get(key) {
        return (this.#flags & this.#masks.get(key)) !== 0;
    }
}

class Battle {
    opponents = [];
}

class Trade {
    offers = [];
}

class Dialogue {
    previous = [];
}

export class Game {
    /** @type {Game} */
    static current;
    /** @type {Step} */
    static story = story;
    /** @type {Player} */
    // @ts-expect-error
    player;
    /**
     * Optional holder for the last combat result produced by `BattleEncounter`.
     * @type {{ won?: boolean, details?: any } | undefined}
     */
    _lastCombatResult;
    /** @type {Step | null} */
    current_step = null;
    /** @type {RaytracingRenderer} */
    renderer;
    /** @type {number[]} */
    step_sequence = [];
    time = 0;
    /**
     * @param {RaytracingRenderer} renderer
     */
    constructor(renderer) {
        Game.current ??= this;
        this.renderer = renderer;
        this.load();
        if (this.current_step !== null) {
            return;
        }
        this.current_step = Game.story;
        while (this.current_step?.prev || this.current_step?.parent) {
            if (this.current_step.prev !== null) {
                this.current_step = this.current_step.prev;
            } else if (this.current_step.parent !== null) {
                this.current_step = this.current_step.parent;
            }
        }
    }

    async update() {
        if (this.current_step === null) {
            return;
        }
        await this.current_step.execute(this);
        this.step_sequence.push(this.current_step.id);
        this.current_step = this.current_step.next;
        this.save();
    }

    save() {
        localStorage.game = JSON.stringify({
            steps: this.step_sequence,
            player: this.player
        });
    }

    load() {
        if (localStorage.game !== undefined) {
            const { player, steps } = JSON.parse(localStorage.game);
            this.player = Object.assign(new Player('', 1), player);
            this.step_sequence = steps;
            this.current_step = Step.goto(/** @type {number} */ (this.step_sequence.pop()));
        }
    }
}
