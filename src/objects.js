import { DARKER_GRASS_COLOR, GRASS_COLOR, TREE_HEIGHT, TREE_LEAF_COLOR, TREE_TRUNK_COLOR, TREE_TRUNK_HEIGHT, TREE_TRUNK_WIDTH, TREE_WIDTH } from './constants.js';
import { Game } from './game.js';
import { Entity, RaytracingRenderer } from './raytracing.js';
import { Renderer } from './renderer.js';
import { circle } from './utils.js';

export class Ground extends Entity {
    layer = 0;
    outline = [{
        x: 0,
        y: Game.current.renderer.height * 0.65
    }, {
        x: Game.current.renderer.width,
        y: Game.current.renderer.height * 0.65
    }, {
        x: Game.current.renderer.width,
        y: Game.current.renderer.height
    }, {
        x: 0,
        y: Game.current.renderer.height
    }];
    /**
     * @param {Renderer} renderer
     */
    render(renderer) {
        const gradient = renderer.ctx.createLinearGradient(0, renderer.height * 0.65, 0, renderer.height);
        gradient.addColorStop(0, GRASS_COLOR);
        gradient.addColorStop(1, DARKER_GRASS_COLOR)
        renderer.ctx.fillStyle = gradient;
        renderer.polygon(...this.outline);
    }
}

export class Moon extends Entity {
    outline = circle(40, 10);
    lighting = {
        level: 0.25,
        hue: /** @type {[number, number, number]} */ ([250, 250, 250]),
        spread: Math.max(Game.current.renderer.width, Game.current.renderer.height) * 0.9,
        start_angle: 0,
        end_angle: 360,
        absorption: 0,
    };
    layer = 10;
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
        spread: Math.max(Game.current.renderer.width, Game.current.renderer.height) * 0.9,
        start_angle: 0,
        end_angle: 360,
        absorption: 0,
    };
    layer = 4;
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
            y: Game.current.renderer.height * 0.75,
        },
        {
            x: TREE_WIDTH / 2,
            y: Game.current.renderer.height * 0.75,
        },
        {
            x: TREE_WIDTH / 2,
            y: Game.current.renderer.height * 0.75 - TREE_TRUNK_HEIGHT,
        },
        {
            x: 0,
            y: Game.current.renderer.height * 0.75 - TREE_TRUNK_HEIGHT,
        },
        {
            x: TREE_TRUNK_WIDTH / 2 + TREE_WIDTH / 2,
            y: Game.current.renderer.height * 0.75 - (TREE_HEIGHT + TREE_TRUNK_HEIGHT),
        },
        {
            x: TREE_WIDTH + TREE_WIDTH / 2,
            y: Game.current.renderer.height * 0.75 - TREE_TRUNK_HEIGHT,
        },
        {
            x: TREE_TRUNK_WIDTH + TREE_WIDTH / 2,
            y: Game.current.renderer.height * 0.75 - TREE_TRUNK_HEIGHT,
        },
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
                y: renderer.height * 0.75 - TREE_TRUNK_HEIGHT,
            },
            {
                x: x + TREE_WIDTH / 2,
                y: renderer.height * 0.75 - (TREE_HEIGHT + TREE_TRUNK_HEIGHT),
            },
            {
                x: x + TREE_WIDTH,
                y: renderer.height * 0.75 - TREE_TRUNK_HEIGHT,
            }
        );
    }
}
