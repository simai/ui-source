import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// The workspace layout (docs/developer/workspace-layout.md): the sheet in the
// core sheet beside the declared-region layout, the script in core.js. The
// browser probe tests/browser/workspace-layout.browser.mjs drives the built
// core; this holds what the source promises.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const composition = read('src/core/scss/_sf_css__composition.scss');
const sheet = composition.slice(composition.indexOf('// The workspace layout'));
const script = read('src/core/js/workspace.js');
const ladder = Object.fromEntries([...read('src/core/scss/vars/_sf_var__size.scss').matchAll(/^\s*([a-i]):\s*\(([\s\S]*?)\),/gmu)]
  .flatMap(([, range, body]) => [...body.matchAll(/(\d):\s*([\d.]+rem)/gu)].map(([, step, value]) => [`${range}${step}`, value])));

test('the workspace is a core layout: core sheet and core script, nothing loaded on demand', () => {
  assert.ok(sheet.length > 1000, 'the workspace section is in the composition sheet');
  assert.match(read('src/core/scss/index.scss'), /@use 'sf_css__composition';/u);
  assert.match(read('src/core/js/index.js'), /^import '\.\/workspace\.js';$/mu);
  assert.match(script, /from '\.\/layer-stack\.js'/u, 'the drawer is a layer of the one document stack');
});

test('it follows its container, never the viewport', () => {
  assert.match(sheet, /container: sf-workspace \/ inline-size;/u);
  const queries = [...sheet.matchAll(/@container sf-workspace \(width (?:<|>=) #\{\$width\}\)/gu)];
  assert.equal(queries.length, 4, 'narrow, split, drawer and wide');
  for (const [, query] of sheet.matchAll(/@media ([^{]+)\{/gu)) {
    assert.match(query, /prefers-reduced-motion/u, `no viewport query: ${query}`);
  }
});

test('the two widths are classes on the size ladder, 40rem and 64rem by default', () => {
  const steps = (name) => Object.fromEntries([...sheet.match(new RegExp(`\\$sf-workspace-${name}-steps: \\(([^)]*)\\)`, 'u'))[1]
    .matchAll(/([a-i]\d): ([\d.]+rem)/gu)].map(([, step, value]) => [step, value]));
  for (const name of ['split', 'wide']) {
    for (const [step, value] of Object.entries(steps(name))) assert.equal(ladder[step], value, `${name} ${step} is the ladder's`);
  }
  assert.match(sheet, /\$sf-workspace-split-default: h0;/u);
  assert.match(sheet, /\$sf-workspace-wide-default: h6;/u);
  assert.equal(ladder.h0, '40rem');
  assert.equal(ladder.h6, '64rem');
});

test('regions, state attributes and the back control are the documented ones', () => {
  for (const name of ['rail', 'list', 'main', 'panel']) assert.match(sheet, new RegExp(`\\.sf-workspace-${name}\\b`, 'u'));
  assert.match(sheet, /\[data-sf-workspace-view="main"\]/u);
  assert.match(sheet, /:not\(\[data-sf-workspace-panel="open"\]\) > \.sf-workspace-panel/u);
  assert.match(sheet, /\[data-sf-workspace-list="hidden"\] > \.sf-workspace-list/u);
  assert.match(sheet, /\.sf-workspace-back/u);
  assert.match(script, /aria-current/u, 'Back returns focus to the row marked aria-current');
  assert.match(script, /'sf-workspace-view', \{view\}/u);
  assert.match(script, /'sf-workspace-panel', \{open\}/u);
});

test('the sheet is logical and respects reduced motion', () => {
  assert.doesNotMatch(sheet, /(?:^|[\s;{])(?:left|right|top|bottom|margin-(?:left|right)|padding-(?:left|right)|border-(?:left|right)|width|height)\s*:/mu,
    'logical properties only');
  assert.match(sheet, /@media \(prefers-reduced-motion: no-preference\) \{\s*transition: translate/u, 'the slide only without reduced motion');
  assert.match(sheet, /:dir\(rtl\) > \.sf-workspace-panel/u, 'the drawer comes from the left in RTL');
});

test('no logical property inside a step: the build writes each out for both directions', () => {
  const steps = sheet.slice(sheet.indexOf('@each $step, $width in $sf-workspace-split-steps'));
  assert.doesNotMatch(steps, /^\s*(?:inset-|inline-size|block-size|min-inline|max-inline|border-inline|margin-inline|padding-inline)[a-z-]*\s*:/mu);
});

test('public variables and the JS API list the workspace', () => {
  const variables = JSON.parse(read('src/core/contracts/public-variables.v1.json')).components.find(({component}) => component === 'workspace');
  assert.deepEqual(variables.variables.map(({name}) => name), [
    '--sf-workspace-rail', '--sf-workspace-list', '--sf-workspace-panel', '--sf-workspace-gap',
    '--sf-workspace-divider-color', '--sf-workspace-drawer-background',
  ]);
  assert.equal(variables.variables.find(({name}) => name === '--sf-workspace-list').default, 'var(--sf-g0)');
  assert.equal(variables.variables.find(({name}) => name === '--sf-workspace-panel').default, 'var(--sf-g1)');
  const api = JSON.parse(read('src/core/contracts/public-js-api.json')).globals.find(({name}) => name === 'SF.workspace');
  assert.deepEqual([api.status, api.kind, api.loaded_by], ['public', 'function', 'core']);
});
