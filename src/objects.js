import {
    DARKER_GRASS_COLOR,
    GRASS_COLOR,
    TREE_HEIGHT,
    TREE_LEAF_COLOR,
    TREE_TRUNK_COLOR,
    TREE_TRUNK_HEIGHT,
    TREE_TRUNK_WIDTH,
    TREE_WIDTH
} from './constants.js';
import { Game } from './game.js';
import { Entity, RaytracingRenderer } from './raytracing.js';
import { Renderer } from './renderer.js';
import { circle } from './utils.js';

export class Ground extends Entity {
    layer = 1;
    outline = [
        {
            x: 0,
            y: Game.current.renderer.height * 0.65
        },
        {
            x: Game.current.renderer.width,
            y: Game.current.renderer.height * 0.65
        },
        {
            x: Game.current.renderer.width,
            y: Game.current.renderer.height
        },
        {
            x: 0,
            y: Game.current.renderer.height
        }
    ];
    /**
     * @param {Renderer} renderer
     */
    render(renderer) {
        const gradient = renderer.ctx.createLinearGradient(
            0,
            renderer.height * 0.65,
            0,
            renderer.height
        );
        gradient.addColorStop(0, GRASS_COLOR);
        gradient.addColorStop(1, DARKER_GRASS_COLOR);
        renderer.ctx.fillStyle = gradient;
        renderer.polygon(...this.outline);
    }
}

export class BattleGround extends Entity {
    layer = 1;
    outline = [
        {
            x: 0,
            y: Game.current.renderer.height * 0.45
        },
        {
            x: Game.current.renderer.width,
            y: Game.current.renderer.height * 0.45
        },
        {
            x: Game.current.renderer.width,
            y: Game.current.renderer.height
        },
        {
            x: 0,
            y: Game.current.renderer.height
        }
    ];
    /**
     * @param {Renderer} renderer
     */
    render(renderer) {
        const gradient = renderer.ctx.createLinearGradient(
            0,
            renderer.height * 0.45,
            0,
            renderer.height
        );
        gradient.addColorStop(0, GRASS_COLOR);
        gradient.addColorStop(1, DARKER_GRASS_COLOR);
        renderer.ctx.fillStyle = gradient;
        renderer.polygon(...this.outline);
    }
}

export class Moon extends Entity {
    outline = circle(40, 10);
    lighting = {
        level: 0.25,
        hue: /** @type {[number, number, number]} */ ([250, 250, 250]),
        spread:
            Math.max(
                Game.current.renderer.width,
                Game.current.renderer.height
            ) * 0.9,
        start_angle: 0,
        end_angle: 360,
        absorption: 0
    };
    layer = 0;
    /**
     * @param {Renderer} renderer
     * @param {number} x
     * @param {number} y
     */
    render(renderer, x, y) {
        renderer.ctx.fillStyle = '#ccc';
        renderer.polygon(
            ...this.outline.map(point => ({ x: point.x + x, y: point.y + y }))
        );
        renderer.ctx.fillStyle = '#bbb';
        renderer.circle(x + 55, y + 55, 10);
        renderer.circle(x + 20, y + 20, 12);
        renderer.circle(x + 50, y + 20, 10);
        renderer.circle(x + 15, y + 50, 8);
    }
}

export class Sun extends Entity {
    outline = circle(40, 10);
    lighting = {
        level: 0.25,
        hue: /** @type {[number, number, number]} */ ([250, 250, 120]),
        spread:
            Math.max(
                Game.current.renderer.width,
                Game.current.renderer.height
            ) * 0.9,
        start_angle: 0,
        end_angle: 360,
        absorption: 0
    };
    layer = 0;
    /**
     * @param {Renderer} renderer
     * @param {number} x
     * @param {number} y
     */
    render(renderer, x, y) {
        renderer.ctx.fillStyle = '#eda';
        renderer.polygon(
            ...this.outline.map(point => ({ x: point.x + x, y: point.y + y }))
        );
    }
}

export class Tree extends Entity {
    layer = 4;
    outline = [
        {
            x: TREE_TRUNK_WIDTH + TREE_WIDTH / 2,
            y: Game.current.renderer.height * 0.75
        },
        {
            x: TREE_WIDTH / 2,
            y: Game.current.renderer.height * 0.75
        },
        {
            x: TREE_WIDTH / 2,
            y: Game.current.renderer.height * 0.75 - TREE_TRUNK_HEIGHT
        },
        {
            x: 0,
            y: Game.current.renderer.height * 0.75 - TREE_TRUNK_HEIGHT
        },
        {
            x: TREE_TRUNK_WIDTH / 2 + TREE_WIDTH / 2,
            y:
                Game.current.renderer.height * 0.75 -
                (TREE_HEIGHT + TREE_TRUNK_HEIGHT)
        },
        {
            x: TREE_WIDTH + TREE_WIDTH / 2,
            y: Game.current.renderer.height * 0.75 - TREE_TRUNK_HEIGHT
        },
        {
            x: TREE_TRUNK_WIDTH + TREE_WIDTH / 2,
            y: Game.current.renderer.height * 0.75 - TREE_TRUNK_HEIGHT
        }
    ];
    constructor() {
        super();
        this.lighting = { ...this.lighting, absorption: 1 };
    }
    /**
     * @param {RaytracingRenderer} renderer
     * @param {number} x
     */
    render(renderer, x) {
        renderer.ctx.fillStyle = TREE_TRUNK_COLOR;
        renderer.rect(
            x + (TREE_WIDTH - TREE_TRUNK_WIDTH) / 2,
            renderer.height * 0.75 - TREE_TRUNK_HEIGHT,
            TREE_TRUNK_WIDTH,
            TREE_TRUNK_HEIGHT
        );
        renderer.ctx.fillStyle = TREE_LEAF_COLOR;
        renderer.polygon(
            {
                x,
                y: renderer.height * 0.75 - TREE_TRUNK_HEIGHT
            },
            {
                x: x + TREE_WIDTH / 2,
                y: renderer.height * 0.75 - (TREE_HEIGHT + TREE_TRUNK_HEIGHT)
            },
            {
                x: x + TREE_WIDTH,
                y: renderer.height * 0.75 - TREE_TRUNK_HEIGHT
            }
        );
    }
}

const canvas = document.createElement('canvas');
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

/**
 * @param {InstanceType<(typeof globalThis)['Image']>} image
 */
function get_outline(image) {
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.clearRect(0, 0, image.width, image.height);
    ctx.drawImage(image, 0, 0, image.width, image.height);
    const data = ctx.getImageData(0, 0, image.width, image.height);
    const outline = [];
    for (let index = 0; index < data.data.length; index += 4) {
        if (data.data[index] !== 0) {
            if (
                data.data[index + canvas.width * 4] === 0 ||
                data.data[index - canvas.width * 4] === 0 ||
                data.data[index - 4] === 0 ||
                data.data[index + 4] === 0
            ) {
                const x = (index / 4) % canvas.width;
                const y = (index / 4 - x) / canvas.width;
                outline.push({ x, y });
            }
        }
    }
    /** @type {Array<{ x: number; y: number }>} */
    const reduced = [];
    for (let i = 0; i < outline.length; i++) {
        const len = reduced.length;
        if (len < 3) {
            reduced.push(outline[i]);
            continue;
        }
        const prev_prev = reduced[len - 2];
        const prev = reduced[len - 1];
        const curr = outline[i];
        if (
            (prev_prev.x === prev.x && prev.x === curr.x) ||
            (prev_prev.y === prev.y && prev.y === curr.y) ||
            (curr.x - prev_prev.x === (curr.x - prev.x) * 2 &&
                curr.y - prev_prev.y === (curr.y - prev.y) * 2)
        ) {
            reduced[len - 1] = curr;
        } else {
            reduced.push(curr);
        }
    }
    console.log(reduced);
    return reduced;
}

const resolved = Promise.resolve();

/**
 * Creates an `Entity` based on an image.
 */
export class Image extends Entity {
    layer = 4;
    /** @type {Map<string, { image: InstanceType<(typeof globalThis)['Image']>; outline: Map<number, Array<{ x: number; y: number }>> }>} */
    static cache = new Map();

    /**
     * Loads an image into cache, returning a `Promise` that resolves when it is loaded.
     * @param {string} src
     */
    static preload(src, { width = 68, height = 68, scale = 1 } = {}) {
        const image = new Image(src, { width, height, scale });
        return image.promise;
    }
    /** @type {Array<{ x: number; y: number }>} */
    outline = [];
    /** @type {InstanceType<typeof globalThis['Image']>} */
    image;
    width;
    height;
    scale;
    promise;

    /**
     * @param {string} image
     */
    constructor(image, { width = 68, height = 68, scale = 1 } = {}) {
        super();
        this.scale = scale;
        this.width = width;
        this.height = height;
        if (Image.cache.has(image)) {
            const { image: cached, outline } =
                /** @type {{ image: InstanceType<(typeof globalThis)['Image']>; outline: Map<number, Array<{ x: number; y: number }>> }} */ (
                    Image.cache.get(image)
                );
            this.image = /** @type {HTMLImageElement} */ (
                cached.cloneNode(true)
            );
            this.image.width *= scale;
            this.image.height *= scale;
            this.outline = outline.has(scale)
                ? /** @type {Array<{ x: number; y: number }>} */ (
                      outline.get(scale)
                  )
                : get_outline(this.image);
            this.promise = resolved;
            return;
        }
        this.image = new globalThis.Image(width, height);
        this.image.src = image;
        /** @type {PromiseWithResolvers<void>} */
        const { promise, resolve } = Promise.withResolvers();
        this.promise = promise;
        this.image.addEventListener(
            'load',
            () => {
                const cloned = /** @type {HTMLImageElement} */ (
                    this.image.cloneNode(true)
                );
                console.log(this.image.width);
                this.outline = get_outline(this.image);
                Image.cache.set(image, {
                    image: cloned,
                    outline: new Map([[scale, this.outline]])
                });
                resolve();
            },
            { once: true }
        );
    }

    /**
     * @param {RaytracingRenderer} renderer
     * @param {number} x
     * @param {number} y
     */
    render(renderer, x, y) {
        // renderer.ctx.scale(this.scale, this.scale);
        renderer.ctx.drawImage(
            this.image,
            x,
            y,
            this.image.width * this.scale,
            this.height * this.scale
        );
    }
}
 
export class Animation extends Entity {
    /** @type {Entity[]} */
    entities = [];
    state = 0;

    /**
     * @param {Entity[]} entities
     */
    constructor(...entities) {
        super();
        this.entities = entities;
    }

    // @ts-expect-error
    get outline() {
        return this.entities[this.state].outline;
    }

    next() {
        this.state = this.state === this.entities.length - 1 ? 0 : this.state + 1;
    }

    /**
     * @param {Renderer} renderer
     * @param {number} x
     * @param {number} y
     */
    render(renderer, x, y) {
        this.entities[this.state].render(renderer, x, y);
    }
}
