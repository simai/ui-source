// The notices' primary action is tonal surface, the second ghost (owner
// decision C110 as amended 2026-11-12, variant E; replaces C46), and the tonal
// plate's hover and press on a strong coloured place keep the white label at
// 4.5:1 (R190 AA-10).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const TONAL_SURFACE = 'sf-button sf-button--tonal sf-button--on-surface sf-button--size-1 sf-button--height-low';

test('sf-alert, sf-toast and the class toast write tonal on-surface for the action, never tonal primary', () => {
  for (const path of ['src/smart/alert/js/templates/default.js', 'src/smart/toast/js/templates/default.js', 'src/component/toast/js/_toast.js']) {
    const source = read(path);
    assert.ok(source.includes(TONAL_SURFACE), `${path} writes tonal on-surface`);
    assert.ok(!source.includes('sf-button--tonal sf-button--primary'), `${path} writes no tonal primary`);
  }
  assert.match(read('src/smart/alert/js/templates/default.js'), /ALERT_SECONDARY_ACTION_CLASSES = 'sf-button sf-button--ghost sf-button--link sf-button--on-surface/);
});

test('sf-alert-bar: the action is tonal, acknowledge and hide are ghost, in the row and in the list', () => {
  const template = read('src/smart/alert-bar/js/templates/default.js');
  assert.equal((template.match(/actionLink\(context, item, 'tonal'\)/g) || []).length, 2);
  assert.ok(!/actionLink\(context, item, 'outline'\)/.test(template));
  assert.ok(!/acknowledgeButton\(context, item, 'outline'\)/.test(template));
  assert.ok(/sf-alert-bar-item-close" size=\$\{size\} appearance="ghost"/.test(template));
});

test('the C46 solid plate is gone; a status notice gives its action the neutral container back', () => {
  for (const path of ['src/component/alerts/scss/_css__alerts.scss', 'src/component/toast/scss/_css__toast.scss']) {
    const sheet = read(path);
    assert.ok(!sheet.includes('sf-button--tonal.sf-button--primary'), `${path} has no tonal primary rule`);
    assert.ok(sheet.includes('.sf-button.sf-button--tonal.sf-button--on-surface {\n') && sheet.includes('@include places.sf-place-neutral-container;'), `${path} takes the neutral container back`);
  }
  const mix = read('src/core/scss/mix/_mix__places.scss');
  const neutral = mix.slice(mix.indexOf('@mixin sf-place-neutral-container'));
  assert.match(neutral, /@each \$role in \('surface-container', 'surface-container-hover', 'surface-container-active'\)/);
  assert.match(neutral, /map\.get\(\$sf-place-theme-roles, \$role\)/);
});

test('AA-10: the tonal plate on a strong place goes down 12 -> 8 -> 4 in the light theme; only the tonal on-surface button reads it', () => {
  const mix = read('src/core/scss/mix/_mix__places.scss');
  const accent = mix.slice(mix.indexOf('@mixin sf-place-strong-accent'));
  assert.ok(accent.includes('--sf-place--tonal-hover: light-dark(var(--sf-white--alfa-8), var(--sf-#{$c}-20--alfa-16));'));
  assert.ok(accent.includes('--sf-place--tonal-active: light-dark(var(--sf-white--alfa-4), var(--sf-#{$c}-20--alfa-20));'));
  // An opaque place on a strong place, and the popover's content, take it back.
  const back = mix.slice(mix.indexOf('@mixin sf-place-back-on-colour'), mix.indexOf('$sf-place-aliased'));
  assert.ok(back.includes('--sf-place--tonal-hover: initial;') && back.includes('--sf-place--tonal-active: initial;'));
  const popover = read('src/smart/popover/js/templates/default.css');
  assert.ok(popover.includes('--sf-place--tonal-hover: initial;') && popover.includes('--sf-place--tonal-active: initial;'));
  const buttons = read('src/component/buttons/scss/_css__buttons.scss');
  assert.ok(buttons.includes('--sf-button--background-color: var(--sf-place--tonal-hover, var(--sf-surface-container-hover));'));
  assert.ok(buttons.includes('--sf-button--background-color: var(--sf-place--tonal-active, var(--sf-surface-container-active));'));
  assert.equal((buttons.match(/var\(--sf-place--tonal-/g) || []).length, 2, 'no other button reads the tonal step');
});
