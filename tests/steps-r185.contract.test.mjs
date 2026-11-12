// sf-steps 1.3.0 (R185 steps study, ui-control control/research/2026-11-12-steps.md):
// the items the study names independent of the open look questions.
//   ST-1  a label breaks between words only; a step that does not fit goes to
//         the next line whole.
//   ST-10 the size 1/2 icon is the size's text line (given through the icon's
//         own variables, which the unlayered icon sheet reads); the size 1/2
//         gap is no looser than size 1.
//   ST-13 the steps are an ordered list with aria-current=step.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const rule = (css, selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.notEqual(at, -1, `rule ${selector}`);
  return css.slice(at, css.indexOf('}', at));
};

test('ST-1: labels never break inside a word, steps never shrink below their label', () => {
  const step = read('src/component/step/scss/_css__step.scss');
  const steps = read('src/component/step/scss/_css__steps.scss');
  assert.doesNotMatch(step, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(step, /word-break:\s*break-(all|word)/);
  const label = rule(step, '.sf-step .sf-step-container');
  assert.match(label, /overflow-wrap: normal;/);
  assert.doesNotMatch(label, /min-inline-size: 0/);
  assert.match(rule(steps, '.sf-steps .sf-steps-container'), /flex-wrap: wrap;/);
  const item = rule(steps, '.sf-steps .sf-steps-container > li');
  assert.match(item, /min-inline-size: min-content;/);
  assert.match(item, /gap: inherit;/);
});

test('ST-10: the step icon is sized through the icon variables; the 1/2 rung is no looser than 1', () => {
  const step = read('src/component/step/scss/_css__step.scss');
  const icon = rule(step, '.sf-step .sf-icon');
  for (const name of ['font-size', 'height', 'width']) {
    assert.match(icon, new RegExp(`--sf-icon--${name}: var\\(--sf-step--icon-size, var\\(--sf-text-height-1\\)\\);`));
    assert.doesNotMatch(icon, new RegExp(`^\\s*${name}:`, 'm'));
  }
  assert.match(rule(step, '.sf-step.sf-step--size-1\\/2 .sf-icon'), /--sf-step--icon-size: var\(--sf-text-height-1\\\/2\);/);
  const steps = read('src/component/step/scss/_css__steps.scss');
  assert.match(rule(steps, '.sf-steps.sf-steps--size-1 .sf-steps-container'), /--sf-steps-container--gap: var\(--sf-space-1\\\/4\);/);
  assert.match(rule(steps, '.sf-steps.sf-steps--size-1\\/2 .sf-steps-container'), /--sf-steps-container--gap: var\(--sf-space-1\\\/4\);/);
  assert.doesNotMatch(steps, /\.sf-steps-container > \.sf-icon/);
});

test('ST-13: an ordered list, one item per step, no group role', () => {
  const component = JSON.parse(read('src/smart/steps/component.json'));
  assert.equal(component.version, '1.3.0');
  assert.equal(component.accessibility.role, 'list');
  const manifest = JSON.parse(read('src/smart/steps/smart.manifest.json'));
  assert.equal(manifest.accessibility.role, 'list');
  const passport = JSON.parse(read('src/component/step/passport.json'));
  assert.equal(passport.version, '1.2.1');
});

test('ST-13: the committed first-paint snapshots print the list', () => {
  for (const folder of ['steps', 'wizard']) {
    const dir = `src/smart/${folder}/static/default`;
    for (const file of readdirSync(new URL(`../${dir}`, import.meta.url))) {
      if (!file.endsWith('.html')) continue;
      const html = read(`${dir}/${file}`);
      if (!html.includes('sf-steps-container')) continue;
      assert.doesNotMatch(html, /role="group" class="sf-steps /, `${dir}/${file}`);
      assert.match(html, /<ol class="sf-steps-container flex items-center" role="list"/, `${dir}/${file}`);
      const list = html.slice(html.indexOf('<ol class="sf-steps-container'), html.indexOf('</ol>'));
      const buttons = (list.match(/<button /g) || []).length;
      assert.ok(buttons > 0, `${dir}/${file}`);
      assert.equal((list.match(/<li class="flex items-center">/g) || []).length, buttons, `${dir}/${file}`);
    }
  }
});
