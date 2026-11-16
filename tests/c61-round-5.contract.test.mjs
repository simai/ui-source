// C61 round 5 (DEV answer msg-bf5253ac, 2026-11-14): (1) icon to text is a
// role (C105 H2), not a screen step: a step marker's ink stands 8 before its
// text at every width; (2) a step's status has words of its own, not the
// event's «Готово»; (3) one word for the upcoming state in sf-steps and
// sf-list-timeline: «Впереди» / «Upcoming». The browser half is
// tests/browser/c61-round-5.browser.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('(1) a steps list of sf-list-timeline: the column is the ring reach plus 8, at every width', () => {
  const sheet = read('src/smart/list-timeline/scss/_smart__list-timeline.scss');
  assert.match(sheet, /--sf-list-timeline--ring-gap: calc\(var\(--sf-px\) \* 2\);/u);
  assert.match(sheet, /--sf-list-timeline--ring-reach: calc\(var\(--sf-px\) \* 4\);/u);
  assert.match(sheet, /\.sf-list-timeline:has\(> \.sf-list-timeline-list--steps, > \.sf-list-timeline-group > \.sf-list-timeline-list--steps\) \{\s*--sf-list-timeline--column-gap: calc\(var\(--sf-a8\) \+ var\(--sf-list-timeline--ring-reach\)\);\s*\}/u);
  // The rings read the same reach, so the column follows the ring.
  assert.equal(sheet.match(/0 0 0 var\(--sf-list-timeline--ring-reach\)/gu).length, 2);
  assert.doesNotMatch(sheet, /0 0 0 calc\(var\(--sf-px\) \* 4\)/u);
  // A list of events keeps role H2 by the screen step.
  assert.match(sheet, /--sf-list-timeline--column-gap: var\(--sf-space-1\\\/2\);/u);
});

test('(1) sf-steps: the marker to label step is the ring reach plus 8, in the row and the column', () => {
  const sheet = read('src/component/step/scss/_css__step.scss');
  assert.match(sheet, /\.sf-step \.sf-step-body \{[^}]*gap: calc\(var\(--sf-a8\) \+ var\(--sf-step--ring\) \* 2\);/u);
  assert.match(sheet, /outline-offset: var\(--sf-step--ring\);/u);
});

test('(2) a step of sf-list-timeline says its status in step words, never the event word', () => {
  const ru = json('src/smart/list-timeline/lang/ru.json').runtime;
  const en = json('src/smart/list-timeline/lang/en.json').runtime;
  assert.deepEqual(
    ['success', 'warning', 'error'].map((tone) => ru[`step-status-${tone}`]),
    ['успешно', 'с предупреждением', 'с ошибкой'],
  );
  assert.deepEqual(
    ['success', 'warning', 'error'].map((tone) => en[`step-status-${tone}`]),
    ['successful', 'with a warning', 'with an error'],
  );
  // The event words stay for events.
  assert.equal(ru['status-success'], 'Готово');
  assert.equal(en['status-success'], 'Done');
  const code = read('src/smart/list-timeline/index.js');
  assert.match(code, /this\.sfWord\(`step-status-\$\{item\.status\}`\)/u);
  assert.doesNotMatch(code, /item\.state\s*\?[^:]*sfWord\(`status-/u);
});

test('(3) one upcoming word: «Впереди» / «Upcoming» in sf-steps and sf-list-timeline', () => {
  for (const [path, key] of [['src/smart/steps', 'ahead-label'], ['src/smart/list-timeline', 'state-upcoming']]) {
    assert.equal(json(`${path}/lang/ru.json`).runtime[key], 'Впереди', path);
    assert.equal(json(`${path}/lang/en.json`).runtime[key], 'Upcoming', path);
  }
  assert.match(json('src/smart/steps/component.json').settings['ahead-label'].summary, /\("Upcoming" in English\)/u);
  assert.doesNotMatch(JSON.stringify(json('src/smart/steps/smart.manifest.json')), /Not started/u);
});

test('versions: sf-list-timeline 1.4.0 (C204; 1.3.2 for C61 round 5), sf-steps 1.4.3, component.step 1.3.2', () => {
  assert.equal(json('src/smart/list-timeline/component.json').version, '1.5.0');
  assert.equal(json('src/smart/list-timeline/smart.manifest.json').version, '1.5.0');
  assert.equal(json('src/smart/steps/component.json').version, '1.4.3');
  assert.equal(json('src/component/step/passport.json').version, '1.5.0'); // group build 7: the integrated number (the branch wrote 1.3.2); 1.5.0: C273
  assert.ok(json('src/smart/list-timeline/component.json')['x-decisions'].some((note) => /^version 1\.3\.2 /u.test(note)));
});
