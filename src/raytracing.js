/// <reference lib="es2023" />
import { Renderer } from './renderer.js';
import {
    interpolate,
    InterpolatingDoubleTreeMap,
    InterpolatingEntityMap
} from './utils.js';

// i wish js had interfaces, this would make this so much easier
// (and also get rid of the overhead that comes with inheritance)
export class Entity {
    /** @type {Array<{ x: number; y: number }>} */
    outline = [];
    opacity = 1;
    layer = Infinity;
    lighting = {
        /** the brightness of the light, a number between 0 and 1 */
        level: 0,
        /** the hue of the light, an array of three integers between 0 and 255 representing r, g, and b */
        hue: /** @type {[number, number, number]} */ ([0, 0, 0]),
        /** the spread of the light, an integer between 0 and the width/height of the display (whichever is larger) */
        spread: 0,
        /** the starting angle of the light arc, an integer between 0 and 360 */
        start_angle: 0,
        /** the ending angle of the light arc, an integer between 0 and 360 greater than the `start_angle` */
        end_angle: 0,
        /** how much light is absorbed by the entity, a number between 0 and 1 */
        absorption: 0
    };
    /**
     * @param {Renderer} renderer
     * @param {number} x
     * @param {number} y
     */
    async render(renderer, x, y) {}
}

/**
 * Given points `a` and `b` and integer `precision`, returns an array of points between `a` and `b`.
 * The amount of points can be determined by multiplying the distance of `a` and `b` by `precision`.
 * Example:
 * ```js
 * points_between(
 *    {
 *       x: 0,
 *       y: 0
 *    },
 *    {
 *       x: 2,
 *       y: 2
 *    },
 *    2
 * );
 * [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }, { x: 1.5, y: 1.5 }, { x: 2, y: 2 }];
 * ```
 * @param {{ x: number; y: number }} a
 * @param {{ x: number; y: number }} b
 * @param {number} [precision]
 */
function points_between(a, b, precision = 1) {
    const points = [];
    const delta_x = Math.sign(b.x - a.x) / precision;
    const delta_y = Math.sign(b.y - a.y) / precision;
    let { x, y } = a;
    while (x < b.x && y < b.y) {
        points.push({ x, y });
        x += delta_x;
        y += delta_y;
    }
    points.push(b);
    return points;
}

/**
 * @param {Array<{ x: number; y: number }>} points
 */
function center(...points) {
    const x_points = points.map(({ x }) => x);
    const y_points = points.map(({ y }) => y);
    return {
        x: (Math.min(...x_points) + Math.max(...x_points)) / 2,
        y: (Math.min(...y_points) + Math.max(...y_points)) / 2
    };
}

/**
 * Returns the slope of a line between `origin` and `point`.
 * @param {{ x: number; y: number }} origin
 * @param {{ x: number; y: number }} point
 */
function slope(origin, point) {
    return /** @type {[number, number]} */ ([
        point.y - origin.y,
        point.x - origin.x
    ]);
}

/**
 * Returns the angle of a line between an `origin` and `point` in radians.
 * @param {{ x: number; y: number }} origin
 * @param {{ x: number; y: number }} point
 */
function angleof(origin, point) {
    const [rise, run] = slope(origin, point);
    const tanθ = rise / run;
    const angle = Math.atan(tanθ);
    return angle;
}

/**
 * Given an array of points `points`, and degrees `start` and `end`, returns an array of points that contains all `points` that are in the arc from angles `start` to `end`.
 * @param {Array<{ x: number; y: number }>} points
 * @param {number} start
 * @param {number} end
 */
function slice(points, start, end) {
    start -= 180;
    end -= 180;
    start = Math.PI * (start / 180);
    end = Math.PI * (end / 180);
    /** @type {Array<{ x: number; y: number }>} */
    const slice = [];
    const len = points.length;
    const origin = center(...points);
    for (let i = 0; i < len; i++) {
        const point = points[i];
        const angle = angleof(origin, point);
        if (angle > start && angle < end) {
            slice.push(point);
        }
    }
    return slice;
}

/**
 * @param {{ x: number; y: number }} start
 * @param {{ x: number; y: number }} end
 */
function delta(start, end) {
    return Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
}

/**
 * An extension of the offscreen renderer with raytracing capabilities.
 * Unlike `Renderer` and `Renderer.Offscreen`, the `RaytracingRenderer` is best used with the `Entity` class, which provides lighting information.
 * With this, you can define light sources and how various elements react to and transform light that passes through them.
 * Performance is dependent on the number of entities, the configured `precision`, and the amount of points each entity's outline has.
 * This also allows you to configure how each entity is layered, making the `RaytracingRenderer` well-suited for more decentralized use.
 * Due to differences in how the raytracing renderer works as opposed to other renderers, a `background` callback must be passed to add consistent backgrounds.
 */
export class RaytracingRenderer extends Renderer.Offscreen {
    /**
     * For performance and UX, we use two canvases for the raytracing rendererer.
     * While one is being painted to, we show the other. When the paint has completed,
     * we swap the canvases. Otherwise, excessive flickering will occur.
     * TODO this seems to work at least at the beginning, but seems to regress to a (albeit different) flickery state after a few minutes.
     */
    #alt_frame = document.createElement('canvas');
    #alt_frame_ctx;
    #current_frame;
    #current_ctx;
    #hidden_frame = this.#alt_frame;
    #hidden_ctx;
    /**
     * @param {HTMLCanvasElement} offscreen
     * @param {HTMLCanvasElement} display
     * @param {(renderer: RaytracingRenderer) => void} [background]
     * @param {(canvas: HTMLCanvasElement | OffscreenCanvas) => HTMLCanvasElement | OffscreenCanvas} [render_pass]
     */
    constructor(
        offscreen,
        display,
        background = () => {},
        render_pass = canvas => canvas
    ) {
        super(offscreen, display, render_pass);
        this.#current_frame = display;
        this.#current_ctx = this.display_ctx;
        this.#alt_frame.width = this.width;
        this.#alt_frame.height = this.height;
        this.#alt_frame.style.zIndex = '1';
        this.#current_frame.style.zIndex = '2';
        this.#alt_frame.className = 'raytraced';
        this.#alt_frame_ctx = /** @type {CanvasRenderingContext2D} */ (
            this.#alt_frame.getContext('2d')
        );
        this.#alt_frame_ctx.imageSmoothingEnabled = false;
        this.#hidden_ctx = this.#alt_frame_ctx;
        document.body.appendChild(this.#alt_frame);
        this.#background = background;
        this.#light_dissipation.set(10, 0.99);
        this.#light_dissipation.set(50, 0.995);
        this.#light_dissipation.set(100, 0.998505);
    }

    #queued_render = false;
    /** @type {Array<{ x: number; y: number; entity: Entity }>} */
    #entities = [];
    #map = new InterpolatingEntityMap();
    #background;

    /** how much precision to use for raytracing */
    precision = 1;

    /** Promise that resolves when rendering has completed */
    promise = Promise.resolve();

    /**
     * @param {() => void} fn
     */
    batch(fn) {
        this.#queued_render = true;
        this.ctx.save();
        fn();
        this.ctx.restore();
        this.#render();
    }

    /**
     * @param {() => Promise<void>} fn
     */
    // @ts-expect-error
    async batch_async(fn) {
        this.#queued_render = true;
        this.ctx.save();
        await fn();
        this.ctx.restore();
        await this.#render();
    }

    #queue_render() {
        if (this.#queued_render) {
            return;
        }
        let { resolve, promise } = /** @type {PromiseWithResolvers<void>} */ (
            Promise.withResolvers()
        );
        this.promise = promise;
        this.#queued_render = true;
        requestAnimationFrame(async () => {
            await this.#render();
            resolve();
        });
    }

    async #render() {
        const entities = [...this.#entities].toSorted(
            (a, b) => a.entity.layer - b.entity.layer
        );
        await new Promise(resolve => requestAnimationFrame(resolve));
        this.#entities.length = 0;
        [this.#hidden_frame.style.zIndex, this.#current_frame.style.zIndex] = [
            this.#current_frame.style.zIndex,
            this.#hidden_frame.style.zIndex
        ];
        [this.#current_ctx, this.#hidden_ctx] = [
            this.#hidden_ctx,
            this.#current_ctx
        ];
        [this.#current_frame, this.#hidden_frame] = [
            this.#hidden_frame,
            this.#current_frame
        ];
        this.display = this.#hidden_frame;
        this.display_ctx = this.#hidden_ctx;
        try {
            await super.batch_async(async () => {
                super.clear();
                this.#background(this);
                // console.log(this.#map);
                for (const e of entities) {
                    const { entity, x, y } = e;
                    this.ctx.save();
                    const points = entity.outline
                        .map(point => ({ x: point.x + x, y: point.y + y }))
                        .flatMap((point, i, array) =>
                            points_between(
                                point,
                                array[i + 1] ?? array[0],
                                this.precision
                            )
                        );
                    if (this.#is_on_screen(e)) {
                        await entity.render(this, x, y);
                    }
                    // TODO make this better
                    // we need to accurately determine whether it is safe to skip the raytracing of an entity
                    // if (entity.lighting.level === 0 && entity.lighting.absorption === 1) {
                    //     this.ctx.restore();
                    //     continue;
                    // }
                    // console.log(entity);
                    if (
                        entity.lighting.start_angle ===
                            entity.lighting.end_angle ||
                        entity.lighting.level === 0
                    ) {
                        this.ctx.restore();
                        continue;
                    }
                    /** points from which to start raytracing */
                    const raytracing_points = slice(
                        points,
                        entity.lighting.start_angle,
                        entity.lighting.end_angle
                    );
                    raytracing_points.push(raytracing_points[0]);
                    // console.log({raytracing_points});
                    // console.log(raytracing_points);
                    const origin = center(...points);
                    // this.#image = this.ctx.getImageData(0, 0, this.width, this.height);
                    for (const point of raytracing_points) {
                        const [rise, run] = slope(origin, point);
                        this.#trace_ray(
                            e.entity,
                            point.x,
                            point.y,
                            run / this.precision,
                            rise / this.precision,
                            entity.lighting
                        );
                    }
                    this.#last_points = null;
                    this.ctx.restore();
                }
                this.#queued_render = false;
            });
        } catch (err) {
            console.log(err);
        }
        await new Promise(resolve => requestAnimationFrame(resolve));
        requestAnimationFrame(() => {
            [
                this.#hidden_frame.style.zIndex,
                this.#current_frame.style.zIndex
            ] = [
                this.#current_frame.style.zIndex,
                this.#hidden_frame.style.zIndex
            ];
            [this.#current_ctx, this.#hidden_ctx] = [
                this.#hidden_ctx,
                this.#current_ctx
            ];
            [this.#current_frame, this.#hidden_frame] = [
                this.#hidden_frame,
                this.#current_frame
            ];
            this.display = this.#hidden_frame;
            this.display_ctx = this.#hidden_ctx;
        });
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} delta_x
     * @param {number} delta_y
     * @param {number} min_x
     * @param {number} max_x
     * @param {number} min_y
     * @param {number} max_y
     */
    #generate_points(x, y, delta_x, delta_y, min_x, max_x, min_y, max_y) {
        const points = [];
        while (x > min_x && x < max_x && y > min_y && y < max_y) {
            points.push({ x, y });
            x += delta_x;
            y += delta_y;
        }
        return points;
    }

    /** @type {Map<string, Array<{ x: number; y: number }>>} */
    #ray_cache = new Map();
    /**
     * @param {number} r
     * @param {number} g
     * @param {number} b
     */
    #serialize_color(r, g, b, alpha = 1) {
        const R = r.toString(16);
        const G = g.toString(16);
        const B = b.toString(16);
        const A = ((alpha * 255) | 0).toString(16);
        return `#${R.length === 1 ? '0' : ''}${R}${
            G.length === 1 ? '0' : ''
        }${G}${B.length === 1 ? '0' : ''}${B}${A.length === 1 ? '0' : ''}${A}`;
    }

    /** @type {Array<{ x: number; y: number }> | null} */
    #last_points = null;
    /** @type {Array<{ x: number; y: number }> | null} */
    #prev_last_points = null;
    #light_dissipation = new InterpolatingDoubleTreeMap();
    /** @type {number[] | null} */
    #last_lighting_level = null;
    /** @type {number[] | null} */
    #prev_last_lighting_level = null;

    /**
     * @param {Entity} parent_entity
     * @param {Entity['lighting']} lighting
     * @param {Array<{ x: number; y: number }>} points
     */
    #trace_ray_using_cache(parent_entity, { ...lighting }, ...points) {
        let shading = false;
        let lit_entity = null;
        let shadow = null;
        if (points.length === 0) {
            return;
        }
        if (points.length === 1) {
            return;
        }
        if (lighting.level === 0) {
            return;
        }
        // console.log(points);
        this.ctx.lineWidth = 1;
        const gradient = this.ctx.createLinearGradient(
            points[0].x,
            points[0].y,
            points[points.length - 1].x,
            points[points.length - 1].y
        );
        const path = new Path2D();
        let shadow_path = new Path2D();
        // this.#current_path ??= new Path2D();
        path.moveTo(points[0].x, points[0].y);
        let index = -1;
        let light_index = -1;
        let prev_lighting = lighting;
        const level = [];
        for (const point of points) {
            index++;
            if (!shading) {
                light_index++;
            }
            level.push(lighting.level);

            prev_lighting = { ...lighting };

            const { x, y } = point;
            const entity = this.#map.get(x, y);
            if (entity !== null && entity.entity !== parent_entity) {
                // console.log(entity, x, y);
                if (shadow === null) {
                    shadow = lighting.level;
                    lit_entity = entity;
                }
                lighting.level -=
                    lighting.level * entity.entity.lighting.absorption;
            }
            if (+lighting.level.toFixed(2) === 0) {
                shading = true;
                // this.ctx.strokeStyle = gradient;
                // this.ctx.stroke(path);
                continue;
                // break;
            }
            lighting.level *= this.#light_dissipation.get(this.precision);
            // lighting.level -= (lighting.level * Math.hypot(this.width, this.height));
            // if (!shading) {
            gradient.addColorStop(
                points.indexOf(point) / (points.length - 1),
                this.#serialize_color(...lighting.hue, lighting.level)
            );
            // console.log(parent_entity, lit_entity);
            if (!shading) {
                path.lineTo(x, y);
                if (
                    this.#last_points !== null &&
                    this.#last_lighting_level !== null &&
                    index > 0 &&
                    this.#last_points.length > index &&
                    delta(point, this.#last_points[index]) > 1 / (index * 5)
                ) {
                    const fill = new Path2D();
                    fill.moveTo(x + 0.2, y + 0.2);
                    fill.lineTo(
                        this.#last_points[index].x,
                        this.#last_points[index].y
                    );
                    fill.lineTo(
                        this.#last_points[index - 1].x,
                        this.#last_points[index - 1].y
                    );
                    fill.lineTo(
                        points[index - 1].x + 0.2,
                        points[index - 1].y + 0.2
                    );
                    fill.lineTo(x + 0.2, y + 0.2);
                    this.ctx.fillStyle = this.#serialize_color(
                        ...lighting.hue,
                        interpolate(
                            interpolate(
                                lighting.level,
                                level[level.length - 2],
                                0.5
                            ),
                            this.#last_lighting_level[index],
                            0.5
                        )
                    );
                    this.ctx.fill(fill);
                } else if (
                    this.#prev_last_points !== null &&
                    this.#prev_last_lighting_level !== null &&
                    index > 0 &&
                    this.#prev_last_points.length > index &&
                    delta(point, this.#prev_last_points[index]) >
                        1 / (index * 5)
                ) {
                    const fill = new Path2D();
                    fill.moveTo(x + 0.2, y + 0.2);
                    fill.lineTo(
                        this.#prev_last_points[index].x,
                        this.#prev_last_points[index].y
                    );
                    fill.lineTo(
                        this.#prev_last_points[index - 1].x,
                        this.#prev_last_points[index - 1].y
                    );
                    fill.lineTo(
                        points[index - 1].x + 0.2,
                        points[index - 1].y + 0.2
                    );
                    fill.lineTo(x + 0.2, y + 0.2);
                    this.ctx.fillStyle = this.#serialize_color(
                        ...lighting.hue,
                        interpolate(
                            interpolate(
                                lighting.level,
                                level[level.length - 2],
                                0.5
                            ),
                            this.#prev_last_lighting_level[index],
                            0.5
                        )
                    );
                    this.ctx.fill(fill);
                }
            }
            if (shading) {
                if (
                    entity !== null &&
                    entity !== lit_entity &&
                    entity.entity !== parent_entity
                ) {
                    // console.log(entity);
                    shadow_path.moveTo(x, y);
                    shadow_path.rect(x, y, 5, 5);
                    // shadow_path.lineTo(x, y);
                    this.ctx.fillStyle = this.#serialize_color(0, 0, 0, 1.0);
                    this.ctx.fill(shadow_path);
                    break;
                }
                continue;
            }
            // }
        }
        // if (this.#last_points === null || this.#last_points.length - 1 < light_index) {
        //     this.#current_path.lineTo(points[light_index].x, points[light_index].y);
        // } else {
        //     // const [midpoint] = points_between(this.#last_points[light_index], points[light_index]);
        //     this.#current_path.lineTo(points[light_index].x, points[light_index].y);
        //     // this.#current_path.arcTo(midpoint.x, midpoint.y, points[light_index].x, points[light_index].y, 5);
        // }
        const last_points = points.slice(0, light_index);
        const last_point_on_screen = last_points.findLastIndex(
            value =>
                value.x >= 0 &&
                value.y >= 0 &&
                value.x <= this.width &&
                value.y <= this.height
        );
        const edge = new Path2D();
        if (
            this.#last_points !== null &&
            this.#last_points.length > 1 &&
            last_point_on_screen > 0 &&
            last_points.length > last_point_on_screen
        ) {
            const prev = last_points[last_point_on_screen - 1];
            const end = this.#last_points[this.#last_points.length - 1];
            const prev_end = this.#last_points[this.#last_points.length - 2];
            edge.moveTo(
                last_points[last_point_on_screen].x,
                last_points[last_point_on_screen].y
            );
            edge.lineTo(end.x, end.y);
            edge.lineTo((prev.x + prev_end.x) / 2, (prev.y + prev_end.y) / 2);
            edge.lineTo(
                last_points[last_point_on_screen].x,
                last_points[last_point_on_screen].y
            );
            this.ctx.fillStyle = this.#serialize_color(
                ...prev_lighting.hue,
                prev_lighting.level
            );
            this.ctx.fill(edge);
        }
        this.#prev_last_points = this.#last_points;
        this.#last_points = last_points.slice(0, last_point_on_screen);
        this.#prev_last_lighting_level = this.#last_lighting_level;
        this.#last_lighting_level = level.slice(0, last_point_on_screen);
        // this.#edges.push(points[last_point_on_screen]);
    }

    /**
     * @param {Entity} entity
     * @param {number} x
     * @param {number} y
     * @param {number} delta_x
     * @param {number} delta_y
     * @param {Entity['lighting']} lighting
     */
    #trace_ray(entity, x, y, delta_x, delta_y, { ...lighting }) {
        const serialized = `${x};${y};${delta_x};${delta_y}`;
        if (this.#ray_cache.has(serialized)) {
            this.#trace_ray_using_cache(
                entity,
                lighting,
                .../** @type {Array<{ x: number; y: number }>} */ (
                    this.#ray_cache.get(serialized)
                )
            );
        }
        const points = this.#generate_points(
            x,
            y,
            delta_x,
            delta_y,
            -this.width * 0.5,
            this.width * 1.5,
            -this.height * 1.5,
            this.height * 1.5
        );
        this.#ray_cache.set(serialized, points);
        this.#trace_ray_using_cache(entity, lighting, ...points);
        return;
    }

    /**
     * @param {{ x: number; y: number; entity: Entity }} object
     */
    #is_on_screen({ entity, x, y }) {
        const x_points = entity.outline.map(({ x }) => x);
        const y_points = entity.outline.map(({ y }) => y);
        const min_x = Math.min(...x_points) + x;
        if (min_x > this.width) {
            return false;
        }
        const max_x = Math.max(...x_points) + x;
        if (max_x < 0) {
            return false;
        }
        const min_y = Math.min(...y_points) + y;
        if (min_y > this.height) {
            return false;
        }
        const max_y = Math.max(...y_points) + y;
        if (max_y < 0) {
            return false;
        }
        return true;
    }

    /**
     * Adds an entity to be queued to render.
     * At the next animation frame, the entity queue will be flushed, and all entities in the queue will be rendered and raytraced.
     * @param {Entity} entity
     * @param {number} x
     * @param {number} y
     */
    entity(entity, x, y) {
        const e = {
            entity,
            x,
            y
        };
        this.#entities.push(e);
        this.#entities = this.#entities.toSorted(
            (a, b) => a.entity.layer - b.entity.layer
        );
        this.#map.add(e);
        this.#queue_render();
    }

    refresh() {
        this.#entities.push(...this.#map.entries());
        this.#queue_render();
    }

    clear() {
        this.#map.clear();
        super.clear();
    }
}
