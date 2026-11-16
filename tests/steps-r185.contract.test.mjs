// sf-steps, R185 steps study (ui-control control/research/2026-11-12-steps.md):
// the items done before the owner's answer (sf-steps 1.3.0) as they stand in
// the C101 drawing (sf-steps 1.4.0; tests/steps-c101.contract.test.mjs holds
// the decision's items).
//   ST-1  a label breaks between words only.
//   ST-10 the marker and its icon are the rung's text line (the icon through
//         the icon's own variables, which the unlayered icon sheet reads).
//   ST-13 the steps are an ordered list with aria-current=step.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('ST-1: labels never break inside a word', () => {
  const step = read('src/component/step/scss/_css__step.scss');
  const steps = read('src/component/step/scss/_css__steps.scss');
  for (const css of [step, steps]) {
    assert.doesNotMatch(css, /overflow-wrap:\s*anywhere/);
    assert.doesNotMatch(css, /word-break:\s*break-(all|word)/);
  }
});

test('ST-10: the marker icon is sized through the icon variables', () => {
  const step = read('src/component/step/scss/_css__step.scss');
  const at = step.indexOf('.sf-step .sf-step-marker .sf-icon {');
  const icon = step.slice(at, step.indexOf('}', at));
  for (const name of ['font-size', 'height', 'width']) {
    assert.match(icon, new RegExp(`--sf-icon--${name}: var\\(--sf-step--icon\\);`));
    assert.doesNotMatch(icon, new RegExp(`^\\s*${name}:`, 'm'));
  }
});

test('ST-13: the committed first-paint snapshots print the ordered list', () => {
  for (const folder of ['steps', 'wizard']) {
    const dir = `src/smart/${folder}/static/default`;
    for (const file of readdirSync(new URL(`../${dir}`, import.meta.url))) {
      if (!file.endsWith('.html')) continue;
      const html = read(`${dir}/${file}`);
      if (!html.includes('sf-steps-container')) continue;
      assert.doesNotMatch(html, /role="group" class="sf-steps /, `${dir}/${file}`);
      assert.doesNotMatch(html, /sf-steps-separator/, `${dir}/${file}`);
      assert.match(html, /<ol class="sf-steps-container" role="list"/, `${dir}/${file}`);
      const list = html.slice(html.indexOf('<ol class="sf-steps-container'), html.indexOf('</ol>'));
      assert.ok((list.match(/<li class="sf-step /g) || []).length > 0, `${dir}/${file}`);
    }
  }
});

// Docs batch B, FW-B-8: the template writes sf-steps--size-<size> and
// sf-step--size-<size> for every size the element takes; a class no sheet
// names is unknown to a class check (ui-doc audit-example-classes reads the
// built sheets). Every size of the manifest is named by the step sheets.
test('FW-B-8: every size class the template writes is named by the sheets', () => {
  const step = read('src/component/step/scss/_css__step.scss');
  const steps = read('src/component/step/scss/_css__steps.scss');
  const sizes = JSON.parse(read('src/smart/steps/component.json')).settings.size.values;
  const template = read('src/smart/steps/js/templates/default.js');
  assert.match(template, /`sf-steps--size-\$\{context\.size\}`/);
  assert.match(template, /`sf-step--size-\$\{context\.size\}`/);
  assert.ok(sizes.length > 0);
  for (const size of sizes) {
    const escaped = size.replace('/', '\\/');
    assert.ok(step.includes(`.sf-step.sf-step--size-${escaped} {`), `sf-step--size-${size}`);
    assert.ok(steps.includes(`.sf-steps.sf-steps--size-${escaped} `), `sf-steps--size-${size}`);
  }
});
