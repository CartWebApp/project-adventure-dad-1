/// <reference types="node" />
import { readdir, readFile, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { imageSize as image_size } from 'image-size';
const prelude = `import { Image } from './objects.js';
/**
 * @param {number} width
 * @param {number} height
 */
function size(width, height) {
    return { width, height };
}`;
const sizes = new Map();
const assets = join(process.cwd(), 'assets');
const files = await readdir(assets, {
    recursive: true
}).then(async entries => {
    const files = [];
    for (const entry of entries) {
        const stats = await stat(join(assets, entry));
        if (stats.isFile()) {
            const name = `./${entry.replace(/\\/g, '/')}`;
            const buffer = await readFile(join(assets, entry));
            const { width, height } = image_size(buffer);
            if (!sizes.has(`${width}, ${height}`)) {
                sizes.set(`${width}, ${height}`, `s${sizes.size}`);
            }
            files.push({
                name,
                width,
                height
            });
        }
    }
    return files;
});

const vars = [];

for (const [size, name] of sizes) {
    vars.push(`const ${name} = size(${size});`);
}

const preloads = files.map(
    file =>
        `Image.preload('${file.name}', ${sizes.get(`${file.width}, ${file.height}`)})`
);
await writeFile(
    join(process.cwd(), 'src', 'images.js'),
    `${prelude}
${vars.join('\n')}
await Promise.all([${preloads.map(preload => `\n    ${preload}`).join(',')}
]);
`
);
