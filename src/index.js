// @ts-check
import { TIME_SLOWDOWN } from './constants.js';
import { RaytracingRenderer } from './raytracing.js';
import { interpolate, pixelator } from './utils.js';
import './images.js';
import { Game } from './game.js';
import { init, inventory } from './ui.js';
import { Moon, set_renderer, Sun } from './objects.js';
const canvas = /** @type {HTMLCanvasElement} */ (
    document.querySelector('canvas.raytraced')
);
canvas.style.opacity = '1';
canvas.style.display = 'none';
canvas.height = window.innerHeight;
canvas.width = window.innerWidth;
// canvas.addEventListener('click', () => {
//     canvas.requestPointerLock();
// });
const display = document.createElement('canvas');
document.body.firstElementChild?.appendChild(display);
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
        const time = Math.sin(game.time / TIME_SLOWDOWN + Math.PI * 0.2) / 2 + 0.5;
        const r = interpolate(135, 0, time);
        const g = interpolate(206, 0, time);
        const b = interpolate(235, 0, time);
        renderer.background(`rgb(${r},${g},${b})`);
        // if (!game.player) return;
        const center_x = renderer.width * 0.6;
        const center_y = renderer.height * 0.6;
        const angle = game.time / TIME_SLOWDOWN + Math.PI * 1.05;
        const sun_x =
            center_x +
            (0.35 * renderer.width - center_x) * Math.cos(angle) -
            (0.35 * renderer.height - center_y) * Math.sin(angle);
        const sun_y =
            center_y +
            (0.35 * renderer.width - center_x) * Math.sin(angle) +
            (0.35 * renderer.height - center_y) * Math.cos(angle);
        if (
            sun_x > 0 &&
            sun_x < renderer.width &&
            sun_y > 0 &&
            sun_y < renderer.height
        ) {
            renderer.entity(sun, sun_x, sun_y);
        }
        const moon_angle = game.time / TIME_SLOWDOWN;
        const moon_x =
            center_x +
            (0.35 * renderer.width - center_x) * Math.cos(moon_angle) -
            (0.35 * renderer.height - center_y) * Math.sin(moon_angle);
        const moon_y =
            center_y +
            (0.35 * renderer.width - center_x) * Math.sin(moon_angle) +
            (0.35 * renderer.height - center_y) * Math.cos(moon_angle);
        if (
            moon_x > 0 &&
            moon_x < renderer.width &&
            moon_y > 0 &&
            moon_y < renderer.height
        ) {
            renderer.entity(moon, moon_x, moon_y);
        }
        // renderer.entity(new Tree(), renderer.width * 0.9, 0);
        // renderer.entity(
        //     game.player.get_entity(game.player.direction, 2),
        //     renderer.width * 0.75,
        //     renderer.height * 0.5
        // );
    },
    pixelator(2)
);
set_renderer(renderer);
const game = new Game(renderer);
init(game);
const sun = new Sun();
const moon = new Moon();

let opened_inventory = false;
addEventListener('keydown', e => {
    if (
        e.key === 'e' &&
        !opened_inventory &&
        Game.current?.player !== undefined
    ) {
        opened_inventory = true;
        inventory(Game.current.player).then(() => {
            opened_inventory = false;
        });
    }
});
async function loop() {
    if (game.current_step === null) {
        return;
    }
    if (game.paused) {
        await game.resume_promise;
    }
    await game.update();
    return requestAnimationFrame(loop);
}

loop();
