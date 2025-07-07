// esbuild.config.mjs - Build configuration for Figma plugin

/* global console, process */

import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildCode(isDev = false) {
    // HTMLファイルの存在確認と読み込み
    let htmlContent = '<html><body><div id="root"></div></body></html>';
    const htmlPath = path.join(__dirname, 'dist', 'index.html');

    if (fs.existsSync(htmlPath)) {
        htmlContent = fs.readFileSync(htmlPath, 'utf8');
    }

    const buildOptions = {
        entryPoints: ['src/plugin/controller.ts'],
        bundle: true,
        platform: 'node',
        outfile: 'dist/code.js',
        format: 'cjs',
        target: 'es2015',
        define: {
            __DEV__: JSON.stringify(isDev),
            __html__: JSON.stringify(htmlContent),
        },
        minify: !isDev,
        sourcemap: isDev,
    };

    if (isDev) {
        const ctx = await esbuild.context(buildOptions);
        await ctx.watch();
        console.log('👀 Watching for code changes...');
    } else {
        await esbuild.build(buildOptions);
        console.log('✅ Code build complete');
    }
}

// CLIから直接実行された場合
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const isDev = process.argv.includes('--watch');
    buildCode(isDev).catch(console.error);
}
