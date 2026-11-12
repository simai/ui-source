// sf-steps 1.4.0, owner decision C101 (2026-11-12) on the R185 steps study
// (ui-control control/research/2026-11-12-steps.md, prototype
// prototypes/steps-study.html). One test per accepted item, and the study's
// defects ST-1..ST-14 that the items close.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  COUNT_BELOW_REM, LAYOUTS, MARKERS, NAVIGATION, STATES, ownState, parseItems, reachable, resolveStates,
} from '../src/smart/steps/js/items.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const component = json('src/smart/steps/component.json');
const template = read('src/smart/steps/js/templates/default.js');
const element = read('src/smart/steps/index.js');
const stepCss = read('src/component/step/scss/_css__step.scss');
const stepsCss = read('src/component/step/scss/_css__steps.scss');
const docs = read('src/smart/steps/docs/docs.md');
const notes = () => [...(globalThis.SF?.__deprecationNotes?.values?.() ?? [])];
const rule = (css, selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.notEqual(at, -1, `rule ${selector}`);
  return css.slice(at, css.indexOf('}', at));
};

test('versions: smart.steps 1.4.0, component.step 1.3.0', () => {
  assert.equal(component.version, '1.4.0');
  assert.equal(json('src/smart/steps/smart.manifest.json').version, '1.4.0');
  assert.equal(json('src/component/step/passport.json').version, '1.3.0');
});

test('C101 (1) role: an ordered process of a person; a server job is sf-progress-run, tasks in any order are not steps', () => {
  assert.match(docs, /sf-progress-run/);
  assert.match(docs, /в любом порядке/);
  assert.match(component['x-summary'], /ordered process/);
  assert.match(component['x-registry'].ai_guidance.use_when, /sf-progress-run/);
  assert.match(element, /A job the server runs is sf-progress-run/);
});

test('C101 (2) look: marker, label, line -- 2 px progress behind current, 1 px outline-variant after; no pills, no separator glyph', () => {
  assert.doesNotMatch(template, /sf-steps-separator|chevron_right|separatorIcon/);
  assert.doesNotMatch(stepsCss + stepCss, /\.sf-steps-separator|primary-container/);
  const line = rule(stepsCss, '.sf-steps:is(.sf-steps--layout-row, [data-sf-measure]) .sf-step:not(:last-child)::after');
  assert.match(line, /block-size: var\(--sf-px\);/);
  assert.match(line, /background-color: var\(--sf-steps-separator-color, var\(--sf-outline-variant\)\);/);
  const passed = rule(stepsCss, '.sf-steps:is(.sf-steps--layout-row, [data-sf-measure]) .sf-step.sf-step--passed:not(:last-child)::after');
  assert.match(passed, /block-size: calc\(var\(--sf-px\) \* 2\);/);
  assert.match(passed, /background-color: var\(--sf-step--progress\);/);
  assert.match(stepCss, /--sf-step--progress: var\(--sf-steps-completed-icon-color, var\(--sf-primary\)\);/);
  // Labels never break inside a word (ST-1), in every layout.
  assert.match(rule(stepCss, '.sf-step .sf-step-container'), /overflow-wrap: normal;\n  word-break: normal;/);
  assert.doesNotMatch(stepCss + stepsCss, /overflow-wrap: (anywhere|break-word)|word-break: break-/);
  assert.match(rule(stepsCss, '.sf-steps:is(.sf-steps--layout-row, [data-sf-measure]) .sf-step .sf-step-container'), /white-space: nowrap;/);
});

test('C101 (3) marker: number (default) or dot; the marker box is the rung\'s text line, 24 at 1 and 20 at 1/2', () => {
  assert.deepEqual(MARKERS, ['number', 'dot']);
  assert.deepEqual(component.settings.marker.values, ['number', 'dot']);
  assert.equal(component.settings.marker.default, 'number');
  assert.match(rule(stepCss, '.sf-step'), /--sf-step--marker: var\(--sf-text-height-1\);\n  --sf-step--dot: var\(--sf-a8\);/);
  assert.match(rule(stepCss, '.sf-step.sf-step--size-1\\/2'), /--sf-step--marker: var\(--sf-text-height-1\\\/2\);\n  --sf-step--dot: var\(--sf-a6\);/);
  const marker = rule(stepCss, '.sf-step .sf-step-marker');
  assert.match(marker, /inline-size: var\(--sf-step--marker\);\n  block-size: var\(--sf-step--marker\);/);
  // The number is a rung lower; the icon goes through the icon's own variables (ST-10).
  assert.match(rule(stepCss, '.sf-step .sf-step-marker .sf-icon'), /--sf-icon--font-size: var\(--sf-step--icon\);/);
  assert.match(template, /context\.marker === 'dot'/);
  assert.match(template, /String\(item\.index \+ 1\)/);
});

test('C101 (4) layout: auto (default), row, column, count; auto measures its own width, count under 20rem', () => {
  assert.deepEqual(LAYOUTS, ['auto', 'row', 'column', 'count']);
  assert.deepEqual(component.settings.layout.values, LAYOUTS);
  assert.equal(component.settings.layout.default, 'auto');
  assert.equal(COUNT_BELOW_REM, 20);
  assert.match(element, /if \(fit\.room < COUNT_BELOW_REM \* fit\.rem\) next = 'count';/);
  assert.match(element, /else if \(fit\.need > fit\.room \+ 1\) next = 'column';/);
  assert.match(element, /root\.setAttribute\('data-sf-measure', ''\)/);
  assert.match(element, /new ResizeObserver\(\(\) => this\.checkFit\(\)\)/);
  // The count line: «Шаг N из M · label» over sf-progress-bar 1/3, as sf-wizard.
  assert.match(template, /<sf-progress-bar size="1\/3" value=\$\{String\(position\.value\)\}/);
  assert.match(template, /\$\{position\.text\} ·/);
  assert.equal(json('src/smart/steps/lang/ru.json').runtime['count-label'], 'Шаг {n} из {count}');
  assert.equal(json('src/smart/steps/lang/en.json').runtime['count-label'], 'Step {n} of {count}');
  // The column shows the second line; the row hides it.
  assert.match(rule(stepsCss, '.sf-steps:is(.sf-steps--layout-row, [data-sf-measure]) .sf-step .sf-step-text'), /display: none;/);
  assert.match(rule(stepsCss, '.sf-steps.sf-steps--layout-column:not([data-sf-measure]) .sf-step .sf-step-body'), /grid-template-columns: var\(--sf-step--marker\) minmax\(0, 1fr\);/);
  assert.match(rule(stepsCss, '.sf-steps.sf-steps--layout-count:not([data-sf-measure]) .sf-steps-container'), /display: none;/);
  assert.ok(component.relations.some(({name}) => name === 'cl-progress-bar'));
});

test('C101 (5) behaviour: passive by default; navigation visited | free makes the reachable steps buttons', () => {
  assert.deepEqual(NAVIGATION, ['', 'visited', 'free']);
  assert.deepEqual(component.settings.navigation.values, NAVIGATION);
  assert.equal(component.settings.navigation.default, '');
  const items = resolveStates([{label: 'a'}, {label: 'b', state: 'skipped'}, {label: 'c'}, {label: 'd', state: 'done'}, {label: 'e', disabled: true}], 2);
  const reach = (navigation) => items.map((item) => reachable(item, navigation));
  assert.deepEqual(reach(''), [false, false, false, false, false]);
  assert.deepEqual(reach('visited'), [true, true, false, true, false]);
  assert.deepEqual(reach('free'), [true, true, false, true, false]);
  const ahead = resolveStates([{label: 'a'}, {label: 'b'}, {label: 'c'}], 0);
  assert.deepEqual(ahead.map((item) => reachable(item, 'visited')), [false, false, false]);
  assert.deepEqual(ahead.map((item) => reachable(item, 'free')), [false, true, true]);
  // An ol, aria-current on the current item, a state word in every item.
  assert.match(template, /<ol\s+class="sf-steps-container"\s+role="list"/);
  assert.match(template, /aria-current=\$\{item\.current \? 'step' : nothing\}/);
  assert.match(template, /<span class="sr-only">, \$\{word\}<\/span>/);
  assert.equal(component.accessibility.role, 'list');
});

test('C101 (6) states: by shape and the progress colour; running is the spinner; all done; no green', () => {
  assert.deepEqual(STATES, ['done', 'current', 'ahead', 'error', 'skipped', 'running']);
  const states = (items, current, errorStep) => resolveStates(items, current, errorStep).map((item) => item.state);
  // The place decides without an own state.
  assert.deepEqual(states([{label: 'a'}, {label: 'b'}, {label: 'c'}], 1), ['done', 'current', 'ahead']);
  // running and error win over the place; done and skipped at current draw current.
  assert.deepEqual(states([{label: 'a', state: 'error'}, {label: 'b', state: 'running'}, {label: 'c', state: 'done'}], 1), ['error', 'running', 'done']);
  assert.deepEqual(states([{label: 'a'}, {label: 'b', state: 'done'}], 1), ['done', 'current']);
  // A step before current never done says ahead; skipped stays skipped.
  assert.deepEqual(states([{label: 'a', state: 'ahead'}, {label: 'b', state: 'skipped'}, {label: 'c'}], 2), ['ahead', 'skipped', 'current']);
  // All done (ST-4): current equal to the number of steps.
  const done = resolveStates([{label: 'a'}, {label: 'b'}], 2);
  assert.deepEqual(done.map((item) => item.state), ['done', 'done']);
  assert.ok(done.every((item) => item.passed && !item.current));
  assert.match(element, /return Math\.min\(Math\.max\(this\.getNumberAttr\('current', 0\), 0\), count\);/);
  // Shapes: done filled with a check, current filled with a ring through a gap,
  // ahead empty, error the error colour, skipped dashed (C61, C73).
  assert.match(template, /const MARK_ICONS = \{ done: 'check', error: 'priority_high' \};/);
  assert.match(stepCss, /\.sf-steps--marker-number \.sf-step--state-current \.sf-step-marker \{\n  outline: var\(--sf-step--ring\) solid var\(--sf-steps-current-border-color, var\(--sf-step--progress\)\);\n  outline-offset: var\(--sf-step--ring\);/);
  assert.match(stepCss, /\.sf-steps--marker-dot \.sf-step--state-current \.sf-step-marker::before \{\n  outline: var\(--sf-step--ring\)/);
  assert.match(rule(stepCss, '.sf-steps--marker-number .sf-step .sf-step-marker'), /border: var\(--sf-px\) solid var\(--sf-steps-step-border-color, var\(--sf-outline\)\);/);
  assert.match(rule(stepCss, '.sf-steps--marker-number .sf-step--state-error .sf-step-marker'), /background-color: var\(--sf-error\);/);
  assert.match(rule(stepCss, '.sf-steps--marker-number .sf-step--state-skipped .sf-step-marker'), /border-style: dashed;/);
  assert.match(rule(stepCss, '.sf-steps--marker-dot .sf-step--state-skipped .sf-step-marker::before'), /border-style: dashed;/);
  // Running: the Framework spinner at the rung's size, no ring of its own.
  assert.match(template, /<sf-spinner size=\$\{context\.size\} infinite label=""><\/sf-spinner>/);
  const running = rule(stepCss, '.sf-steps .sf-step--state-running .sf-step-marker');
  assert.match(running, /border: 0;\n  background: none;\n  outline: 0;/);
  assert.ok(component.relations.some(({name}) => name === 'cl-spinner'));
  // No green in the steps (ST-5).
  assert.doesNotMatch(stepCss + stepsCss, /--sf-success/);
  assert.doesNotMatch(template, /check_circle/);
});

test('C101 (7) data: one list format, JSON items with a state each; the old forms are read and noted until 2027-01-01', () => {
  assert.deepEqual(component.settings.items.of.state.values, ['done', 'ahead', 'skipped', 'running', 'error', 'completed', 'default']);
  assert.deepEqual(parseItems('[{"label":"A","state":"done","text":"10:14"},{"label":"B","disabled":true}]'), [
    {label: 'A', text: '10:14', state: 'done'},
    {label: 'B', disabled: true},
  ]);
  assert.deepEqual(parseItems([{label: 'A', state: 'nonsense'}, 'B']), [{label: 'A'}, {label: 'B'}]);
  globalThis.SF?.__deprecationNotes?.clear?.();
  assert.equal(ownState('completed'), 'done');
  assert.equal(ownState('default'), 'ahead');
  assert.deepEqual(parseItems('Корзина::completed|Доставка::disabled|Оплата::error'), [
    {label: 'Корзина', state: 'done'},
    {label: 'Доставка', disabled: true},
    {label: 'Оплата', state: 'error'},
  ]);
  const seen = notes();
  for (const from of ['completed', 'default', 'label::flag|label']) {
    const note = seen.find((one) => one.from === from);
    assert.ok(note, from);
    assert.equal(note.tag, 'sf-steps');
    assert.equal(note.since, '2026-11-12');
    assert.equal(note.remove_after, '2027-01-01');
  }
  // error-step and separator-icon are noted by the element.
  assert.match(element, /noteOld\('attribute', 'error-step', 'error-step'/);
  assert.match(element, /noteOld\('attribute', 'separator-icon', 'separator-icon', null\)/);
  // The journal holds the record.
  const record = json('contracts/changes/journal.json').records.find((one) => one.id === 'value-steps-one-list-format');
  assert.equal(record.remove_after, '2027-01-01');
  // setState writes JSON, the one format.
  assert.match(element, /this\.setAttribute\(attr, JSON\.stringify\(/);
});

test('ST-1..ST-14: each defect of the study is closed or named', () => {
  const closed = {
    'ST-1': /overflow-wrap: normal/.test(stepCss) && /white-space: nowrap/.test(stepsCss),
    'ST-2': /sf-steps--layout-column/.test(stepsCss) && /sf-steps-count/.test(stepsCss),
    'ST-3': /item\.reachable\s*\? html`<button/.test(template),
    'ST-4': /count > 0 && this\.current >= count/.test(element),
    'ST-5': !/--sf-success/.test(stepCss),
    'ST-6': /--sf-step--progress/.test(stepCss) && !/primary-container/.test(stepCss),
    'ST-7': !/sf-steps-separator/.test(template),
    'ST-8': /String\(item\.index \+ 1\)/.test(template) && /count-label/.test(element),
    'ST-9': /sf-step-text/.test(template) && component.settings.items.of.text?.optional === true,
    'ST-10': /--sf-step--marker: var\(--sf-text-height-1\\\/2\)/.test(stepCss),
    'ST-11': /## Сценарии/.test(docs) && /## Состояния/.test(docs) && json('src/smart/steps/examples.json').examples.some((one) => one.name === 'states'),
    'ST-12': /one list format/i.test(component['x-decisions'].at(-1)),
    'ST-13': /role="list"/.test(template) && !/role="group"/.test(template),
  };
  for (const [id, ok] of Object.entries(closed)) assert.ok(ok, id);
  // ST-14 (no product uses sf-steps) is not a code defect: sf-wizard is its host
  // and draws its row with layout="row" navigation="free".
  assert.match(read('src/smart/wizard/js/templates/default.js'), /layout="row" navigation="free"/);
});

test('the examples cover the study\'s scenarios and every state', () => {
  const examples = json('src/smart/steps/examples.json').examples;
  assert.deepEqual(examples.map((one) => one.name), ['reference', 'move', 'order', 'install', 'states', 'dots', 'count', 'done', 'compact']);
  const states = examples.find((one) => one.name === 'states').settings.items.map((item) => item.state ?? '');
  assert.deepEqual(states, ['done', 'skipped', 'running', 'error', '']);
  const probe = json('src/smart/steps/probe.json');
  assert.deepEqual(probe.probes.map((one) => one.id), [
    'p1-enter-moves', 'p2-space-moves', 'p3-disabled-and-current', 'p4-action-is-silent', 'p5-passive-list',
    'p6-list-property', 'p7-public-variables', 'p8-auto-layout', 'p9-all-done', 'p10-marker-is-the-text-line', 'p11-old-forms',
  ]);
});
