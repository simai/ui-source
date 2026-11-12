// sf-input-color 1.7.0: the Framework's own colour window (owner decisions C83,
// C86, round 4 R167-R170, C84; defects CO-03, CO-06, CO-07). The window itself
// is driven in the browser by the manifest probes (examples.json conformance);
// this suite holds what can be read from the source: the palette, the value
// form, the formats, the recents rule and the look rules of the sheet.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

import {STATIC_HUE_NAMES} from '../src/core/js/theme-palette.js';
import {
    PALETTE, formatColour, normaliseHex, paletteFill, parseColour, parseHex, rgbToHsv, solidOf, statesAlpha, toHex,
} from '../src/smart/input-color/js/color-math.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const base = 'src/smart/input-color';

test('the palette is the sixteen static hues of C17, in their order', () => {
    assert.deepEqual([...PALETTE], [...STATIC_HUE_NAMES]);
    assert.equal(paletteFill('blue'), 'light-dark(var(--sf-blue-50), var(--sf-blue-70))');
});

test('every hue has its word in ru and en, and the window speaks both', () => {
    const ru = json(`${base}/lang/ru.json`).runtime;
    const en = json(`${base}/lang/en.json`).runtime;
    assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
    for (const hue of PALETTE) {
        assert.ok(ru[`hue-${hue}`], `ru hue-${hue}`);
        assert.ok(en[`hue-${hue}`], `en hue-${hue}`);
    }
    assert.equal(ru['hue-blue'], 'Синий');
    assert.equal(ru.palette, 'Палитра');
    assert.equal(ru.own, 'Своё');
});

test('a code is stored lowercase and long; an opaque alpha is dropped', () => {
    assert.equal(normaliseHex('#ABC'), '#aabbcc');
    assert.equal(normaliseHex('#1F6FEBFF'), '#1f6feb');
    assert.equal(normaliseHex('#1f6feb80'), '#1f6feb80');
    assert.equal(normaliseHex('blue'), '');
    assert.equal(solidOf('#1f6feb80'), '#1f6feb');
    assert.deepEqual(parseHex('#f00'), {rgb: [255, 0, 0], a: 1});
    assert.equal(toHex([255, 0, 0], 0.5), '#ff000080');
});

test('the code field reads and writes Hex, RGB, HSL and HSB (R170), and asks the page for any other CSS colour', () => {
    const red = rgbToHsv([255, 0, 0]);
    assert.equal(formatColour(red, 'hex'), '#FF0000');
    assert.equal(formatColour(red, 'rgb'), '255, 0, 0');
    assert.equal(formatColour(red, 'hsl'), '0°, 100%, 50%');
    assert.equal(formatColour(red, 'hsb'), '0°, 100%, 100%');
    assert.deepEqual(parseColour('#00ff00', 'rgb').rgb, [0, 255, 0]);
    assert.deepEqual(parseColour('0, 0, 255', 'rgb').rgb, [0, 0, 255]);
    assert.deepEqual(parseColour('rgb(0 0 255)', 'rgb').rgb, [0, 0, 255]);
    assert.deepEqual(parseColour('120°, 100%, 50%', 'hsl').rgb.map(Math.round), [0, 255, 0]);
    assert.deepEqual(parseColour('240, 100, 100', 'hsb').rgb.map(Math.round), [0, 0, 255]);
    assert.equal(parseColour('300, 0, 0', 'rgb'), null, 'out of range is not a colour');
    let asked = '';
    parseColour('oklch(0.6 0.2 250)', 'hex', (text) => {
        asked = text;
        return {rgb: [1, 2, 3], a: 1};
    });
    assert.equal(asked, 'oklch(0.6 0.2 250)');
    assert.ok(statesAlpha('#1f6feb80'));
    assert.ok(!statesAlpha('#1f6feb'));
});

test('recent own colours: one list per site (a view preference), own colours only, 16 kept, 8 shown, translucent hidden without alpha (R168)', async () => {
    const stored = new Map();
    globalThis.localStorage = {
        getItem: (key) => (stored.has(key) ? stored.get(key) : null),
        setItem: (key, value) => stored.set(key, String(value)),
        removeItem: (key) => stored.delete(key),
    };
    delete globalThis[Symbol.for('sf.input-color.recent')];
    if (globalThis.SF) delete globalThis.SF.Preferences;
    const recent = await import('../src/smart/input-color/js/recent.js');
    assert.equal(recent.RECENT_KEY, 'sf-input-color/recent');
    assert.equal(recent.RECENT_KEEP, 16);
    assert.equal(recent.RECENT_SHOW, 8);
    let told = 0;
    recent.onRecentChange(() => { told += 1; });
    recent.rememberColour('blue');
    assert.deepEqual(recent.recentColours(), [], 'a palette name is never a recent colour');
    for (let index = 0; index < 20; index += 1) recent.rememberColour(`#0000${index.toString(16).padStart(2, '0')}`);
    assert.equal(recent.recentColours().length, 16);
    assert.equal(recent.recentColours()[0], '#000013', 'newest first');
    recent.rememberColour('#00000a');
    assert.equal(recent.recentColours()[0], '#00000a', 'a repeat moves to the top');
    assert.equal(recent.recentColours().filter((hex) => hex === '#00000a').length, 1);
    recent.rememberColour('#1F6FEB80');
    assert.equal(recent.recentColours({alpha: true})[0], '#1f6feb80');
    assert.ok(!recent.recentColours().includes('#1f6feb80'), 'a field without alpha hides translucent colours');
    assert.deepEqual(JSON.parse(stored.get('sf-pref:sf-input-color/recent')).slice(0, 2), ['#1f6feb80', '#00000a']);
    assert.ok(told >= 21);
    recent.forgetRecentColours();
    assert.deepEqual(recent.recentColours({alpha: true}), []);
    assert.equal(stored.get('sf-pref:sf-input-color/recent') ?? null, null);
});

test('the browser colour dialog is gone; the window is the Framework\'s own (C83)', () => {
    const template = read(`${base}/js/templates/default.js`);
    const element = read(`${base}/index.js`);
    assert.doesNotMatch(template, /type="color"/u);
    assert.doesNotMatch(element, /showPicker/u);
    assert.match(template, /<sf-segmented size="1\/2"/u, '«Палитра / Своё» is the standard segmented control');
    assert.match(template, /role="radiogroup"/u);
    assert.match(template, /role="slider"/u);
    assert.match(template, /role="menuitemradio"/u);
    assert.match(element, /position\(\)\.anchor\(anchor, panel/u, 'anchored by core\'s positioning');
    assert.match(element, /data-sf-sheet/u, 'a sheet on a phone');
    assert.match(element, /holdOpenSurfaceMark\(this, true/u, 'a layer of the document stack');
    assert.match(element, /EyeDropper/u);
});

test('the manifest declares the window\'s settings and words', () => {
    const manifest = json(`${base}/component.json`);
    assert.equal(manifest.version, '1.7.0');
    assert.equal(manifest.settings.palette.default, true);
    assert.equal(manifest.settings.custom.default, true);
    assert.equal(manifest.settings.alpha.default, false);
    assert.ok(manifest.relations.some((relation) => relation.name === 'cl-segmented' && relation.lazy));
    assert.ok(manifest.relations.some((relation) => relation.name === 'cl-icon'));
});

test('the sheet: one height in the row (CO-03), three swatch bounds (CO-06), paint inside the border (R169), the split swatch (C86)', () => {
    const sheet = read(`${base}/js/templates/default.css`);
    assert.doesNotMatch(sheet, /\.sf-color-preset/u, 'the product colours left the row for the window');
    assert.match(sheet, /\.sf-color-frame \{[^}]*block-size: var\(--sf-color--control-height\)/u);
    assert.match(sheet, /\.sf-color--outlined \.sf-color-chip \{\s*border-color: var\(--sf-outline\)/u);
    assert.match(sheet, /\.sf-color--plain \.sf-color-chip \{\s*border-width: 0/u);
    assert.match(sheet, /\.sf-color-chip \{[^}]*background-clip: padding-box/u);
    assert.match(sheet, /\[data-alpha\] \{\s*background:\s*linear-gradient\(90deg, transparent 50%, var\(--sf-color-solid\) 50%\)/u,
        'C86: left as it is over the checkerboard, right without alpha');
    // 304 on a desktop: eight 1/3-rung swatches, 8 apart, 12 inside.
    assert.match(sheet, /inline-size: calc\(8 \* var\(--sf-color--swatch\) \+ 7 \* var\(--sf-color--swatch-gap\) \+ 2 \* var\(--sf-color--window-padding\)\)/u);
    assert.doesNotMatch(sheet.replace(/\/\*[\s\S]*?\*\//gu, ''), /\d+px/u, 'no raw px (C18)');
});
