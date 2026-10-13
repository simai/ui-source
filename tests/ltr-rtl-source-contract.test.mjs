import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('flow-relative source declarations use logical inline properties', async () => {
  const cases = [
    ['src/component/dropdown/scss/_css__custom.scss', 'inset-inline-end: calc(var(--sf-dropdown-field--padding-inline-end) - var(--sf-icon-button--padding-inline-end, 0px));'],
    ['src/component/toggle/scss/_css_toggle_custom.scss', 'inset-inline-start: 0;'],
    ['src/component/toggle/scss/_css_toggle_custom.scss', 'inset-inline-end: 0;'],
    ['src/core/scss/_sf_css__typograpy.scss', 'padding-inline-start: var(--sf-text--size-2);'],
    ['src/plugin/plugin3/scss/color/color.scss', 'padding-inline-start: 2rem;'],
    ['src/smart/toggle/scss/styles_default.scss', 'inset-inline-start: var(--sf-toggle--top);'],
    ['src/smart/toggle/scss/styles_default.scss', 'inset-inline-start: calc(var(--sf-a2) * -1);'],
  ];

  for (const [path, declaration] of cases) {
    assert.match(await read(path), new RegExp(declaration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('documentation styles use the local Framework monospace contract', async () => {
  const source = await read('src/component/doc/scss/_sf_css_doc.scss');

  assert.match(source, /font-family: var\(--sf-mono\)/);
  assert.doesNotMatch(source, /@import\s+url\(/);
  assert.doesNotMatch(source, /fonts\.googleapis\.com/);
});

test('legacy Smart transport remains source-backed without physical inline placement', async () => {
  const [avatarsSource, sliderTemplate, ...avatarTemplates] = await Promise.all([
    read('src/smart/avatars/index.js'),
    read('src/smart/slider/template/default/index.html'),
    read('src/smart/avatars/template/default/index.html'),
    read('src/smart/avatars/template/group/index.html'),
    read('src/smart/avatars/template/label/index.html'),
    read('src/smart/avatars/template/profile/index.html'),
    read('src/smart/avatars/template/user/index.html'),
  ]);

  assert.match(avatarsSource, /import '\.\.\/\.\.\/component\/avatars\/scss\/index\.scss';/);
  assert.match(sliderTemplate, /--inset-inline-start: var\(--sf-a4\)/);
  assert.match(sliderTemplate, /--inset-inline-end: var\(--sf-g3\)/);
  assert.doesNotMatch(sliderTemplate, /(?:^|[;\s])(?:left|right)\s*:/m);
  for (const template of avatarTemplates) {
    assert.match(template, /<div|<smart/);
  }
});

test('Link and File Preview are canonical source-backed logical components', async () => {
  const [linkEntry, linkStyles, previewEntry, previewStyles] = await Promise.all([
    read('src/component/link/index.js'),
    read('src/component/link/scss/_css__link.scss'),
    read('src/component/file-preview/index.js'),
    read('src/component/file-preview/scss/_css__file_preview.scss'),
  ]);

  assert.match(linkEntry, /import '\.\/scss\/index\.scss';/);
  assert.match(linkStyles, /\.sf-link-content/);
  assert.match(previewEntry, /import '\.\/scss\/index\.scss';/);
  assert.match(previewStyles, /padding-inline-start:/);
  assert.match(previewStyles, /padding-inline-end:/);
  assert.match(previewStyles, /border-start-start-radius:/);
  assert.match(previewStyles, /border-end-end-radius:/);
  assert.doesNotMatch(previewStyles, /(?:^|[;{\s])(?:left|right)\s*:/m);
});

test('Smart Drawer preserves physical aliases and adds logical placement', async () => {
  const [source, styles, docs] = await Promise.all([
    read('src/smart/drawer/index.js'),
    read('src/smart/drawer/scss/_smart__drawer.scss'),
    read('src/smart/drawer/docs.md'),
  ]);

  assert.match(source, /values: \['left', 'right', 'inline-start', 'inline-end'\]/);
  assert.match(source, /body\.style\.paddingInlineEnd/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /drawer:ready/);
  assert.match(source, /onBeforeOpen\(handler, options\)/);
  assert.match(source, /setState\(state = \{\}\)/);
  assert.match(styles, /data-sf-drawer-placement='inline-start'/);
  assert.match(styles, /data-sf-drawer-placement='inline-end'/);
  // The logical edge stays logical; it is the stack inset (0 unless stacked).
  assert.match(styles, /inset-inline-start: var\(--sf-drawer-stack-inset\)/);
  assert.match(styles, /inset-inline-end: var\(--sf-drawer-stack-inset\)/);
  assert.match(styles, /data-sf-drawer-placement='left'/);
  assert.match(styles, /data-sf-drawer-placement='right'/);
  assert.match(docs, /Physical `left\|right` values remain supported/);
});

test('smart toggle mirrors its checked translation in RTL', async () => {
  const source = await read('src/smart/toggle/scss/styles_default.scss');
  assert.match(source, /\.sf-toggle:dir\(rtl\)[^{]+\{[^}]*translateX\(calc\(var\(--sf-checkbox-sl-r-translate\) \* -1\)\)/s);
  assert.match(source, /translateX\(var\(--sf-checkbox-sl-r-translate\)\)/);
});

test('modal keeps physical values and adds semantic inline variants', async () => {
  const [componentCss, buttonCss, smartModal, smartTemplate] = await Promise.all([
    read('src/component/modal/scss/_css__modal_custom.scss'),
    read('src/component/modal/scss/_css__modal_buttons.scss'),
    read('src/smart/modal/index.js'),
    read('src/smart/modal/js/templates/default.js'),
  ]);

  assert.match(smartModal, /"left",\s*"right",\s*"inline-start",\s*"inline-end"/s);
  for (const value of ['left', 'right', 'inline-start', 'inline-end']) {
    assert.ok(componentCss.includes(`data-sf-modal-position='${value}'`));
  }
  assert.match(componentCss, /data-sf-modal-position='inline-start'\]:dir\(rtl\)/);
  assert.match(componentCss, /data-sf-modal-position='inline-end'\]:dir\(rtl\)/);
  assert.match(buttonCss, /\.sf-modal-close-button--inline-end/);
  assert.match(buttonCss, /--sf-modal-close-right/);
  assert.match(smartTemplate, /sf-modal-close-button--inline-end/);
});

test('progress bar keeps right and accepts inline-end', async () => {
  const [component, template, fileUpload] = await Promise.all([
    read('src/component/progress-bar/js/_progressbar.js'),
    read('src/smart/progress-bar/js/templates/default.js'),
    read('src/smart/file-upload/js/templates/default.js'),
  ]);

  assert.match(component, /'right', 'inline-end'/);
  assert.match(template, /'right', 'inline-end'/);
  assert.match(fileUpload, /text-position="inline-end"/);
});

test('intentional geometry coordinates remain available', async () => {
  const [position, placement, range] = await Promise.all([
    read('src/core/js/position.js'),
    read('src/core/js/position-placement.js'),
    read('src/component/range-slider/scss/_css__range_slider_custom.scss'),
  ]);

  // Anchored surfaces use physical viewport coordinates; direction is handled
  // by mapping logical placements (inline-start mirrors in RTL).
  assert.match(position, /left: `\$\{result\.x\}px`, top: `\$\{result\.y\}px`/);
  assert.match(placement, /side === 'inline-start' \? \(rtl \? 'right' : 'left'\)/);
  assert.match(range, /left: 50%/);
});
