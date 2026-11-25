import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

// Name and value in one badge (owner decisions C317-C319, 2026-11-18; study
// ui-control prototypes/composite-badge-study.html, variant A): one pill, a
// one-pixel divider as high as the text line, the value after it; the pair
// never breaks. Class first, Smart inherits (C318); a static mark (C319).
// The drawn geometry is tests/browser/badge-composite.browser.mjs's.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const sheet = read('src/component/badges/scss/_css__badges.scss');
const plain = (text) => text.replace(/\s+/gu, ' ');

test('C317 class: the divider and the value parts, the gap on a composite badge, no inner wrap', () => {
  const css = plain(sheet);
  assert.match(css, /\.sf-badge:has\(> \.sf-badge-divider\) \{ --sf-badge--gap: var\(--sf-badge-gap, var\(--sf-space-1\\\/3\)\); \}/u);
  assert.match(css, /\.sf-badge \.sf-badge-divider \{ flex: none; align-self: stretch; inline-size: var\(--sf-px\); \}/u);
  assert.match(css, /\.sf-badge \.sf-badge-value \{ flex: none; white-space: nowrap; \}/u);
  // The divider's colour: --sf-outline on a fill, the border colour on
  // outline, the text colour on the filled count; disabled takes its role.
  assert.match(css, /--sf-badge--divider-color: var\(--sf-badge-divider-color, var\(--sf-outline\)\);/u);
  assert.match(css, /\.sf-badge--outline \{[^}]*--sf-badge--divider-color: var\(--sf-badge-divider-color, var\(--sf-badge--border-color\)\);/u);
  assert.match(css, /\.sf-badge\.sf-badge--main:is\(\.sf-badge--error, \.sf-badge--danger\) \{[^}]*--sf-badge--divider-color: var\(--sf-badge-divider-color, var\(--sf-badge--color\)\);/u);
  assert.match(css, /\.sf-badge\.sf-badge--disabled \{[^}]*--sf-badge--divider-color: var\(--sf-outline-disabled\);[^}]*--sf-badge--value-color: var\(--sf-on-surface-disabled\);/u);
  // Paint in sf.paint, under the utilities (C273).
  const paint = css.slice(css.indexOf('@layer sf.paint'));
  assert.match(paint, /\.sf-badge \.sf-badge-divider \{ background-color: var\(--sf-badge--divider-color\); \}/u);
  assert.match(paint, /\.sf-badge \.sf-badge-value \{ color: var\(--sf-badge--value-color\); \}/u);
  // The name truncates: the text keeps its ellipsis.
  assert.match(css, /\.sf-badge \.sf-badge-text \{[^}]*overflow: hidden; text-overflow: ellipsis; white-space: nowrap;/u);
});

test('C317 public variable: --sf-badge-divider-color, and the badge stays within ten', () => {
  const entry = json('src/core/contracts/public-variables.v1.json').components.find((item) => item.component === 'badge');
  const divider = entry.variables.find((variable) => variable.name === '--sf-badge-divider-color');
  assert.ok(divider, 'the divider colour is public');
  assert.equal(divider.role, 'indicator-color');
  assert.equal(divider.default, 'var(--sf-outline)');
  assert.ok(entry.variables.length <= 10);
  assert.ok(json('src/smart/badge/component.json')['css-variables']['--sf-badge-divider-color']);
});

test('C317 Smart: value, value-label and the slot value; the word in the language files', () => {
  const component = json('src/smart/badge/component.json');
  assert.equal(component.version, '1.8.1'); // C411: moved on by the hue setting
  assert.equal(json('src/component/badges/passport.json').version, '1.14.0'); // C411: moved on by the hue classes
  assert.deepEqual(component.settings.value, {...component.settings.value, type: 'string', default: ''});
  assert.equal(component.settings['value-label']['default-from'], 'runtime.value-label');
  assert.ok(component.slots.value);
  assert.ok(component['x-words'].includes('value-label') && !component['x-words'].includes('value'));
  assert.equal(json('src/smart/badge/lang/en.json').runtime['value-label'], 'value');
  assert.equal(json('src/smart/badge/lang/ru.json').runtime['value-label'], 'значение');
  assert.equal(json('src/core/lang/ru/badge.json').words['sf-badge']['value-label'], 'значение');
  // No click, no copy (C319): the badge declares no event or action.
  assert.deepEqual(component.events, {});
  assert.deepEqual(component.actions, {});
});

test('C317 Smart template: the divider hidden, a hidden word before the value; without a value the template of 1.6.3', () => {
  const template = read('src/smart/badge/js/templates/default.js');
  assert.match(template, /<span class="sf-badge-divider" aria-hidden="true"><\/span><span class="sf-badge-value" aria-hidden=\$\{hasAccessibleLabel \? 'true' : nothing\}><span class="sr-only">, \$\{context\.valueLabel\} <\/span>\$\{content\}<\/span>/u);
  // The template literal drawn without a value is the one 1.6.3 drew,
  // character for character (base 1dd18375c), so its markup is byte-identical.
  // From the backtick after `start` to the template's closing line.
  const literal = (source, start) => {
    const from = source.indexOf('html`', source.indexOf(start)) + 5;
    return source.slice(from, source.indexOf('\n  `;', from));
  };
  let before = '';
  try {
    before = execFileSync('git', ['show', '1dd18375c:src/smart/badge/js/templates/default.js'], {cwd: new URL('..', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
  } catch {
    return; // a source archive without history: the browser probe compares the markup
  }
  assert.equal(literal(template, 'if (value === nothing) return'), literal(before, '].filter(Boolean);'));
});
