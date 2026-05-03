import { defineConfig } from 'rollup';
import terser from '@rollup/plugin-terser';
import node_resolve from '@rollup/plugin-node-resolve';
import alias from '@rollup/plugin-alias';

export default defineConfig({
    input: 'src/index.js',
    output: {
        dir: './dist',
        format: 'esm'
    },
    plugins: [
        alias({
            entries: [
                {
                    find: './env.js',
                    replacement: './env-production.js'
                }
            ]
        }),
        node_resolve(),
        terser()
    ]
});
