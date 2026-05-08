/** @import { DIFFICULTY } from './constants.js' */
/** @import { RaytracingRenderer } from './raytracing.js' */
import { Player } from './character.js';
import { ORIENTATIONS } from './constants.js';
import { find_root, Step, story } from './story.js';
import { items } from './obtainables.js';

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
     * @type {{ won?: boolean, difficulty: (typeof DIFFICULTY)[keyof typeof DIFFICULTY] } | undefined}
     */
    last_combat_result;
    /** @type {Step | null} */
    current_step = null;
    /** @type {RaytracingRenderer} */
    renderer;
    /** @type {number[]} */
    step_sequence = [];
    time = 140; // offset it a bit so it starts at daytime
    paused = false;
    resume_promise = Promise.resolve();
    resolve = () => {};
    pause() {
        /** @type {PromiseWithResolvers<void>} */
        const { promise, resolve } = Promise.withResolvers();
        this.resume_promise = promise;
        this.resolve = resolve;
        this.paused = true;
    }
    resume() {
        this.paused = false;
        this.resolve();
    }
    /**
     * @param {RaytracingRenderer} renderer
     */
    constructor(renderer) {
        Game.current ??= this;
        this.renderer = renderer;
        this.load();
        document.body.addEventListener('keydown', e => {
            if (this.player === undefined) {
                return;
            }
            if (e.key === 'ArrowLeft') {
                this.player.direction = ORIENTATIONS.WEST;
                this.player.x--;
            } else if (e.key === 'ArrowRight') {
                this.player.direction = ORIENTATIONS.EAST;
                this.player.x++;
            } else {
                this.player.direction =
                    this.player.direction === ORIENTATIONS.WEST
                        ? ORIENTATIONS.NORTHWEST
                        : this.player.direction === ORIENTATIONS.EAST
                          ? ORIENTATIONS.NORTHEAST
                          : this.player.direction;
            }
        });
        document.body.addEventListener('keyup', e => {
            if (this.player === undefined) {
                return;
            }
            if (e.key === 'ArrowLeft') {
                this.player.direction = ORIENTATIONS.NORTHWEST;
            } else if (e.key === 'ArrowRight') {
                this.player.direction = ORIENTATIONS.NORTHEAST;
            }
        });
        if (this.current_step !== null) {
            return;
        }
        this.current_step = Game.story;
        console.log(this.current_step);
        /**
         * Due to the way the `Step` class and its extenders work,
         * the chaining may return a step far away from the first step.
         * So, we have to climb back up the tree of steps to find the first one.
         */
        this.current_step = find_root(this.current_step);
        console.log(this.current_step);
    }

    async update() {
        if (this.current_step === null) {
            return;
        }
        await this.current_step.execute(this);
        this.step_sequence.push(this.current_step.id);
        this.current_step = this.current_step.next;
        console.log(this.current_step);
        this.save();
    }

    save() {
        localStorage.game = JSON.stringify({
            steps: this.step_sequence,
            player: this.player,
            time: this.time
        });
    }

    load() {
        if (localStorage.game !== undefined) {
            const { player, steps, time } = JSON.parse(localStorage.game);
            this.time = time;
            player.inventory = player.inventory.map((/** @type {string} */ name) => items.find(item => item.name === name));
            console.log(player);
            this.player = Object.assign(new Player(player.name, player.character), player);
            this.step_sequence = steps;
            this.current_step = Step.goto(
                /** @type {number} */ (this.step_sequence.pop())
            );
        }
    }
}
