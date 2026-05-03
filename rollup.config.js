import { defineConfig } from 'rollup';
import terser from '@rollup/plugin-terser';
import node_resolve from '@rollup/plugin-node-resolve';

export default defineConfig({
    input: 'src/index.js',
    output: {
        dir: './dist',
        format: 'esm'
    },
    plugins: [node_resolve(), terser()]
});
