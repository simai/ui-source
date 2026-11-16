import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {buttonSetLook, dangerLook, sayButtonSetFormers} from '../src/smart/helpers/button-set.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

function captureWarnings(run) {
  const said = [];
  const original = console.warn;
  console.warn = (message) => said.push(String(message));
  try {
    run();
  } finally {
    console.warn = original;
  }
  return said;
}

function freshPage() {
  delete globalThis.SF?.__sfButtonSetWarned;
  delete globalThis.SF?.__deprecationNotes;
}

/* Owner decision C116 (the button set; ui-control research
   2026-11-13-buttons-system): secondary and surface leave sf-button, and a
   danger control is filled, outline or a fill-less icon. The words stay
   former names until 2027-01-01 and draw as their successors. */
test('button set: secondary draws as on-surface, surface as tonal on-surface', () => {
  assert.deepEqual(
    (({appearance, scheme}) => ({appearance, scheme}))(buttonSetLook({appearance: 'outline', scheme: 'secondary'})),
    {appearance: 'outline', scheme: 'on-surface'},
  );
  assert.deepEqual(
    (({appearance, scheme}) => ({appearance, scheme}))(buttonSetLook({appearance: 'surface', scheme: 'primary'})),
    {appearance: 'tonal', scheme: 'on-surface'},
  );
  // surface with the quiet scheme (retired in 1.11.0) is the same soft grey button.
  assert.equal(buttonSetLook({appearance: 'surface', scheme: 'on-surface-variant'}).scheme, 'on-surface');
  const both = buttonSetLook({appearance: 'surface', scheme: 'secondary'});
  assert.deepEqual(both.formers.map((one) => one.from), ['surface', 'secondary']);
});

test('button set: a danger tonal or surface draws as outline; filled, outline and ghost stay', () => {
  for (const status of ['danger', 'error', 'critical']) {
    for (const appearance of ['tonal', 'surface']) {
      const look = buttonSetLook({appearance, scheme: 'primary', status});
      assert.equal(look.appearance, 'outline', `${appearance} ${status}`);
      assert.equal(look.scheme, 'primary', 'the status paints it; the scheme is left alone');
      assert.deepEqual(look.formers.map((one) => [one.from, one.to]), [[appearance, 'outline']]);
    }
  }
  for (const appearance of ['default', 'outline', 'ghost', undefined, null]) {
    assert.deepEqual(buttonSetLook({appearance, status: 'danger'}).formers, []);
    assert.equal(dangerLook(appearance, 'danger').former, '');
  }
  assert.equal(dangerLook('tonal', '').former, '', 'a tonal button without a status is a current look');
});

test('button set: current words meet no former name', () => {
  for (const appearance of ['default', 'tonal', 'outline', 'ghost', null]) {
    for (const scheme of ['primary', 'on-surface', 'on-surface-variant', null]) {
      assert.deepEqual(buttonSetLook({appearance, scheme}).formers, [], `${appearance} ${scheme}`);
    }
  }
});

test('button set: each former word is noted until 2027-01-01 and said once per page', () => {
  freshPage();
  const said = captureWarnings(() => {
    for (let round = 0; round < 3; round += 1) {
      sayButtonSetFormers('sf-button', buttonSetLook({appearance: 'surface', scheme: 'secondary'}).formers);
      sayButtonSetFormers('sf-button', buttonSetLook({appearance: 'tonal', status: 'danger'}).formers);
    }
  });
  assert.equal(said.length, 3, said.join('\n'));
  assert.ok(said.every((line) => line.startsWith('[SIMAI Framework] sf-button: ') && line.includes('until 2027-01-01') && line.includes('rule C116')));
  assert.ok(said.some((line) => line.includes('appearance="tonal" with status="danger"') && line.includes('appearance="outline" status="danger"')));
  const notes = [...globalThis.SF.__deprecationNotes.values()].filter((note) => note.component === 'sf-button');
  for (const from of ['surface', 'secondary', 'tonal (status danger)']) {
    assert.ok(notes.some((note) => note.from === from && note.remove_after === '2027-01-01' && note.since === '2026-11-13'), from);
  }
  assert.equal(Object.keys(globalThis.SF).includes('__sfButtonSetWarned'), false, 'not enumerable');
});

test('button set: sf-button and sf-button-icon read it; their lists no longer name the former words', () => {
  const button = read('src/smart/button/index.js');
  assert.match(button, /sayButtonSetFormers\("sf-button", setLook\(this\)\.formers\)/u);
  assert.match(button, /get appearance\(\) \{\s*const look = setLook\(this\);/u);
  assert.doesNotMatch(button, /retiredSurfaceQuiet/u);
  const icon = read('src/smart/button-icon/index.js');
  assert.match(icon, /if \(this\.dangerFormer\) return 'outline';/u);
  assert.match(icon, /sayButtonSetFormers\('sf-button-icon', \[/u);
  const settings = json('src/smart/button/component.json').settings;
  assert.deepEqual(settings.appearance.values, ['default', 'tonal', 'outline', 'ghost']);
  assert.deepEqual(settings.scheme.values, ['primary', 'on-surface', 'on-surface-variant']);
  assert.deepEqual(settings.status.values, ['', 'danger']);
  assert.deepEqual(json('src/smart/button-icon/component.json').settings.status.values, ['', 'danger']);
  const journal = json('contracts/changes/journal.json').records.find((record) => record.id === 'value-button-set-c116');
  assert.ok(journal, 'the change journal records the set');
  assert.equal(journal.remove_after, '2027-01-01');
});

test('button set: the slider arrows are no longer secondary (BS-2)', () => {
  const slider = read('src/smart/slider/js/templates/default.js');
  assert.match(slider, /secondary: \{ type: 'tonal', scheme: 'on-surface' \}/u);
  assert.doesNotMatch(slider, /scheme: 'secondary'/u);
});

/* «Отмена» is quiet everywhere (C116 #q-cancel): no Framework template draws a
   cancel as an outlined or tonal button. */
test('button set: «Отмена» is ghost in the Framework templates', () => {
  const picker = read('src/smart/profile-picker/js/templates/default.js');
  const cancels = [...picker.matchAll(/<sf-button[^>]*text=\$\{text\('cancel'\)\}[^>]*>/gu)].map((match) => match[0]);
  assert.equal(cancels.length, 2);
  assert.ok(cancels.every((tag) => tag.includes('appearance="ghost"') && tag.includes('scheme="on-surface"')), cancels.join('\n'));
  const footer = read('src/smart/helpers/confirm-surface.js');
  assert.match(footer, /declineAppearance = "ghost"/u);
});

/* A changed aria-label reaches the inner control (sf-button 1.14.0): it is the
   host's, not a setting, so the manifest made no observed attribute of it and
   the forwarder leaves it out (sf-input-image's replace button kept the first
   file's name). tests/browser/button-name-update.browser.mjs checks it drawn. */
test('sf-button observes aria-label and draws the inner control with it', () => {
  const button = read('src/smart/button/index.js');
  assert.match(button, /static get observedAttributes\(\) \{\s*return \[\.\.\.new Set\(\[\.\.\.super\.observedAttributes, "aria-label"\]\)\];/u);
  assert.match(button, /resolveUpdateMode\(\) \{\s*return "lit";/u, 'a change draws the template again');
  const template = read('src/smart/button/js/templates/default.js');
  assert.equal([...template.matchAll(/aria-label=\$\{ariaLabel \|\| nothing\}/gu)].length, 2, 'the button and the link both take the name');
});
