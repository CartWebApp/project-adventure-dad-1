/** @import { Step } from './story.js' */

import { RaytracingRenderer } from './raytracing.js';
import { Renderer } from './renderer.js';

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
    /** @type {RaytracingRenderer} */
    renderer;
    /**
     * @param {RaytracingRenderer} renderer
     */
    constructor(renderer) {
        this.renderer = renderer;
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
        this.current_step = this.current_step.next;
    }
}
