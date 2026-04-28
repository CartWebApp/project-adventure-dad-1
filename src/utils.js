/** @import { Entity } from './raytracing.js' */

export function pixelator(level = 2) {
    const pixelator = document.createElement('canvas');
    pixelator.style.opacity = '0';
    document.body.append(pixelator);
    const pixelator_ctx = /** @type {CanvasRenderingContext2D} */ (pixelator.getContext('2d'));
    pixelator.width = window.innerWidth / level;
    pixelator.height = window.innerHeight / level;
    pixelator_ctx.imageSmoothingEnabled = false;
    /**
     * @param {HTMLCanvasElement | OffscreenCanvas} canvas
     */
    return canvas => {
        pixelator_ctx.clearRect(0, 0, pixelator.width, pixelator.height);
        pixelator_ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, pixelator.width, pixelator.height);
        return pixelator;
    }
}

// function originally from https://stackoverflow.com/a/29915728
/**
 * Checks if `point` is a point inside the polygon represented by its `vertices`. 
 * @param {{ x: number; y: number }} point
 * @param {Array<{ x: number; y: number }>} vertices
 */
function inside(point, vertices) {
    // ray-casting algorithm based on
    // https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html

    let { x, y } = point;
    
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const { x: xi, y: yi } = vertices[i];
        const { x: xj, y: yj } = vertices[j];

        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
};


/**
 * @param {number} radius
 */
export function circle(radius, step = 1) {
    let center = {
        x: radius,
        y: radius,
    };
    const points = [];
    for (let i = 0; i < 360; i += step) {
        const angle = (i / 180) * Math.PI;
        const x = center.x + radius * Math.cos(angle);
        const y = center.y + radius * Math.sin(angle);
        points.push({
            x,
            y,
        });
    }
    // console.log({ points });
    return points;
}

/**
 * @param {number} start
 * @param {number} end
 * @param {number} degree
 */
export function interpolate(start, end, degree) {
    const delta = degree * (end - start);
    return start + delta;
}

export class InterpolatingDoubleTreeMap {
    /** @type {Array<[number, number]>} */
    #entries = [];
    /**
     * @param {number} key
     * @param {number} value
     */
    set(key, value) {
        const index = this.#entries.findIndex(([k]) => key === k);
        if (index !== -1) {
            this.#entries[index][1] = value;
        } else {
            this.#entries.push([key, value]);
        }
    }

    /**
     * @param {number} key
     */
    get(key) {
        const found = this.#entries.find(([k]) => k === key);
        if (typeof found === 'object') {
            return found[1];
        }
        const lower_half = this.#entries.filter(([k]) => k < key).toSorted(([a], [b]) => a - b);
        const upper_half = this.#entries.filter(([k]) => k > key).toSorted(([a], [b]) => a - b);
        const lower = lower_half.at(-1);
        const upper = upper_half[0];
        if (upper === undefined && lower === undefined) {
            return 0;
        }
        if (upper === undefined) {
            return Infinity;
        }
        if (lower === undefined) {
            return -Infinity;
        }
        const a = lower[0];
        const b = upper[0];
        const degree = (key - a) / (b - a);
        return interpolate(lower[1], upper[1], degree);
    }
}

/**
 * Given an array of `Entity`s with coordinates, the `InterpolatingEntityMap` allows you to determine what entity is at a given point. 
 */
export class InterpolatingEntityMap {
    /** @type {Array<{ x: number; y: number; entity: Entity }>} */
    #entities = [];
    /**
     * @param {{ x: number; y: number; entity: Entity }} entity
     */
    add(entity) {
        this.#entities.push(entity);
    }
    *entries() {
        for (const entity of this.#entities) {
            yield entity;
        }
    }
    /**
     * @param {number} x
     * @param {number} y
     */
    get(x, y) {
        // console.log(this.#entities);
        const queried_x = x;
        const queried_y = y;
        const filtered = [];
        const queried = { x: queried_x, y: queried_y };
        for (const e of this.#entities) {
            const { x, y, entity } = e;
            const points = entity.outline.map(point => ({ x: point.x + x, y: point.y + y }));
            if (!inside(queried, points)) {
                continue;
            }
            // if (points.every(point => (point.x > queried_x) || (point.x < queried_x) || (point.y > queried_y) || (point.y < queried_y))) {
            //     continue;
            // }
            // if (points.every(point => (point.x > queried_x && point.y > queried_y) || (point.x < queried_x && point.y < queried_y))) {

            // }
            filtered.push(e);
        }
        if (filtered.length === 0) {
            return null;
        }
        if (filtered.length === 1) {
            return filtered[0];
        }
        /** @type {{ x: number; y: number; entity: Entity } | null} */
        let highest = null;
        for (const entity of filtered) {
            if (highest === null || entity.entity.layer > highest.entity.layer) {
                highest = entity;
            }
        }
        return highest;
    }
    clear() {
        this.#entities.length = 0;
    }
}