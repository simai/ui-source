import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('ordinary Step documents the list semantics and keeps runtime static', async () => {
  const [docs, runtime] = await Promise.all([
    read('component/step/docs/docs.md'),
    read('component/step/js/_step.js'),
  ]);

  assert.match(docs, /role="list"/);
  assert.match(docs, /li\.sf-step/);
  assert.match(docs, /aria-current="step"/);
  assert.match(docs, /button\.sf-step-body\.sf-step-control/);
  assert.match(runtime, /component is static/);
});

test('Smart Steps are passive by default; navigation makes the reachable steps native buttons', async () => {
  const [component, template] = await Promise.all([
    read('smart/steps/index.js'),
    read('smart/steps/js/templates/default.js'),
  ]);

  assert.match(template, /item\.reachable\s*\? html`<button type="button" class="sf-step-body sf-step-control">/);
  assert.match(template, /: html`<span class="sf-step-body">/);
  assert.match(template, /aria-current=\$\{item\.current \? 'step' : nothing\}/);
  assert.doesNotMatch(template, /tabindex=/);
  assert.doesNotMatch(template, /aria-disabled=/);
  assert.doesNotMatch(template, /role="group"/);
  assert.doesNotMatch(component, /addEventListener\('keydown'/);
  assert.match(component, /from '\.\/js\/items'/);
  assert.match(component, /if \(!item \|\| !item\.reachable\) return;/);
});

test('Smart Steps exposes an ordered list and localized state names', async () => {
  const [component, template] = await Promise.all([
    read('smart/steps/index.js'),
    read('smart/steps/js/templates/default.js'),
  ]);

  assert.match(component, /ariaLabel: \{ attribute: 'aria-label', default: '' \}/);
  for (const name of ['completedLabel', 'currentLabel', 'aheadLabel', 'errorLabel', 'skippedLabel', 'runningLabel', 'countLabel']) {
    assert.match(component, new RegExp(`${name}: \\{ default: '' \\}`), name);
  }
  assert.match(template, /<ol\s+class="sf-steps-container"\s+role="list"\s+aria-label=\$\{context\.ariaLabel \|\| nothing\}/);
  assert.match(template, /context\.items\.map\(\(item\) => renderStep\(item, context\)\)/);
});

test('Step presentation uses tokens only, the Framework spinner for running and a focus ring on buttons only', async () => {
  const [stepCss, stepsCss] = await Promise.all([
    read('component/step/scss/_css__step.scss'),
    read('component/step/scss/_css__steps.scss'),
  ]);

  for (const css of [stepCss, stepsCss]) {
    assert.doesNotMatch(css, /\b\d+px\b/);
    assert.doesNotMatch(css, /\d(?:rem|em)\b/);
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgb\(/i);
    assert.match(css, /var\(--sf-px\)/);
  }
  assert.doesNotMatch(stepCss, /@keyframes/);
  assert.match(stepCss, /\.sf-step \.sf-step-control:not\(:disabled\)[^{]*:focus-visible/);
  assert.match(stepCss, /\.sf-step \.sf-step-control:hover \.sf-step-container/);
  assert.doesNotMatch(stepsCss, /\.sf-steps-separator/);
});

test('Step source contract keeps concise internal data hook', async () => {
  const template = await read('smart/steps/js/templates/default.js');
  const dataAttributes = [...template.matchAll(/data-[a-z0-9-]+/g)].map(match => match[0]);

  assert.deepEqual([...new Set(dataAttributes)], ['data-step-index']);
});
