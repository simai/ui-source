import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const css = await readFile(new URL('../src/component/country-code/scss/_css_country_code.scss', import.meta.url), 'utf8');
const custom = await readFile(new URL('../src/component/country-code/scss/_css_country_code_custom.scss', import.meta.url), 'utf8');

test('Country Code auxiliary text uses readable semantic roles, not disabled-like muted ink', () => {
  for (const part of ['text','hint','placeholder']) assert.ok(css.includes(`--sf-country-code-${part}--color: var(--sf-on-surface-variant);`));
  assert.ok(css.includes('--sf-country-code-field--border-color: var(--sf-outline);'));
});

test('Country Code input and placeholder use the same size and line-height tokens in all sizes', () => {
  for (const size of ['1/2','1','2']) {
    const escaped=size.replace('/', '\\/');
    const start=css.indexOf(`\n.sf-country-code.sf-country-code--size-${escaped} input {`);
    assert.ok(start>=0);
    const rule=css.slice(start,css.indexOf('}',start));
    for (const [part,token] of [['font-size','size'],['line-height','height']]) assert.ok(rule.includes(`--sf-country-code-input--${part}: var(--sf-text-${token}-${escaped});`));
  }
});

test('Country Code focus shadow is never a surface color and forced colors has a native outline', () => {
  assert.doesNotMatch(css,/--background-color:\s*var\(--sf-ui-focus\)/);
  assert.doesNotMatch(css,/:focus(?![\w-])/);
  assert.match(css,/:focus-visible/);
  assert.match(custom,/@media\s*\(forced-colors:\s*active\)/);
  assert.match(custom,/outline:\s*var\(--sf-focus-outline-width\) solid currentColor/);
});
