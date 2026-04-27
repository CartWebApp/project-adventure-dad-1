import { Renderer } from './renderer.js';
import { pixelator } from './utils.js';

const ui_canvas = /** @type {HTMLCanvasElement} */ (
    document.querySelector('canvas.ui')
);
ui_canvas.style.opacity = '1';
ui_canvas.style.display = 'none';
ui_canvas.height = window.innerHeight;
ui_canvas.width = window.innerWidth;
const display = document.createElement('canvas');
document.body.append(display);
display.height = window.innerHeight / 2;
display.width = window.innerWidth / 2;
display.classList.add('ui');
window.addEventListener('resize', () => {
    display.height = window.innerHeight / 2;
    display.width = window.innerWidth / 2;
});

/**
 * @template {any[]} I
 * @template O
 * @param {[...(() => void)[], (...args: I) => O]} fns
 * @returns {(...args: NoInfer<I>) => NoInfer<O>}
 */
function join(...fns) {
    return (...args) => {
        for (let i = 0; i < fns.length - 1; i++) {
            fns[i]();
        }
        return /** @type {(...args: I) => O} */ (fns[fns.length - 1])(...args);
    };
}

const renderer = new Renderer.Offscreen(
    ui_canvas,
    display,
    join(cursor, pixelator(1))
);

renderer.ctx.fillStyle = 'white';
renderer.ctx.font = '22px monospace, Noto Color Emoji';
display.addEventListener('click', () => {
    display.requestPointerLock();
});
// /**
//  * @param {string} text
//  */
// export async function dialog(text) {
//     for (let i = 0; i < text.length + 1; i++) {
//         static_dialog(text.slice(0, i));
//         await new Promise(resolve => setTimeout(resolve, 50));
//     }
// }

function cursor() {
    renderer.ctx.save();
    renderer.ctx.fillStyle = 'white';
    renderer.ctx.strokeStyle = 'white';
    renderer.ctx.lineWidth = 6;
    const { mouse_x: x, mouse_y: y } = renderer;
    renderer.polygon(
        {
            x: x - 6,
            y: y - 10
        },
        {
            x: x - 6,
            y: y + 8
        },
        {
            x: x,
            y: y + 4
        },
        {
            x: x + 4,
            y: y + 5
        }
    );
    renderer.ctx.restore();
}

/**
 * @param {string} text
 */
function split_lines(text) {
    const lines = [''];
    for (let i = 0; i < text.length; i++) {
        const line = lines[lines.length - 1];
        const { width } = renderer.ctx.measureText(line);
        const emoji = text.slice(i).match(/^\p{Extended_Pictographic}/u);
        if (emoji) {
            if (width >= renderer.width * 0.35) {
                lines.push(emoji[0]);
            } else {
                lines[lines.length - 1] += emoji[0];
            }
            i += emoji[0].length - 1;
            continue;
        }
        if (
            text.charAt(i) === '\n' ||
            width >= renderer.width * 0.35 ||
            (width >= renderer.width * 0.3 && text.charAt(i - 1) === ' ')
        ) {
            lines.push(text.charAt(i));
        } else {
            lines[lines.length - 1] += text.charAt(i);
        }
    }
    return lines;
}

/**
 * @template {string} const T
 * @param {string} text
 * @param {T[]} choices
 * @param {(renderer: Renderer, x: number, y: number) => void} [render_icon]
 * @returns {Promise<T>}
 */
export function select(text, choices, render_icon = () => {}) {
    const { promise, resolve } = Promise.withResolvers();
    let current_choice = 0;
    let resolved = false;
    addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            resolve(choices[current_choice]);
            resolved = true;
        } else if (e.key === 'ArrowUp') {
            current_choice--;
            if (current_choice < 0) {
                current_choice = choices.length - 1;
            }
        } else if (e.key === 'ArrowDown') {
            current_choice++;
            if (current_choice >= choices.length) {
                current_choice = 0;
            }
        }
    });
    let init = true;
    async function render() {
        renderer.ctx.fillStyle = 'white';
        renderer.ctx.font = '22px monospace, Noto Color Emoji';
        await renderer.batch_async(async () => {
            renderer.clear();
            renderer.ctx.strokeStyle = 'white';
            renderer.ctx.lineWidth = 2;
            renderer.ctx.fillStyle = 'black';
            renderer.ctx.roundRect(
                renderer.width * 0.4,
                renderer.height * 0.6,
                renderer.width * 0.5,
                renderer.height * 0.2,
                15
            );
            renderer.ctx.fill();
            // renderer.rect(renderer.width * 0.05, renderer.height * 0.5, renderer.width * 0.9, renderer.height * 0.18);
            renderer.ctx.stroke();
            renderer.ctx.save();
            render_icon(
                renderer,
                renderer.width * 0.415,
                renderer.height * 0.7
            );
            renderer.ctx.restore();

            renderer.ctx.fillStyle = 'white';
            let y = renderer.height * 0.65;
            const lines = split_lines(text);
            if (init) {
                const rendered = [''];
                let current_line = 0;
                while (rendered.join('\n') !== lines.join('\n')) {
                    if (rendered[current_line] !== lines[current_line]) {
                        const emoji = lines[current_line]
                            .slice(rendered[current_line].length)
                            .match(/^\p{Extended_Pictographic}/u);
                        if (emoji) {
                            rendered[current_line] += emoji[0];
                        } else {
                            rendered[current_line] += lines[
                                current_line
                            ].charAt(rendered[current_line].length);
                        }
                    } else if (current_line < lines.length - 1) {
                        rendered.push('');
                        current_line++;
                    }
                    renderer.batch(() => {
                        render_frame(rendered, render_icon);
                    });
                    await new Promise(resolve => setTimeout(resolve, 75));
                }
                init = false;
                y += 22 * lines.length;
            } else {
                for (const line of lines) {
                    renderer.text(
                        line,
                        renderer.width * 0.5,
                        y,
                        renderer.width * 0.38
                    );
                    y += 22;
                }
            }
            const offset = Math.max(
                ...choices.map(
                    choice => renderer.ctx.measureText(choice).width / 2
                )
            );
            for (let i = 0; i < choices.length; i++) {
                const level = (y += 22);
                if (i === current_choice) {
                    renderer.polygon(
                        {
                            x: renderer.width * 0.5 - offset,
                            y: level - 11
                        },
                        {
                            x: renderer.width * 0.5 - offset - 15,
                            y: level - 18
                        },
                        {
                            x: renderer.width * 0.5 - offset - 15,
                            y: level - 2
                        }
                    );
                }
                renderer.text(
                    choices[i],
                    renderer.width * 0.5,
                    level,
                    renderer.width * 0.3
                );
            }
        });
        if (resolved) {
            return;
        }
        return requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
    return promise;
}

/**
 * @param {string[]} lines
 * @param {(renderer: Renderer, x: number, y: number) => void} render_icon
 */
function render_frame(lines, render_icon) {
    renderer.clear();
    renderer.ctx.strokeStyle = 'white';
    renderer.ctx.lineWidth = 2;
    renderer.ctx.fillStyle = 'black';
    renderer.ctx.roundRect(
        renderer.width * 0.4,
        renderer.height * 0.6,
        renderer.width * 0.5,
        renderer.height * 0.2,
        15
    );
    renderer.ctx.fill();
    // renderer.rect(renderer.width * 0.05, renderer.height * 0.5, renderer.width * 0.9, renderer.height * 0.18);
    renderer.ctx.stroke();
    renderer.ctx.save();
    render_icon(renderer, renderer.width * 0.415, renderer.height * 0.7);
    renderer.ctx.restore();

    renderer.ctx.fillStyle = 'white';
    let y = renderer.height * 0.65;
    for (const line of lines) {
        renderer.text(line, renderer.width * 0.5, y, renderer.width * 0.38);
        y += 22;
    }
}

/**
 * @param {string} text
 * @param {(renderer: Renderer, x: number, y: number) => void} [render_icon]
 * @param {number} [per_letter_duration]
 */
export async function dialog(text, render_icon = () => {}, per_letter_duration = 75) {
    await renderer.batch_async(async () => {
        renderer.clear();
        renderer.ctx.strokeStyle = 'white';
        renderer.ctx.lineWidth = 2;
        renderer.ctx.fillStyle = 'black';
        renderer.ctx.roundRect(
            renderer.width * 0.4,
            renderer.height * 0.6,
            renderer.width * 0.5,
            renderer.height * 0.2,
            15
        );
        renderer.ctx.fill();
        // renderer.rect(renderer.width * 0.05, renderer.height * 0.5, renderer.width * 0.9, renderer.height * 0.18);
        renderer.ctx.stroke();
        renderer.ctx.save();
        render_icon(renderer, renderer.width * 0.415, renderer.height * 0.7);
        renderer.ctx.restore();

        renderer.ctx.fillStyle = 'white';

        const lines = split_lines(text);
        const rendered = [''];
        let current_line = 0;
        while (rendered.join('\n') !== lines.join('\n')) {
            if (rendered[current_line] !== lines[current_line]) {
                const emoji = lines[current_line]
                    .slice(rendered[current_line].length)
                    .match(/^\p{Extended_Pictographic}/u);
                if (emoji) {
                    rendered[current_line] += emoji[0];
                } else {
                    rendered[current_line] += lines[current_line].charAt(
                        rendered[current_line].length
                    );
                }
            } else if (current_line < lines.length - 1) {
                rendered.push('');
                current_line++;
            }
            renderer.batch(() => {
                render_frame(rendered, render_icon);
            });
            await new Promise(resolve => setTimeout(resolve, per_letter_duration));
        }
    });
}

/**
 * @param {string} text
 */
export function static_dialog(text) {
    renderer.batch(() => {
        renderer.clear();
        renderer.ctx.strokeStyle = 'white';
        renderer.ctx.lineWidth = 2;
        renderer.ctx.fillStyle = 'black';
        renderer.ctx.roundRect(
            renderer.width * 0.4,
            renderer.height * 0.6,
            renderer.width * 0.5,
            renderer.height * 0.2,
            15
        );
        renderer.ctx.fill();
        // renderer.rect(renderer.width * 0.05, renderer.height * 0.5, renderer.width * 0.9, renderer.height * 0.18);
        renderer.ctx.stroke();
        renderer.ctx.font = '22px cursive';

        renderer.ctx.fillStyle = 'white';
        let y = renderer.height * 0.65;
        const lines = [''];
        for (let i = 0; i < text.length; i++) {
            const line = lines[lines.length - 1];
            const width = renderer.ctx.measureText(line).width;
            if (
                text.charAt(i) === '\n' ||
                width >= renderer.width * 0.35 ||
                (width >= renderer.width * 0.3 && text.charAt(i - 1) === ' ')
            ) {
                lines.push(text.charAt(i));
            } else {
                lines[lines.length - 1] += text.charAt(i);
            }
        }
        for (const line of lines) {
            renderer.text(line, renderer.width * 0.5, y, renderer.width * 0.3);
            y += 20;
        }
    });
}

/**
 * @template {string} T
 * @param {string} text
 * @param {(input: string) => input is T & string} [validator]
 * @param {number} [max_length]
 * @returns {Promise<T>}
 */
export async function input(
    text,
    validator = /** @type {(input: string) => input is T} */ (
        input => typeof input === 'string'
    ),
    max_length = 15
) {
    const { promise, resolve } = Promise.withResolvers();
    let value = '';
    let resolved = false;
    /**
     * @param {KeyboardEvent} e
     */
    function handler(e) {
        if (e.key === 'Enter') {
            if (validator(value)) {
                removeEventListener('keydown', handler);
                resolved = true;
                resolve(value);
            } else {
                shake = 50;
            }
        } else if (e.key === 'Backspace') {
            value = value.slice(0, value.length - 1);
        } else if (e.key.length === 1) {
            if (max_length === value.length) {
                shake = 50;
            } else {
                value += e.key;
            }
        }
    }
    let shake = 0;
    let cursor = 0;
    let init = true;
    addEventListener('keydown', handler);
    async function frame() {
        await renderer.batch_async(async () => {
            renderer.clear();
            renderer.ctx.strokeStyle = 'white';
            renderer.ctx.lineWidth = 2;
            renderer.ctx.fillStyle = 'black';
            renderer.ctx.roundRect(
                renderer.width * 0.4,
                renderer.height * 0.6,
                renderer.width * 0.5,
                renderer.height * 0.2,
                15
            );
            renderer.ctx.fill();
            renderer.ctx.stroke();
            renderer.ctx.fillStyle = 'white';
            let y = renderer.height * 0.65;
            const lines = split_lines(text);
            if (init !== false) {
                const rendered = [''];
                let current_line = 0;
                while (rendered.join('\n') !== lines.join('\n')) {
                    if (rendered[current_line] !== lines[current_line]) {
                        const emoji = lines[current_line]
                            .slice(rendered[current_line].length)
                            .match(/^\p{Extended_Pictographic}/u);
                        if (emoji) {
                            rendered[current_line] += emoji[0];
                        } else {
                            rendered[current_line] += lines[
                                current_line
                            ].charAt(rendered[current_line].length);
                        }
                    } else if (current_line < lines.length - 1) {
                        rendered.push('');
                        current_line++;
                    }
                    renderer.batch(() => {
                        render_frame(rendered, () => {});
                    });
                    await new Promise(resolve => setTimeout(resolve, 75));
                }
                init = false;
            }
            for (const line of lines) {
                renderer.text(
                    line,
                    renderer.width * 0.5,
                    y,
                    renderer.width * 0.3
                );
                y += 20;
            }
            let x = renderer.width * 0.5;
            if (shake > 0) {
                x += Math.sin(shake-- / 4) * (shake / 2);
            }
            renderer.text(
                value + (shake === 0 && Math.sin(cursor / 8) > 0 ? '_' : ''),
                x,
                (y += 20),
                renderer.width * 0.3
            );
            cursor++;
        });
        if (!resolved) {
            return requestAnimationFrame(frame);
        }
    }
    await frame();
    return promise;
}
