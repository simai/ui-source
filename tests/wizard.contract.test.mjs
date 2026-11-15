import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// sf-wizard and sf-wizard-step 1.0.0 (owner decision 2026-11-06, ui-control
// control/decisions/2026-11-06-sf-wizard.md), with sf-steps 1.2.0 (an item's
// own state, skipped and running) and sf-button 1.5.0 (form, name, value):
// what the source promises, held without a browser. The behaviour is probed
// on the built bytes by tests/browser/wizard.browser.mjs and
// src/smart/wizard/probe.json (tests/browser/manifest-probes.browser.mjs).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const manifest = json('src/smart/wizard/component.json');
const step = json('src/smart/wizard-step/component.json');
const source = read('src/smart/wizard/index.js');
const template = read('src/smart/wizard/js/templates/default.js');
const sheet = read('src/smart/wizard/scss/_smart__wizard.scss');
const code = source.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');

test('the manifest: places, navigation, progress, one value, seven events, four actions', () => {
  assert.equal(manifest.tag, 'sf-wizard');
  assert.equal(manifest.family, 'wizard');
  assert.equal(manifest.version, '1.4.2'); // group build 7: the integrated number (the branch wrote 1.3.4)
  assert.deepEqual(manifest.settings.place.values, ['inline', 'modal', 'drawer', 'pages']);
  assert.deepEqual(manifest.settings.navigation.values, ['linear', 'free', 'visited']);
  assert.deepEqual(manifest.settings.progress.values, ['auto', 'row', 'count', 'column']);
  assert.equal(manifest.settings['action-name'].default, 'wizard-action');
  assert.deepEqual(Object.keys(manifest.values), ['current', 'open', 'value']);
  assert.deepEqual(Object.keys(manifest.events), ['change', 'submit', 'invalid', 'navigate', 'open', 'close', 'completed']);
  for (const verb of ['submit', 'navigate', 'open', 'close']) assert.equal(manifest.events[verb].cancelable, true, verb);
  assert.equal(manifest.events.invalid['own-verb'], true);
  assert.deepEqual(Object.keys(manifest.actions), ['open', 'close', 'go-to-step', 'next']);
  assert.deepEqual(manifest.relations.map((relation) => relation.name),
    ['cl-wizard-step', 'cl-steps', 'cl-button', 'cl-progress-bar', 'cl-alert', 'cl-spinner', 'cl-modal', 'cl-drawer', 'cl-icon', 'scrollbar']);
});

test('the step: five types, an optional mark, an address and a state', () => {
  assert.equal(step.tag, 'sf-wizard-step');
  assert.equal(step.family, 'wizard');
  assert.deepEqual(step.settings.type.values, ['info', 'form', 'action', 'review', 'result']);
  for (const name of ['name', 'label', 'heading', 'description', 'optional', 'href', 'action-text', 'message']) assert.ok(step.settings[name], name);
  assert.deepEqual(step.values.state.values, ['', 'done', 'skipped', 'running', 'error']);
});

test('the names are registered in the Framework\'s family wizard', () => {
  const framework = json('contracts/registry/names.json').owners.find(({id}) => id === 'framework');
  assert.ok(framework.families.includes('wizard'));
  for (const name of ['sf-wizard', 'sf-wizard-step']) assert.ok(framework.names.some(({element}) => element === name), name);
  const rules = read('src/core/js/rule.src.js');
  assert.match(rules, /import '\.\.\/\.\.\/smart\/wizard\/rule\.js';/u);
  assert.match(rules, /import '\.\.\/\.\.\/smart\/wizard-step\/rule\.js';/u);
});

test('the primary button: one per step, its word from the step\'s type and state', () => {
  assert.match(source, /export const ROW_LIMIT = 7;/u);
  // An action runs, retries after an error and goes on after success; a
  // review applies; a result or the last step is done.
  assert.match(source, /if \(step\.state === 'error'\) return \{action: 'retry', word: 'retry'\};/u);
  assert.match(source, /if \(step\.state !== 'done'\) return \{action: 'run', word: 'run', text: step\.actionText\};/u);
  assert.match(source, /if \(step\.type === 'review' && step\.state !== 'done'\) return \{action: 'apply'/u);
  assert.match(source, /if \(step\.type === 'result' \|\| last\) return \{action: 'done'/u);
  assert.equal((template.match(/class="sf-wizard-primary"/gu) ?? []).length, 1);
  // Back, Skip and the primary are sf-button; no hand-made button in the footer.
  assert.match(template, /<sf-button class="sf-wizard-back"/u);
  assert.match(template, /<sf-button class="sf-wizard-skip"/u);
  assert.doesNotMatch(template, /<button class="sf-button/u);
});

test('place pages: the footer posts the step\'s form with the button\'s word, nothing hidden is added', () => {
  assert.match(template, /native-type=\$\{pages && form \? 'submit' : 'button'\} form=\$\{pages && form \? form\.id : nothing\}/u);
  assert.match(template, /name=\$\{pages && form \? actionName : nothing\} value=\$\{pages && form \? primary\.action : nothing\}/u);
  assert.doesNotMatch(code, /type="hidden"|type = 'hidden'|createElement\('input'\)/u);
  // The running state is set after the browser has read the form.
  assert.match(source, /markRunning\(step\) \{\n\s+setTimeout\(\(\) => step\.element\.setAttribute\('state', 'running'\)\);/u);
  // sf-button 1.5.0 passes form, name and value to its native button.
  const button = read('src/smart/button/js/templates/default.js');
  assert.match(button, /form=\$\{context\.formId \|\| nothing\}/u);
  // At least the minor that added them; later patches keep them.
  const [major, minor] = json('src/smart/button/component.json').version.split('.').map(Number);
  assert.ok(major > 1 || (major === 1 && minor >= 5), 'sf-button 1.5.0 or later');
});

test('the steps are printed once: a live container the first paint fills in place', () => {
  assert.match(template, /<div class="sf-wizard-live" data-sf-live>\$\{stepNodes\}<\/div>/u);
  const page = read('scripts/first-paint-page.js');
  assert.match(page, /el\.hasAttribute\('data-sf-live'\)/u);
  assert.match(page, /placed\.has\(node\)/u);
});

test('C179 (6): the draft is kept by the wizard, closing is continue later without a question', () => {
  assert.match(source, /sf-pref:sf-wizard\//u);
  assert.doesNotMatch(template, /sf-confirm/u);
  assert.match(source, /const key = text\(this\.remember\) \|\| text\(this\.id\);/u);
  assert.match(source, /this\.keepSoon\(\);/u);
  assert.match(template, /class="sf-wizard-saved"/u);
  const ru = json('src/smart/wizard/lang/ru.json');
  const en = json('src/smart/wizard/lang/en.json');
  assert.deepEqual(Object.keys(en.runtime).sort(), Object.keys(ru.runtime).sort());
  assert.equal(ru.runtime.position, 'Шаг {n} из {count}');
  assert.equal(ru.runtime['close-question'], undefined);
  assert.equal(ru.runtime.required, 'Заполните поле');
  assert.equal(ru.runtime.invalid, 'Проверьте значение');
  assert.equal(ru.runtime.saved, 'Черновик сохранён в {time}');
});

test('accessibility: a named region, aria-current, a focusable title, a status line', () => {
  assert.match(template, /role="region" aria-label=\$\{name \|\| nothing\}/u);
  assert.match(template, /aria-current=\$\{step\.current \? 'step' : nothing\}/u);
  assert.match(template, /class="sf-wizard-title" id=\$\{`\$\{id\}-title`\} role="heading" aria-level=\$\{String\(level\)\} tabindex="-1"/u);
  assert.match(template, /class="sf-wizard-announce sr-only" role="status"/u);
  assert.match(template, /aria-busy=\$\{busy \? 'true' : nothing\}/u);
});

test('the sheet: one rung, the container widths, 44px under a coarse pointer, theme roles only', () => {
  assert.match(sheet, /@container sf-wizard \(min-width: #\{mq\.container-step\(h0\)\}\)/u);
  assert.match(sheet, /@container sf-wizard \(width < #\{mq\.container-step\(h0\)\}\)/u);
  assert.match(sheet, /@media \(pointer: coarse\) \{\n\s+@layer sf\.states \{/u);
  assert.match(sheet, /min-block-size: var\(--sf-d1\);/u);
  for (const name of ['gap', 'padding', 'background', 'border-color', 'radius', 'max-width']) {
    assert.ok(sheet.includes(`var(--sf-wizard-${name},`), name);
  }
  assert.doesNotMatch(sheet, /#[0-9a-f]{3,8}\b|rgb\(/iu);
});

test('sf-steps 1.4.3 (C101, C105, C61 round 5): the wizard row is a row, its reachable steps buttons, the states in today\'s words', () => {
  const steps = json('src/smart/steps/component.json');
  assert.equal(steps.version, '1.4.3');
  assert.deepEqual(steps.settings.items.of.state.values, ['done', 'ahead', 'skipped', 'running', 'error', 'completed', 'default']);
  const template = read('src/smart/wizard/js/templates/default.js');
  assert.match(template, /layout="row" navigation="free"/u);
  assert.match(template, /const STAGES = \{done: 'done', skipped: 'skipped', running: 'running', error: 'error', '': 'ahead'\};/u);
  assert.doesNotMatch(template, /'completed'|'default'/u);
});

test('the conformance probe covers the frame, validation, moves, the post and go-to-step', () => {
  const probe = json('src/smart/wizard/probe.json');
  assert.deepEqual(probe.probes.map((one) => one.id), ['p1-frame', 'p2-invalid', 'p3-next', 'p4-back', 'p5-pages-submit', 'p6-go-to-step']);
});

// C105 (spacing audit W1, W2, W3): the list of steps is a row list -- mark → label
// H2, row edge → mark H4 (C77) -- and the frame is a window's H6 inset, the edge inside.
test('C105: the step list is a row list and the frame a window inset', () => {
  assert.match(sheet, /--sf-wizard--row-gap: var\(--sf-space-1\\\/2\);/);
  assert.match(sheet, /--sf-wizard--row-inset: var\(--sf-space-1\);/);
  assert.match(sheet, /--sf-wizard--row-inset: max\(var\(--sf-space-1\\\/2\), var\(--sf-b2\)\);/);
  const step = sheet.match(/\.sf-wizard-list-step \{[^}]*\}/)[0];
  assert.match(step, /gap: var\(--sf-wizard--row-gap\);/);
  assert.match(step, /padding-inline: var\(--sf-wizard--row-inset\);/);
  assert.doesNotMatch(step, /space-x/);
  assert.equal((sheet.match(/--sf-wizard--padding: var\(--sf-wizard-padding, calc\(var\(--sf-space-2\) - var\(--sf-px\)\)\);/g) || []).length, 2);
});

// C179 (1)-(4) and the study's defects WZ-1, WZ-3, WZ-4, WZ-6.
test('C179: footer gap, names, window sizes, the phone footer and the Framework words', () => {
  // (1), (7), WZ-1: one group of buttons, 8 (4 compact), Back first, the main last.
  assert.match(sheet, /--sf-wizard--actions-gap: var\((?:--sf-space-1\\\/3|--sf-gap--actions)\);/u);
  for (const rule of ['.sf-wizard-footer {', '.sf-wizard-footer-end {']) {
    const body = sheet.slice(sheet.indexOf(rule), sheet.indexOf('}', sheet.indexOf(rule)));
    assert.match(body, /gap: var\(--sf-wizard--actions-gap\);/u, rule);
  }
  // (2), WZ-4: the name h4, the step's title h5 medium.
  assert.match(sheet, /--sf-wizard--name-size: var\(--sf-heading-4--size\);/u);
  assert.match(sheet, /--sf-wizard--title-size: var\(--sf-heading-5--size\);/u);
  // (3), WZ-3: a window by name with its header (no show-header="false", no own width), a drawer 30rem.
  assert.match(template, /<sf-modal class="sf-wizard-modal" heading=\$\{name\} size=\$\{size\}>/u);
  assert.match(template, /context\.phone \? 'full' : context\.shape === 'column' \? 'wide' : 'form'/u);
  assert.match(template, /<sf-drawer class="sf-wizard-drawer" heading=\$\{name\} size="2" placement="inline-end">/u);
  assert.doesNotMatch(template, /show-header="false"|width="min\(48rem/u);
  // (4): the footer sticks to the window's bottom on a phone -- by the
  // wizard's own width below the container step g5, not the screen's
  // (C181 (2), 1.3.3; the browser test wizard-container-c181 measures it).
  const narrow = sheet.indexOf('@container sf-wizard (width < #{mq.container-step(g5)}) {');
  assert.ok(narrow > 0, 'the window footer rule is a container condition at g5');
  assert.match(sheet.slice(narrow + 1), /^[^@]*\.sf-wizard--window \.sf-wizard-footer \{\n\s+position: sticky;/u);
  assert.doesNotMatch(sheet, /@media[^{]*(?:breakpoint-array|min-width|max-width|width <)/u, 'no screen-width query in the sheet');
  // (5), WZ-6: no browser words.
  assert.doesNotMatch(code, /: control\.validationMessage;/u);
  assert.match(source, /typeof field\?\.sfShownMessage === 'function'/u);
});

test('progress auto: the row while it fits the wizard\'s own width, else the count (C101 (4), 1.3.4)', () => {
  // The wizard measures the row at its one-line width (data-sf-measure on the
  // frame and on sf-steps' root) against the room the head gives it, and marks
  // the frame; the sheet draws the count line on the mark. Measured after each
  // drawing, after sf-steps' own, and on a change of the frame's width.
  assert.match(code, /fitProgress\(\) \{/u);
  assert.match(code, /root\.setAttribute\('data-sf-measure', ''\);/u);
  assert.match(code, /const fit = need > room \+ FIT_SLACK \? 'count' : 'row';/u);
  assert.match(code, /frame\.setAttribute\('data-sf-progress-fit', fit\)/u);
  // Only the count is marked, so a printed first paint carries nothing measured.
  assert.match(code, /frame\.removeAttribute\('data-sf-progress-fit'\);\n    \}/u);
  assert.match(code, /new ResizeObserver\(/u);
  assert.match(code, /addEventListener\('sf-after-render', this\._onStepsDrawn\)/u);
  // Only auto measures: an explicit row stays a row.
  assert.match(code, /if \(!auto \|\| !frame\.classList\.contains\('sf-wizard--progress-row'\)\)/u);
  assert.match(sheet, /\.sf-wizard\[data-sf-progress-fit="count"\]:not\(\[data-sf-measure\]\) \.sf-wizard-steps > \.sf-steps \{\s*display: none;/u);
  assert.match(sheet, /\.sf-wizard\[data-sf-progress-fit="count"\] \.sf-wizard-compact \{\s*display: flex;/u);
  assert.match(sheet, /\.sf-wizard\[data-sf-measure\] \.sf-wizard-steps > \.sf-steps \{\s*display: block;/u);
});
