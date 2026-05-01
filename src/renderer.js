import { BENCHMARKING } from './constants.js';

/**
 * @param {ImageData} a
 * @param {ImageData} b
 */
function is_imagedata_equal(a, b) {
    const a_data = a.data;
    const b_data = b.data;
    const len = a_data.length;
    for (let i = 0; i < len; i++) {
        if (a_data[i] !== b_data[i]) {
            return false;
        }
    }
    return true;
}

class Renderer {
    /** @type {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} */
    ctx;
    /** @type {HTMLCanvasElement | OffscreenCanvas} */
    canvas;
    #mouse_x = 0;
    #mouse_y = 0;
    #mousemove_handler;

    /**
     * @param {Renderer} renderer
     */
    static #get_handler(renderer) {
        return renderer.#mousemove_handler;
    }
    get mouse_x() {
        return this.#mouse_x;
    }
    get mouse_y() {
        return this.#mouse_y;
    }
    get height() {
        return this.canvas.height;
    }
    get width() {
        return this.canvas.width;
    }
    /**
     * @param {HTMLCanvasElement | OffscreenCanvas} canvas
     */
    constructor(canvas) {
        this.ctx =
            /** @type {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} */ (
                (this.canvas = canvas).getContext('2d', { alpha: true })
            );
        if (!(canvas instanceof OffscreenCanvas)) {
            canvas.addEventListener(
                'mousemove',
                (this.#mousemove_handler =
                    /** @param {MouseEvent} event */ event => {
                        if (document.pointerLockElement === canvas) {
                            this.#mouse_x += event.movementX;
                            this.#mouse_y += event.movementY;
                        } else {
                            this.#mouse_x = event.clientX - canvas.offsetLeft;
                            this.#mouse_y = event.clientY - canvas.offsetTop;
                        }
                    })
            );
        }
    }

    /**
     * When you have an offscreen canvas and need to render changes to a "display" canvas, `Renderer.Offscreen` may be more enticing.
     * When any rendering action is performed, it queues a refresh of the display canvas to match that of the offscreen canvas. An optional rendering pass can be included that transforms the output of your offscreen display before painting it to the onscreen display.
     */
    static Offscreen = class Offscreen extends Renderer {
        display;
        offscreen;
        display_ctx;
        #mouse_x = 0;
        #mouse_y = 0;
        #pass;
        #queued_refresh = false;
        #batching = false;

        get mouse_x() {
            return this.#mouse_x;
        }
        get mouse_y() {
            return this.#mouse_y;
        }
        get height() {
            return this.offscreen.height;
        }
        get width() {
            return this.offscreen.width;
        }

        static BatchCancellationError = class BatchCancellationError extends Error {};

        /**
         * @param {HTMLCanvasElement} offscreen
         * @param {HTMLCanvasElement} display
         * @param {(offscreen: HTMLCanvasElement | OffscreenCanvas) => HTMLCanvasElement | OffscreenCanvas} [render_pass]
         */
        constructor(offscreen, display, render_pass = canvas => canvas) {
            const transferred = offscreen.transferControlToOffscreen();
            super(transferred);
            this.offscreen = transferred;
            this.display = display;
            this.#pass = render_pass;
            this.display_ctx = /** @type {CanvasRenderingContext2D} */ (
                display.getContext('2d', { alpha: true })
            );
            offscreen.removeEventListener(
                'mousemove',
                /** @type {any} */ (Renderer.#get_handler(this))
            );
            display.addEventListener('mousemove', event => {
                if (document.pointerLockElement === display) {
                    this.#mouse_x += event.movementX;
                    this.#mouse_y += event.movementY;
                } else {
                    this.#mouse_x = event.clientX - display.offsetLeft;
                    this.#mouse_y = event.clientY - display.offsetTop;
                }
            });
        }

        #clear_display() {
            this.display_ctx.clearRect(
                0,
                0,
                this.display.width,
                this.display.height
            );
        }

        /** @type {HTMLCanvasElement | OffscreenCanvas} */
        // @ts-expect-error
        #image;

        #draw() {
            const image = this.#image;
            this.display_ctx.drawImage(
                image,
                0,
                0,
                image.width,
                image.height,
                0,
                0,
                this.display.width,
                this.display.height
            );
        }

        #start = 0;
        #last_frame = -Infinity;

        #queue_refresh() {
            if (this.#queued_refresh || this.#batching) {
                return;
            }
            this.#queued_refresh = true;
            if (BENCHMARKING) {
                this.#start = performance.now();
            }
            const frame = performance.now();
            // if the last frame was more than one frame ago (assuming 60 fps), then just render without the wait
            if (frame - this.#last_frame > 15) {
                this.#last_frame = frame;
                this.#refresh();
                return;
            }
            requestAnimationFrame(() => {
                this.#last_frame = frame;
                this.#refresh();
                if (BENCHMARKING) {
                    alert(performance.now() - this.#start);
                }
            });
        }

        // #equality_test = document.createElement('canvas');
        // #equality_ctx = /** @type {CanvasRenderingContext2D} */ (this.#equality_test.getContext('2d'));

        #refresh() {
            this.#image = this.#pass(this.offscreen);
            // this.#equality_test.width = this.display.width;
            // this.#equality_test.height = this.display.height;
            // this.#equality_ctx.clearRect(0, 0, this.width, this.height);
            // if (is_imagedata_equal(this.#equality_ctx.getImageData(0, 0, this.display.width, this.display.height), this.#last_image_data)) {
            //     this.#queued_refresh = false;
            //     return;
            // }
            this.#clear_display();
            this.#draw();
            this.#queued_refresh = false;
        }

        clear() {
            super.clear();
            this.#queue_refresh();
        }

        /**
         * @param {string | CanvasGradient | CanvasPattern} color
         */
        background(color) {
            super.background(color);
            this.#queue_refresh();
        }

        /**
         * @param {Array<{ x: number; y: number }>} points
         */
        polygon(...points) {
            super.polygon(...points);
            this.#queue_refresh();
        }

        /**
         * @param {number} x
         * @param {number} y
         * @param {number} radius
         */
        circle(x, y, radius) {
            super.circle(x, y, radius);
            this.#queue_refresh();
        }

        /**
         * @param {{ x: number; y: number }} start
         * @param {{ x: number; y: number }} end
         */
        line(start, end) {
            super.line(start, end);
            this.#queue_refresh();
        }

        /**
         * @param {number} top_left_x
         * @param {number} top_left_y
         * @param {number} width
         * @param {number} height
         */
        rect(top_left_x, top_left_y, width, height) {
            super.rect(top_left_x, top_left_y, width, height);
            this.#queue_refresh();
        }

        /**
         * @param {(x: number) => number} fn
         * @param {{ start: number; end: number; }} [range]
         */
        function(fn, range = { start: 0, end: this.ctx.canvas.width }) {
            super.function(fn, range);
            this.#queue_refresh();
        }
        /**
         * @param {ImageData} data
         * @param {number} [dx]
         * @param {number} [dy]
         */
        put(data, dx = 0, dy = 0) {
            super.put(data, dx, dy);
            this.#queue_refresh();
        }

        /**
         * @param {string} text
         * @param {number} x
         * @param {number} y
         * @param {number} [max_width]
         */
        text(text, x, y, max_width = this.width) {
            super.text(text, x, y, max_width);
            this.#queue_refresh();
        }
        /**
         * Batches changes, refreshing synchronously once `fn`'s execution completes.
         * @param {() => void} fn
         */
        batch(fn) {
            this.#batching = true;
            this.ctx.save();
            fn();
            this.ctx.restore();
            this.#batching = false;
            this.#refresh();
        }

        #async_batch_controller = {
            cancel() {
                throw new Renderer.Offscreen.BatchCancellationError();
            },
        };

        /**
         * @param {(controller: { cancel(): never }) => Promise<void>} fn
         */
        async batch_async(fn) {
            this.#batching = true;
            this.ctx.save();
            try {
                await fn(this.#async_batch_controller);
            } catch (err) {
                if (err instanceof Renderer.Offscreen.BatchCancellationError) {
                    this.ctx.restore();
                    this.#batching = false;
                    return;
                }
                this.ctx.restore();
                this.#batching = false;
                throw err;
            }
            this.ctx.restore();
            this.#batching = false;
            this.#refresh();
        }
    };

    /**
     * @param {Array<{ x: number; y: number }>} points
     */
    polygon(...points) {
        const initial = /** @type {{ x: number; y: number }} */ (
            points.shift()
        );
        this.ctx.moveTo(initial.x, initial.y);
        this.ctx.beginPath();
        for (const point of points) {
            this.ctx.lineTo(point.x, point.y);
        }
        this.ctx.lineTo(initial.x, initial.y);
        this.ctx.closePath();
        this.ctx.fill();
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} radius
     */
    circle(x, y, radius) {
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, radius, radius, 0, 0, 360, false);
        this.ctx.closePath();
        this.ctx.fill();
    }

    clear() {
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    }

    /**
     * @param {(x: number) => number} fn
     * @param {{ start: number; end: number; }} [range]
     */
    function(fn, range = { start: 0, end: this.ctx.canvas.width }) {
        this.ctx.beginPath();
        for (let i = range.start + 1; i < range.end; i++) {
            this.ctx.moveTo(i - 1, fn(i - 1));
            this.ctx.lineTo(i, fn(i));
        }
        this.ctx.closePath();
        this.ctx.stroke();
    }

    /**
     * @param {string | CanvasGradient | CanvasPattern} color
     */
    background(color) {
        const prev_fill_style = this.ctx.fillStyle;
        this.ctx.fillStyle = color;
        this.ctx.rect(0, 0, this.width, this.height);
        this.ctx.fill();
        this.ctx.fillStyle = prev_fill_style;
    }

    /**
     * @param {{ x: number; y: number }} start
     * @param {{ x: number; y: number }} end
     */
    line(start, end) {
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.closePath();
        this.ctx.stroke();
    }

    /**
     * @param {number} top_left_x
     * @param {number} top_left_y
     * @param {number} width
     * @param {number} height
     */
    rect(top_left_x, top_left_y, width, height) {
        this.ctx.beginPath();
        this.ctx.rect(top_left_x, top_left_y, width, height);
        this.ctx.closePath();
        this.ctx.fill();
    }

    /**
     * @param {ImageData} data
     * @param {number} [dx]
     * @param {number} [dy]
     */
    put(data, dx = 0, dy = 0) {
        this.ctx.putImageData(data, dx, dy);
    }

    /**
     * @param {string} text
     * @param {number} x
     * @param {number} y
     * @param {number} [max_width]
     */
    text(text, x, y, max_width = this.width) {
        this.ctx.fillText(text, x, y, max_width);
    }
}

export { Renderer };
