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
  assert.equal(manifest.version, '1.2.5');
  assert.deepEqual(manifest.settings.place.values, ['inline', 'modal', 'pages']);
  assert.deepEqual(manifest.settings.navigation.values, ['linear', 'free', 'visited']);
  assert.deepEqual(manifest.settings.progress.values, ['auto', 'row', 'count', 'column']);
  assert.equal(manifest.settings['action-name'].default, 'wizard-action');
  assert.deepEqual(Object.keys(manifest.values), ['current', 'open', 'value']);
  assert.deepEqual(Object.keys(manifest.events), ['change', 'submit', 'invalid', 'navigate', 'open', 'close', 'completed']);
  for (const verb of ['submit', 'navigate', 'open', 'close']) assert.equal(manifest.events[verb].cancelable, true, verb);
  assert.equal(manifest.events.invalid['own-verb'], true);
  assert.deepEqual(Object.keys(manifest.actions), ['open', 'close', 'go-to-step', 'next']);
  assert.deepEqual(manifest.relations.map((relation) => relation.name),
    ['cl-wizard-step', 'cl-steps', 'cl-button', 'cl-progress-bar', 'cl-alert', 'cl-spinner', 'cl-confirm', 'cl-modal', 'cl-icon', 'scrollbar']);
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

test('the window asks before it drops input; remembering is only for inline and modal', () => {
  assert.match(source, /sf-pref:sf-wizard\//u);
  assert.match(template, /<sf-confirm class="sf-wizard-confirm"/u);
  const ru = json('src/smart/wizard/lang/ru.json');
  const en = json('src/smart/wizard/lang/en.json');
  assert.deepEqual(Object.keys(en.runtime).sort(), Object.keys(ru.runtime).sort());
  assert.equal(ru.runtime.position, 'Шаг {n} из {count}');
  assert.equal(ru.runtime['close-question'], 'Закрыть мастер? Введённое на этом шаге не сохранится.');
  assert.equal(ru.runtime.required, 'Заполните это поле.');
});

test('accessibility: a named region, aria-current, a focusable title, a status line', () => {
  assert.match(template, /role="region" aria-label=\$\{name \|\| nothing\}/u);
  assert.match(template, /aria-current=\$\{step\.current \? 'step' : nothing\}/u);
  assert.match(template, /class="sf-wizard-title" id=\$\{`\$\{id\}-title`\} role="heading" aria-level=\$\{String\(level\)\} tabindex="-1"/u);
  assert.match(template, /class="sf-wizard-announce sr-only" role="status"/u);
  assert.match(template, /aria-busy=\$\{busy \? 'true' : nothing\}/u);
});

test('the sheet: one rung, the container widths, 44px under a coarse pointer, theme roles only', () => {
  assert.match(sheet, /@container sf-wizard \(min-width: 40rem\)/u);
  assert.match(sheet, /@container sf-wizard \(max-width: 39\.99rem\)/u);
  assert.match(sheet, /@media \(pointer: coarse\) \{\n\s+@layer sf\.states \{/u);
  assert.match(sheet, /min-block-size: var\(--sf-d1\);/u);
  for (const name of ['gap', 'padding', 'background', 'border-color', 'radius', 'max-width']) {
    assert.ok(sheet.includes(`var(--sf-wizard-${name},`), name);
  }
  assert.doesNotMatch(sheet, /#[0-9a-f]{3,8}\b|rgb\(/iu);
});

test('sf-steps 1.2.0: an item\'s own state, skipped and running', () => {
  const steps = json('src/smart/steps/component.json');
  assert.equal(steps.version, '1.2.2');
  assert.deepEqual(steps.settings.items.of.state.values, ['default', 'completed', 'skipped', 'running', 'error']);
  const stepsTemplate = read('src/smart/steps/js/templates/default.js');
  assert.match(stepsTemplate, /skipped: 'do_not_disturb_on', running: 'progress_activity'/u);
  const stepSheet = read('src/component/step/scss/_css__step.scss');
  assert.match(stepSheet, /@keyframes sf-step-running/u);
});

test('the conformance probe covers the frame, validation, moves, the post and go-to-step', () => {
  const probe = json('src/smart/wizard/probe.json');
  assert.deepEqual(probe.probes.map((one) => one.id), ['p1-frame', 'p2-invalid', 'p3-next', 'p4-back', 'p5-pages-submit', 'p6-go-to-step']);
});
