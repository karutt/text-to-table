import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

import js from '@eslint/js';
import parser from '@typescript-eslint/parser';
import chakraUiPlugin from 'eslint-plugin-chakra-ui';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
    {
        ignores: [
            'dist',
            'node_modules',
            'esbuild.config.js',
            'esbuild.config.mjs',
            '*.config.mjs',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.ts', 'src/**/*.tsx'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
            parser,
            parserOptions: {
                project: ['./tsconfig.app.json'],
                tsconfigRootDir: __dirname,
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
            'chakra-ui': chakraUiPlugin,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            ...chakraUiPlugin.configs.recommended,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
        },
    },
    {
        files: ['*.cjs'],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'script',
            globals: {
                require: 'readonly',
                __dirname: 'readonly',
                console: 'readonly',
                module: 'readonly',
                process: 'readonly',
            },
        },
        plugins: { '@typescript-eslint': tseslint.plugin },
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            'no-undef': 'off',
        },
    },
];
