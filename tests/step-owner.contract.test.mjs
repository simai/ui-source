import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('ordinary Step documents static list semantics and keeps runtime static', async () => {
  const [docs, runtime] = await Promise.all([
    read('component/step/docs/docs.md'),
    read('component/step/js/_step.js'),
  ]);

  assert.match(docs, /role="list"/);
  assert.match(docs, /role="listitem"/);
  assert.match(docs, /aria-current="step"/);
  assert.match(docs, /button\.sf-step/);
  assert.match(runtime, /component is static/);
});

test('Smart Steps uses native buttons and native keyboard behavior', async () => {
  const [component, template] = await Promise.all([
    read('smart/steps/index.js'),
    read('smart/steps/js/templates/default.js'),
  ]);

  assert.match(template, /<button[\s\S]*type="button"/);
  assert.match(template, /\?disabled=\$\{item\.disabled\}/);
  assert.match(template, /aria-current=\$\{item\.selected \? 'step' : nothing\}/);
  assert.doesNotMatch(template, /role=\$\{item\.disabled/);
  assert.doesNotMatch(template, /tabindex=/);
  assert.doesNotMatch(template, /aria-disabled=/);
  assert.doesNotMatch(template, /['"]transition['"]/);
  assert.doesNotMatch(component, /addEventListener\('keydown'/);
  assert.doesNotMatch(component, /handleRootKeyDown/);
});

test('Smart Steps exposes group and localized state names', async () => {
  const [component, template] = await Promise.all([
    read('smart/steps/index.js'),
    read('smart/steps/js/templates/default.js'),
  ]);

  assert.match(component, /ariaLabel: \{ attribute: 'aria-label', default: '' \}/);
  assert.match(component, /completedLabel: \{ default: '' \}/);
  assert.match(component, /errorLabel: \{ default: '' \}/);
  assert.match(template, /role="group"/);
  assert.match(template, /aria-label=\$\{context\.ariaLabel \|\| nothing\}/);
  assert.match(template, /\$\{item\.label\}, \$\{statusLabel\}/);
});

test('Step presentation uses semantic tokens, bounded motion and interactive-only hover', async () => {
  const [stepCss, stepsCss] = await Promise.all([
    read('component/step/scss/_css__step.scss'),
    read('component/step/scss/_css__steps.scss'),
  ]);

  assert.doesNotMatch(stepCss, /\b1px\b/);
  assert.doesNotMatch(stepCss, /\b(?:rem|em)\b/);
  assert.match(stepCss, /var\(--sf-px\)/);
  assert.match(stepCss, /transition-property: background-color, border-color, box-shadow, color/);
  assert.match(stepCss, /transition-duration: var\(--sf-duration-fast\)/);
  assert.match(stepCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(stepCss, /\.sf-step:is\(button, a, \[role="button"\]\)/);
  assert.match(stepsCss, /:dir\(rtl\) \.sf-steps-separator--directional/);
});

test('Step source contract keeps concise internal data hook', async () => {
  const template = await read('smart/steps/js/templates/default.js');
  const dataAttributes = [...template.matchAll(/data-[a-z0-9-]+/g)].map(match => match[0]);

  assert.deepEqual([...new Set(dataAttributes)], ['data-step-index']);
});
