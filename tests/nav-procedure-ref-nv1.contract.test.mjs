import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Section Navigation, area a (owner decisions C234, C235, C236, 2026-11-16;
// studies ui-control prototypes/content-procedure-study.html#q-proc-indent,
// #q-proc-line and content-reference-link-study.html#q-rl-card-meta).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const blocks = (css, selector) => {
  const out = [];
  let at = css.indexOf(`${selector} {`);
  while (at >= 0) {
    out.push(css.slice(at, css.indexOf('}', at) + 1));
    at = css.indexOf(`${selector} {`, at + 1);
  }
  return out.join('\n');
};

const procedure = strip(read('src/component/procedure/scss/_css__procedure.scss'));
const reference = strip(read('src/component/reference-link/scss/_css__reference_link.scss'));
const card = '.sf-reference-link:not([class*="sf-reference-link--size-"]):not([class*="sf-reference-link--line-"]):not(.sf-reference-link--plain):where(:not(.sf-reference-link--inline))';

test('C234: the procedure number stands 12 before its text, the sf-steps marker-to-label step', () => {
  assert.match(blocks(procedure, '  .sf-procedure-step'), /column-gap: var\(--sf-procedure-indent, calc\(var\(--sf-a8\) \+ var\(--sf-procedure--ring\) \* 2\)\);/u);
  const steps = strip(read('src/component/step/scss/_css__step.scss'));
  assert.match(steps, /gap: calc\(var\(--sf-a8\) \+ var\(--sf-step--ring\) \* 2\);/u);
  const variable = json('src/core/contracts/public-variables.v1.json').components
    .find((entry) => entry.component === 'procedure').variables
    .find((entry) => entry.name === '--sf-procedure-indent');
  assert.equal(variable.default, 'calc(var(--sf-a8) + var(--sf-procedure--ring) * 2)');
});

test('C235: the procedure line stays outline-variant, done steps included', () => {
  assert.match(procedure, /background-color: var\(--sf-procedure-line-color, var\(--sf-outline-variant\)\);/u);
  assert.doesNotMatch(procedure, /--complete[^{]*::after[^{]*\{[^}]*background-color/u);
  assert.doesNotMatch(procedure, /::after[^{]*\{[^}]*var\(--sf-primary\)/u);
});

test('C236: a card puts its route under the name at every width, one line at 1/2', () => {
  assert.match(blocks(reference, `  ${card}`), /flex-direction: column;/u);
  const meta = blocks(reference, `${card}\n    :where(.sf-reference-link__meta, .sf-reference-link-text)`);
  assert.match(meta, /font-size: var\(--sf-text-size-1\\\/2\);/u);
  assert.match(meta, /text-align: start;/u);
  assert.match(meta, /white-space: nowrap;/u);
  assert.match(meta, /text-overflow: ellipsis;/u);
  assert.match(reference, /padding-inline-start: calc\(var\(--sf-reference-link--line-height, var\(--sf-text-height-1\)\) \+ var\(--sf-reference-link--main-gap, var\(--sf-space-1\\\/2\)\)\);/u);
  // The name keeps its two lines (C147 (9)).
  assert.match(reference, /-webkit-line-clamp: 2;/u);
  // The narrow-screen stack is left to plain alone; a card stacks everywhere.
  const phone = reference.slice(reference.indexOf('@media (width < 32rem)'));
  assert.doesNotMatch(phone.slice(0, phone.indexOf('@media (forced-colors')), /\.sf-reference-link:not\(\[class\*="sf-reference-link--size-"\]\):not\(\[class\*="sf-reference-link--line-"\]\) \{/u);
});

test('versions: procedure 1.3.1, reference-link 1.3.0, sf-reference-link 1.2.3', () => {
  assert.equal(json('src/component/procedure/passport.json').version, '1.4.0'); // group build 10: 1.3.1 moved on by the merged branches or a GB10 patch
  assert.equal(json('src/component/reference-link/passport.json').version, '1.4.2'); // group build 9: 1.3.0 moved on by the merged branches or a GB9 patch // group build 10: 1.3.2 moved on by the merged branches or a GB10 patch
  assert.equal(json('src/smart/reference-link/component.json').version, '1.3.4'); // group build 9: 1.2.3 moved on by the merged branches or a GB9 patch // C282: 1.3.2 moved on by the language-file patch (Russian is a language file) // group build 13: 1.3.3 moved on by the merged branches or the C278 language patch
  assert.equal(json('src/smart/reference-link/smart.manifest.json').version, '1.3.4'); // group build 9: 1.2.3 moved on by the merged branches or a GB9 patch // C282: 1.3.2 moved on by the language-file patch (Russian is a language file) // group build 13: 1.3.3 moved on by the merged branches or the C278 language patch
});
