import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
    const isDev = mode === 'development';

    return {
        plugins: [
            react(),
            ...(isDev ? [] : [viteSingleFile()]), // 開発時はsinglefileを無効化
            tsconfigPaths(),
        ],
        server: {
            port: 5173,
            open: false,
            hmr: true, // HMRを有効化
        },
        build: {
            outDir: 'dist',
            emptyOutDir: false,
            minify: !isDev, // 開発時はminifyを無効化
            sourcemap: isDev,
            rollupOptions: {
                input: resolve(__dirname, 'index.html'),
                output: {
                    entryFileNames: '[name].js',
                    assetFileNames: '[name][extname]',
                    manualChunks: undefined,
                },
                treeshake: !isDev, // 開発時はtreeshakeを無効化
            },
            cssCodeSplit: false,
        },
    };
});
