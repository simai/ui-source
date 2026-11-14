// sf-gallery 1.3.0 against owner decision C150 (ui-control study
// control/research/2026-11-14-gallery.md, prototype prototypes/gallery-study.html):
// a grid of one picture tile, a «main picture + thumbnails» look, one ratio,
// captions in the viewer, a held first frame, the full-screen black viewer with
// zoom, the selection check box, and one tile for every set of pictures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('src/smart/gallery/component.json'));
const gallery = await read('src/smart/gallery/index.js');
const viewer = await read('src/smart/gallery/js/viewer.js');
const template = await read('src/smart/gallery/js/templates/default.js');
const css = await read('src/smart/gallery/js/templates/default.css');
const figure = await read('src/component/figure/scss/_css__figure.scss');
const core = await read('src/core/scss/_sf_css__placeholder.scss');
const ru = JSON.parse(await read('src/smart/gallery/lang/ru.json')).runtime;

test('C150 (1): a grid by default, and the main picture with thumbnails', () => {
  assert.deepEqual(manifest.settings.layout.values, ['grid', 'thumbnails']);
  assert.equal(manifest.settings.layout.default, 'grid');
  assert.match(template, /context\.layout === 'thumbnails' \? renderThumbnails\(context\) : renderGrid\(context\)/);
  assert.match(template, /class="sf-gallery-thumbs" role="group"/);
  assert.match(template, /tabindex=\$\{tile\.index === shown\.index \? '0' : '-1'\}/);
});

test('C150 (2), (3): auto-fill columns at S 96 / M 160 / L 240, at least 3 / 2 / 1, gap 8 (4 compact)', () => {
  assert.deepEqual(manifest.settings['tile-size'].values, ['s', 'm', 'l']);
  assert.equal(manifest.settings['tile-size'].default, 'm');
  assert.match(figure, /--sf-figure-grid--tile: var\(--sf-f0\);\s*--sf-figure-grid--columns: 2;\s*--sf-figure-grid--gap: var\(--sf-space-1\\\/3\);/);
  assert.match(figure, /repeat\(auto-fill, minmax\(min\(var\(--sf-figure-grid--tile\), calc\(\(100% - \(var\(--sf-figure-grid--columns\) - 1\) \* var\(--sf-figure-grid--gap\)\) \/ var\(--sf-figure-grid--columns\)\)\), 1fr\)\)/);
  assert.match(figure, /\.sf-figure-grid--s \{\s*--sf-figure-grid--tile: var\(--sf-e2\);\s*--sf-figure-grid--columns: 3;/);
  assert.match(figure, /\.sf-figure-grid--l \{\s*--sf-figure-grid--tile: var\(--sf-f5\);\s*--sf-figure-grid--columns: 1;/);
  assert.match(template, /sf-figure-grid--\$\{context\.tileSize\}/);
});

test('C150 (4): one ratio for all tiles, 1:1 by default, covering around the focus point', () => {
  assert.deepEqual(manifest.settings.ratio.values, ['1/1', '4/3', '16/9', 'auto']);
  assert.equal(manifest.settings.ratio.default, '1/1');
  assert.match(figure, /:where\(\.sf-figure--tile\) \{\s*--sf-figure--ratio: 1 \/ 1;/);
  assert.match(figure, /\.sf-figure--tile > \.sf-figure-media > :is\(img, video, svg, canvas\),\s*\.sf-figure--tile > \.sf-figure-media > picture > img \{\s*block-size: 100%;\s*object-fit: cover;/);
  // The image field's focus is the picture's object-position; the copy keeps it.
  assert.match(gallery, /template\.innerHTML = node\.outerHTML;/);
  assert.match(gallery, /object-position -- its focus point \(C94 \(3\)\) -- stays/);
});

test('C150 (5): captions in the viewer by default, under the tiles by a setting', () => {
  assert.deepEqual(manifest.settings.caption.values, ['viewer', 'under']);
  assert.equal(manifest.settings.caption.default, 'viewer');
  assert.match(template, /context\.caption === 'under' && tile\.caption \? html`<figcaption class="sf-figure-caption">/);
  assert.match(viewer, /sf-gallery-viewer-caption/);
});

test('C150 (6): the first frame holds the grid, the ratio and a quiet fill; copies load lazily', () => {
  assert.match(core, /:where\(sf-gallery:not\(:defined\)\)/);
  assert.match(core, /--sf-gallery--tile/);
  assert.match(core, /aspect-ratio: 1 \/ 1/);
  assert.match(core, /object-fit: cover/);
  assert.match(gallery, /loading = eager \? 'eager' : 'lazy'/);
});

test('C150 (7): the full-screen black viewer: «3 / 12» at the start, zoom and close at the end, arrows, keys, swipe, focus back', () => {
  assert.equal(ru['viewer-count'], '{n} / {total}');
  assert.equal(ru['viewer-count-words'], '{n} из {total}');
  assert.match(css, /\.sf-gallery-viewer \{[\s\S]*?background-color: var\(--sf-black\);[\s\S]*?color-scheme: dark;/);
  assert.match(css, /\.sf-gallery-viewer-actions \{\s*display: flex;\s*flex: none;\s*align-items: center;\s*gap: var\(--sf-space-1\\\/3\);/);
  assert.match(viewer, /<sf-button-close class="sf-gallery-viewer-control" data-sf-gallery-viewer-close appearance="media" size="1"/);
  assert.match(viewer, /ArrowRight: rtl \? -1 : 1, ArrowLeft: rtl \? 1 : -1/);
  assert.match(viewer, /event\.key === 'Home'/);
  assert.match(viewer, /event\.key === 'End'/);
  assert.match(viewer, /dialog\.addEventListener\('cancel', this\._onCancel\)/);
  assert.match(viewer, /Math\.abs\(dx\) > PAGE_SWIPE && Math\.abs\(dx\) > Math\.abs\(dy\)/);
  assert.match(viewer, /dy > CLOSE_SWIPE && dy > Math\.abs\(dx\)/);
  assert.match(css, /@media \(max-width: 43\.9375rem\) \{[\s\S]*?\.sf-gallery-viewer-side \{\s*display: none;/);
  assert.match(gallery, /_returnTarget\(opener\)/);
});

test('C150 (8): zoom by double click or tap, + and −, a button, pinch; a drag pans', () => {
  assert.match(viewer, /now - last\.time < DOUBLE_TAP_MS/);
  assert.match(viewer, /DOUBLE_TAP_MS/);
  assert.match(viewer, /event\.key === '\+' \|\| event\.key === '='/);
  assert.match(viewer, /event\.key === '-' \|\| event\.key === '_'/);
  assert.match(viewer, /zoom_in/);
  assert.match(viewer, /pinch/i);
  assert.match(css, /--sf-gallery-viewer--scale/);
});

test('C150 (9): the media-library check box, «Выбрано N», Shift for a range, Escape clears', () => {
  assert.deepEqual(manifest.settings.selection.values, ['none', 'many']);
  assert.ok(manifest.events.select);
  assert.ok(manifest.actions['clear-selection']);
  assert.equal(ru['selected-count'], 'Выбрано {count}');
  assert.match(template, /<label class="sf-figure-pick sf-checkbox sf-checkbox--size-1 flex">/);
  assert.match(figure, /\.sf-figure-grid--selecting \.sf-figure-pick \{\s*opacity: 1;/);
  assert.match(gallery, /_toggleSelected\(index, range = false\)/);
});

test('C150 (10): one picture tile in component.figure, used by sf-gallery', () => {
  assert.match(figure, /\.sf-figure\.sf-figure--tile \{/);
  assert.match(template, /figure role="listitem"[\s\S]*?class=\$\{joinClasses\('sf-figure sf-figure--tile'/);
  assert.ok(manifest.relations?.includes?.('figure') || JSON.stringify(manifest).includes('"figure"'));
});

test('The viewer is one per page, on SF.Gallery, for pictures, videos and PDF files', () => {
  assert.match(viewer, /if \(root\.Gallery\?\.view\) return root\.Gallery;/);
  const kindOf = new Function('VIDEO', 'PDF', `return function kindOf(item) {${viewer.split('function kindOf(item) {')[1].split('\n}\n')[0]}\n}`)(
    /\.(?:mp4|m4v|webm|ogv|ogg|mov)(?:[?#]|$)/iu, /\.pdf(?:[?#]|$)/iu);
  assert.equal(kindOf({src: '/a.jpg'}), 'image');
  assert.equal(kindOf({src: '/a.MP4?x=1'}), 'video');
  assert.equal(kindOf({src: '/a.pdf'}), 'pdf');
  assert.equal(kindOf({src: '/download/7', mime: 'application/pdf'}), 'pdf');
  assert.equal(kindOf({src: '/a.pdf', type: 'image'}), 'image');
});
