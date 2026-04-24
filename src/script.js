import { noise } from './noise.js';
import { Renderer } from './renderer.js';
import {
    GRASS_COLOR,
    TREE_HEIGHT,
    TREE_LEAF_COLOR,
    TREE_TRUNK_COLOR,
    TREE_TRUNK_HEIGHT,
    TREE_TRUNK_WIDTH,
    TREE_WIDTH,
} from './constants.js';
import { Entity, RaytracingRenderer } from './raytracing.js';
import { pixelator } from './utils.js';
import { dialog, select } from './ui.js';
const canvas = /** @type {HTMLCanvasElement} */ (
    document.querySelector('canvas.raytraced')
);
canvas.style.opacity = '1';
canvas.style.display = 'none';
canvas.height = window.innerHeight;
canvas.width = window.innerWidth;
canvas.addEventListener('click', () => {
    canvas.requestPointerLock();
});
const display = document.createElement('canvas');
document.body.appendChild(display);
display.height = window.innerHeight / 2;
display.width = window.innerWidth / 2;
window.addEventListener('resize', () => {
    display.height = window.innerHeight / 2;
    display.width = window.innerWidth / 2;
    renderer.refresh();
});
const renderer = new RaytracingRenderer(
    canvas,
    display,
    renderer => {
        renderer.background('black');
    },
    pixelator(2)
);
let tick = 0;
select(
    'Potato? Potato? Potato? Potato? Potato? Potato?',
    ['Yes', 'No'],
    (renderer, x, y) => {
        renderer.ctx.save();
        renderer.ctx.translate(x, y);
        renderer.ctx.rotate(Math.sin(tick++ / 10) * (1 / 4 / Math.PI));
        renderer.ctx.font = '60px monospace';
        renderer.text('🥔', 0, 0);
        renderer.ctx.restore();
    }
).then(response => {
    if (response === 'Yes') {
        return dialog(
            'Yippee! 🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔🥔',
            (renderer, x, y) => {
                renderer.ctx.translate(x, y);
                renderer.ctx.rotate(Math.sin(tick++ / 10) * (1 / 4 / Math.PI));
                renderer.ctx.font = '60px monospace';
                renderer.text('🥔', 0, 0);
            }
        );
    } else {
        return dialog('Aw man :(', (renderer, x, y) => {
            renderer.ctx.translate(x, y);
            renderer.ctx.rotate(Math.sin(tick++ / 10) * (1 / 4 / Math.PI));
            renderer.ctx.font = '60px monospace';
            renderer.text('🥔', 0, 0);
        });
    }
});
// dialog('Hello, world! Hello, world! Hello, world! Hello, world! Hello, world! Hello, world!');
renderer.display_ctx.imageSmoothingEnabled = false;
// renderer.ctx.imageSmoothingEnabled = false;
// renderer.ctx.lineWidth = 1 / (5 * renderer.ctx.lineWidth);
// renderer.ctx.translate(0.5, 0.5);
// renderer.canvas.addEventListener('click', () => {
//     renderer.canvas.requestPointerLock();
// }, { once: true });
// renderer.ctx.fillStyle = 'rebeccapurple';
// renderer.polygon({x: 0, y: 0}, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 });
// renderer.ctx.fillStyle = 'purple';
// renderer.polygon({ x: 40, y: 0 }, { x: 55, y: 10 }, { x: 55, y: 50 }, { x: 40, y: 40 });
// renderer.ctx.strokeStyle = 'indigo';
// renderer.function(x => Math.sin(x / 10) * 250 + 250);
// renderer.ctx.fillStyle = 'indigo';
// // renderer.polygon({ x: 0, y: 40 }, { x: 40, y: 40 }, { x: 55, y: 50 }, { x: 15, y: 49 });

// let radius = 20;

let curr_x = 0;
/** @type {Map<number, { x: number; height: number }>} */
const trees = new Map();
/** @type {Array<{ start: number; end: number }>} */
const tree_ranges = [];

/**
 * @param {number} x
 */
function generate(x) {
    return noise(x) * 2;
    // return 0.3 * (-3.2 * Math.sin(-1.3 * x) - 1.7 * Math.sin(-0.9 * Math.E * x) + 1.9 * Math.sin(0.3 * Math.PI * x));
}

/** @type {number[]} */
const skipped = [];

/**
 * @param {number} x
 */
function generate_tree_slice(
    x,
    range = {
        start: -(renderer.width / 2) - 800,
        end: renderer.width / 2 + 800,
    }
) {
    const res = [];
    let last_x = Infinity;
    let j = range.start;
    while (last_x === Infinity) {
        const gen = generate(x + j);
        if (gen > 1 && Math.abs(last_x - (j + range.end)) > 60) {
            last_x = j + range.end;
            break;
        }
        j--;
    }
    for (let i = range.start; i < range.end; i += 20) {
        if (
            Math.abs(last_x - (i + range.end)) <= 60 ||
            skipped.includes(x + i)
        ) {
            skipped.push(x + i);
            continue;
        }
        const gen = generate(x + i);
        if (gen > 1) {
            res.push({
                x: (last_x = i + range.end),
                height: gen,
            });
        }
    }
    // console.log(res);
    tree_ranges.push({
        start: x - Math.abs(range.start),
        end: x + Math.abs(range.end),
    });
    return res;
}

function controls() {
    /**
     * @param {KeyboardEvent} e
     */
    const handler = async e => {
        if (e.key === 'ArrowLeft') {
            curr_x -= 20;
            await render();
        } else if (e.key === 'ArrowRight') {
            curr_x += 20;
            await render();
        }
        // await new Promise(resolve => setTimeout(resolve, 50));
        // addEventListener('keydown', handler, { once: true });
    };
    addEventListener('keydown', handler);
}
controls();
// addEventListener('keydown', e => {
//     if (e.key === 'ArrowLeft') {
//         curr_x -= 5;
//     } else if (e.key === 'ArrowRight') {
//         curr_x += 5;
//     }
//     render();
// });

const aspect_ratio = renderer.width / renderer.height;

/**
 * @param {number} radius
 */
function circle(radius, step = 1) {
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

class Sun extends Entity {
    outline = circle(40, 10);
    lighting = {
        level: 0.25,
        hue: /** @type {[number, number, number]} */ ([250, 250, 250]),
        spread: Math.max(renderer.width, renderer.height) * 0.9,
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

class StandardTree extends Entity {
    layer = 5;
    outline = [
        {
            x: TREE_TRUNK_WIDTH + TREE_WIDTH / 2,
            y: renderer.height * 0.75,
        },
        {
            x: TREE_WIDTH / 2,
            y: renderer.height * 0.75,
        },
        {
            x: TREE_WIDTH / 2,
            y: renderer.height * 0.75 - TREE_TRUNK_HEIGHT,
        },
        {
            x: 0,
            y: renderer.height * 0.75 - TREE_TRUNK_HEIGHT,
        },
        {
            x: TREE_TRUNK_WIDTH / 2 + TREE_WIDTH / 2,
            y: renderer.height * 0.75 - (TREE_HEIGHT + TREE_TRUNK_HEIGHT),
        },
        {
            x: TREE_WIDTH + TREE_WIDTH / 2,
            y: renderer.height * 0.75 - TREE_TRUNK_HEIGHT,
        },
        {
            x: TREE_TRUNK_WIDTH + TREE_WIDTH / 2,
            y: renderer.height * 0.75 - TREE_TRUNK_HEIGHT,
        },
    ];
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

/**
 * @param {number} x
 */
function render_tree(x) {
    // console.log(x);
    renderer.entity(new StandardTree(), x, 0);
    // if (x > (renderer.width / 2) + 200 || x < -(renderer.width / 2) - 200) {
    //     return;
    // }
    // if (brightness < 100) {
    //     renderer.ctx.save();
    //     renderer.ctx.filter = `brightness(${brightness}%)`;
    // }
    // renderer.ctx.fillStyle = renderer.ctx.strokeStyle = TREE_TRUNK_COLOR;
    // renderer.polygon({
    //     x: x - 15,
    //     y: renderer.height * 0.75 - height * 200,
    // }, {
    //     x: x + 15,
    //     y: renderer.height * 0.75 - height * 200
    // }, {
    //     x: x + 13,
    //     y: renderer.height * 0.75 - height * 20
    // }, {
    //     x: x + 15,
    //     y: renderer.height * 0.75
    // }, {
    //     x: x,
    //     y: renderer.height * 0.75 + height
    // }, {
    //     x: x - 15,
    //     y: renderer.height * 0.75
    // }, {
    //     x: x - 13,
    //     y: renderer.height * 0.75 - height * 20
    // }, {
    //     x: x - 15,
    //     y: renderer.height * 0.75 - height * 200,
    // });
    // renderer.ctx.save();
    // renderer.ctx.filter = 'brightness(50%)';
    // renderer.line({
    //     x: x + 10,
    //     y: renderer.height * 0.75 - height * 20
    // }, {
    //     x: x + 12,
    //     y: renderer.height * 0.75
    // });
    // renderer.ctx.restore();
    // // renderer.rect(x - 7.5, renderer.height * 0.75 - height * 200, 15, height * 200);

    // // renderer.ctx.save();
    // // renderer.ctx.shadowColor = 'black';
    // // renderer.ctx.lineWidth = 0.5;
    // // renderer.ctx.shadowOffsetX = -3;
    // // renderer.ctx.shadowOffsetY = 0;
    // // renderer.ctx.shadowBlur = 5;
    // // renderer.line({
    // //     x: x + 7.5,
    // //     y: renderer.height * 0.75 - height * 200
    // // }, {
    // //     x: x + 7.5,
    // //     y: (renderer.height * 0.75)
    // // });
    // // renderer.ctx.restore();
    // // renderer.polygon({
    // //     x: x - 5,
    // //     y: renderer.height * 0.75 - (height * 100)
    // // }, {
    // //     x: x + 5,
    // //     y: renderer.height * 0.75 - (height * 100)
    // // }, {
    // //     x: x + 5,
    // //     y: renderer.height * 0.75
    // // }, {
    // //     x: x - 5,
    // //     y: renderer.height * 0.75
    // // });
    // renderer.ctx.fillStyle = TREE_LEAF_COLOR;
    // for (let i = 0; i < Math.round(height * 100); i += 35) {
    //     renderer.ctx.save();
    //     renderer.ctx.shadowColor = 'black';
    //     renderer.ctx.shadowOffsetX = 0;
    //     renderer.ctx.shadowOffsetY = 5;
    //     renderer.ctx.shadowBlur = 4;
    //     renderer.polygon(
    //         {
    //             x,
    //             y: (renderer.height * 0.75) - (height * 200) - i
    //         },
    //         {
    //             x: x - (height * 35),
    //             y: (renderer.height * 0.75) - (height * 30) - i
    //         },
    //         {
    //             x,
    //             y: (renderer.height * 0.75) - (height * 30) - i + 5
    //         },
    //         {
    //             x: x + (height * 35),
    //             y: (renderer.height * 0.75) - (height * 30) - i
    //         }
    //     );
    //     renderer.ctx.strokeStyle = TREE_LEAF_COLOR;
    //     renderer.polygon({
    //         x: x - (height * 35),
    //         y: (renderer.height * 0.75) - (height * 30) - i
    //     }, {
    //         x,
    //         y: (renderer.height * 0.75) - (height * 30) - i + 5
    //     }, {
    //         x: x + (height * 35),
    //         y: (renderer.height * 0.75) - (height * 30) - i
    //     });
    //     renderer.ctx.restore();
    // }
    // if (brightness < 100) {
    //     renderer.ctx.restore();
    // }
    // renderer.polygon({
    //     x,
    //     y: (renderer.height * 0.75 - (height * 200)) - (height * 40),
    // }, {
    //     x: x - 40,
    //     y: renderer.height * 0.75 - (noise(height * 5) * 30)
    // }, {
    //     x: x + 40,
    //     y: renderer.height * 0.75 - (noise(height * 5) * 30)
    // });
}

class Ground extends Entity {
    outline = [
        {
            x: 0,
            y: renderer.height * 0.75,
        },
        {
            x: renderer.width,
            y: renderer.height * 0.75,
        },
        {
            x: renderer.width,
            y: renderer.height,
        },
        {
            x: 0,
            y: renderer.height,
        },
    ];

    layer = 4;

    /**
     * @param {Renderer} renderer
     */
    render(renderer) {
        renderer.ctx.fillStyle = GRASS_COLOR;
        renderer.polygon(...this.outline);
    }
}

const ground = new Ground();
const sun = new Sun();
async function render() {
    // await renderer.promise;
    // renderer.batch(() => {
    renderer.clear();
    // renderer.function(x => Math.sin((x + renderer.mouse_x / 2) / 10) * 250 + (375 - renderer.mouse_y / 2));
    // renderer.background('skyblue');
    renderer.entity(ground, 0, 0);
    renderer.entity(sun, renderer.width * 0.9, renderer.height * 0.025);
    for (const tree of generate_tree_slice(curr_x)) {
        render_tree(tree.x);
    }
    // });
    // ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    // const len = image.data.length;
    // for (let i = 0; i < len; i += 8) {
    //     image.data.fill(0, i, i + 3);
    // }
    // const image = pixelate(renderer.canvas);
    // ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, ctx.canvas.width, ctx.canvas.height);
    // renderer.ctx.fillStyle = 'green';
    // renderer.polygon(
    //     {
    //         x: renderer.mouse_x - (renderer.width / 2),
    //         y: (renderer.height * 0.75) - renderer.mouse_y / 2
    //     },
    //     {
    //         x: renderer.width - ((renderer.width / 2) - renderer.mouse_x),
    //         y: (renderer.height * 0.75) - renderer.mouse_y / 2
    //     },
    //     {
    //         x: renderer.width,
    //         y: renderer.height
    //     },
    //     {
    //         x: 0,
    //         y: renderer.height
    //     }
    // );
    // renderer.ctx.strokeStyle = 'white';
    // renderer.ctx.lineWidth = 2;
    // renderer.line(
    //     { x: renderer.width / 2, y: (renderer.height / 2) - 10 },
    //     { x: renderer.width / 2, y: (renderer.height / 2) + 10 }
    // );
    // renderer.line(
    //     { x: (renderer.width / 2) - 10, y: renderer.height / 2 },
    //     { x: (renderer.width / 2) + 10, y: renderer.height / 2 }
    // );
    // renderer.polygon({ x: 245, y: 240 }, { x: 245, y: 245 }, { x: 240, y: 245 }, { x: 240, y: 250 }, { x: 245, y: 250 }, { x: 245, y: 255 }, { x: 250, y: 255 }, { x: 250, y: 250 }, { x: 255, y: 250 }, { x: 255, y: 245 }, { x: 250, y: 245 }, { x: 250, y: 240 });
    // renderer.circle(renderer.mouse_x, renderer.mouse_y, radius);
}

// document.querySelector('canvas').addEventListener('mousemove', render);

// let controller = new AbortController();

// document.querySelector('canvas').addEventListener('mousedown', async event => {
//     let signal = controller.signal;
//     if (signal.aborted) {
//         controller = new AbortController();
//         return;
//     }
//     controller.abort();
//     controller = new AbortController();
//     signal = controller.signal;
//     while (radius < 40) {
//         radius++;
//         render();
//         await new Promise(resolve => setTimeout(resolve, 10));
//         if (signal.aborted) {
//             return;
//         }
//     }
// });

// document.querySelector('canvas').addEventListener('mouseup', async event => {
//     let signal = controller.signal;
//     if (signal.aborted) {
//         controller = new AbortController();
//         return;
//     }
//     controller.abort();
//     controller = new AbortController();
//     signal = controller.signal;
//     while (radius > 20) {
//         radius--;
//         render()
//         await new Promise(resolve => setTimeout(resolve, 10));
//         if (signal.aborted) {
//             return;
//         }
//     }
//     render();
// });

await render();
