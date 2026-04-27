// @ts-check
import { RaytracingRenderer } from './raytracing.js';
import { pixelator } from './utils.js';
const { Game } = await import('./game.js').then(async res => {
    await import('./story.js');
    return res;
});
const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('canvas.raytraced'));
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
const renderer = new RaytracingRenderer(canvas, display, renderer => {
    renderer.background('black');
}, pixelator(2));
const game = new Game(renderer);
async function loop() {
    if (game.current_step === null) {
        return;
    }
    await game.update();
    return requestAnimationFrame(loop);
}

loop();
