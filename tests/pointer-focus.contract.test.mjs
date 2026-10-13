import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// A text control decides for itself where its focus ring goes: on the field the
// person sees, not on the bare input inside it. Three components also decide
// whether to show one at all after a mouse click -- their JS marks the root with
// a --pointer-focus modifier, and the ring rules sit behind :not(that).
//
// What that pattern has to account for is one browser rule: a text control
// matches :focus-visible on a click as well as on a tab. Browsers do that
// deliberately, because the person is about to type. So the global
// :focus-visible rule in the core keeps painting after a click, and a component
// that only turns off its own rule has not removed the ring -- it has moved it.
//
// That is what the field did. Clicked with a mouse it drew a tight square ring
// around the bare input, inside the rounded field, while the field's own ring
// stayed off. Measured in Chrome on the published pair: control
// `solid 2px offset 1px`, wrapper none.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const CONTROLS = [
  { name: 'input', style: 'src/component/inputs/scss/_css__inputs.scss', control: 'input' },
  { name: 'textarea', style: 'src/component/textarea/scss/_css__textarea.scss', control: 'textarea' },
  { name: 'quantity', style: 'src/component/quantity/scss/_css__quantity.scss', control: 'input' },
];

test('a component that hides its ring on a click hides the browser ring too', () => {
  const offenders = [];
  for (const { name, style, control } of CONTROLS) {
    const css = read(style);
    if (!css.includes('--pointer-focus')) continue;
    // Somewhere there has to be a rule that takes the outline off the bare
    // control, and it must not itself be gated on the absence of the modifier --
    // that is exactly the case it has to cover.
    const silencers = [...css.matchAll(new RegExp(`([^{}]*\\b${control}:[^{}]*focus-visible[^{}]*)\\{([^}]*)\\}`, 'gu'))]
      .filter(([, , body]) => /outline:\s*none/u.test(body))
      .map(([, selector]) => selector.trim());
    if (silencers.length === 0) {
      offenders.push(`${name}: the bare ${control} is never told to drop its ring`);
      continue;
    }
    const covered = silencers.some((selector) => !/:not\(\.[a-z-]*--pointer-focus\)/u.test(selector));
    if (!covered) {
      offenders.push(`${name}: every silencer is gated on :not(--pointer-focus), which is the case it must cover`);
    }
  }
  assert.deepEqual(offenders, [],
    'gating the silencer on the pointer case moves the ring onto the bare control');
});
