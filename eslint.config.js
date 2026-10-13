const {defineConfig} = require("eslint/config");
const js = require('@eslint/js');
const globals = require('globals');
module.exports = defineConfig([
    {
        ignores: [
            'node_modules',
            '**/*.min.js',
            'src/component/swiper/js/swiper-bundle.min.js',
            'src/component/clipboard/js/_clipboard.js',
            // любые другие файлы/папки
        ],
    },
    js.configs.recommended,
    {
        files: ['src/**/*.{js,jsx,ts,tsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: {jsx: true},
            },
            globals: {...globals.browser,...globals.node,...globals.amd,sfTab: true, SF: true, BX: true, Dom: true, hljs: true, ClipboardJS: true, Swiper: true},
        },
        rules: {
            'no-useless-escape': 'off',
        },
    },
]);
