// @ts-check
import { TIME_SLOWDOWN } from './constants.js';
import { RaytracingRenderer } from './raytracing.js';
import { interpolate, pixelator } from './utils.js';
import './images.js';
import { Game } from './game.js';
import { init, inventory } from './ui.js';
import { set_renderer } from './objects.js';
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
        const time = Math.sin(game.time / TIME_SLOWDOWN) / 2 + 0.5;
        const r = interpolate(135, 0, time);
        const g = interpolate(206, 0, time);
        const b = interpolate(235, 0, time);
        renderer.background(`rgb(${r},${g},${b})`);
    },
    pixelator(2)
);

let opened_inventory = false;
addEventListener('keydown', e => {
    if (e.key === 'e' && !opened_inventory && Game.current?.player !== undefined) {
        opened_inventory = true;
        inventory(Game.current.player).then(() => {
            opened_inventory = false;
        });
    }
});
set_renderer(renderer);
const game = new Game(renderer);
init(game);
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
