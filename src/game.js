/** @import { Step } from './story.js' */

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
    /** @type {Step} */
    static story;
    player;
    /** @type {Step | null} */
    current_step = null;
    constructor() {
        this.current_step = Game.story;
    }

    async update() {
        if (this.current_step === null) {
            return;
        }
        await this.current_step.execute(this);
        this.current_step = this.current_step.next;
    }
}
