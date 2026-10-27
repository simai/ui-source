import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {withoutPublicVariables} from './support/public-variables.mjs';

const read = async (path) => withoutPublicVariables(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

const hex = (value) => [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16));
const luminance = (rgb) => rgb.map((channel) => {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};
const over = (line, alpha, background) => line.map((channel, index) => channel * alpha + background[index] * (1 - alpha));

/* The boundary of anything a person has to find holds WCAG 1.4.11's 3:1 in
   either theme: a person has to find a field before hovering or focusing it,
   and a phone has no hover. Decided by the owner on 2026-10-06 after a
   side-by-side page; --sf-outline-variant (1.34:1 and 1.92:1) was measured and
   rejected for the boundary.

   It lived in a third role, --sf-outline-control, until 2026-10-08. The system
   has two neutral boundary roles, and in the light theme the third one came out
   at exactly --sf-outline-disable -- a field at rest and a field nobody can
   type in drawn in the same line. The value is --sf-outline itself now. */
test('control boundary: the resting role holds 3:1 on surface-0 in both themes', async () => {
  const theme = await read('src/core/scss/_sf_css__theme.scss');
  const colours = await read('src/core/scss/_sf_figma_colors_variables.scss');
  const primitive = (name) => hex(colours.match(new RegExp(`--sf-${name}: (#[0-9a-f]{6});`, 'iu'))[1]);
  // Both halves are steps of the alpha scale, not a mix written in the role.
  const role = theme.match(/--sf-outline: light-dark\(var\(--sf-([\w-]+)--alfa-(\d+)\), var\(--sf-([\w-]+)--alfa-(\d+)\)\);/u);
  assert.ok(role, 'the role is declared as one alpha step of a primitive per theme');
  // The scale climbs in fours; a step off that footing is a value invented here.
  assert.equal(Number(role[2]) % 4, 0, `light step ${role[2]} is not on the scale`);
  assert.equal(Number(role[4]) % 4, 0, `dark step ${role[4]} is not on the scale`);
  for (const [name, step] of [[role[1], role[2]], [role[3], role[4]]]) {
    assert.match(colours, new RegExp(`--sf-${name}--alfa-${step}: #[0-9a-f]{8};`, 'iu'),
      `--sf-${name}--alfa-${step} is declared among the primitives`);
  }
  assert.match(theme, /--sf-surface-0: light-dark\(var\(--sf-white\), var\(--sf-neutral-5\)\);/u);
  const light = contrast(over(primitive(role[1]), role[2] / 100, [255, 255, 255]), [255, 255, 255]);
  const dark = contrast(over(primitive(role[3]), role[4] / 100, primitive('neutral-5')), primitive('neutral-5'));
  assert.ok(light >= 3, `light ${light.toFixed(2)}:1`);
  assert.ok(dark >= 3, `dark ${dark.toFixed(2)}:1`);
  // and calmer than the solid primitive it comes from: at full opacity this is
  // the 4.47:1 line the owner asked to leave behind.
  assert.ok(role[2] < 100 && role[4] < 100);
  // The third role is gone, not merely unused.
  assert.doesNotMatch(theme, /--sf-outline-control:/u);
  // And weaker than the live boundary, in both themes. The disabled line used
  // to be the same value in the light theme and a stronger one in the dark --
  // 4.13:1 against 3.12:1 -- so the control that was switched off was the one
  // that stood out. It takes the ink scale's lower step now (owner,
  // 2026-10-08).
  const disabled = theme.match(/--sf-outline-disable: light-dark\(var\(--sf-([\w-]+)--alfa-(\d+)\), var\(--sf-([\w-]+)--alfa-(\d+)\)\);/u);
  assert.ok(disabled, 'the disabled boundary is one alpha step of a primitive per theme');
  const lightOff = contrast(over(primitive(disabled[1]), disabled[2] / 100, [255, 255, 255]), [255, 255, 255]);
  const darkOff = contrast(over(primitive(disabled[3]), disabled[4] / 100, primitive('neutral-5')), primitive('neutral-5'));
  assert.ok(lightOff < light, `light: disabled ${lightOff.toFixed(2)}:1 is not weaker than ${light.toFixed(2)}:1`);
  assert.ok(darkOff < dark, `dark: disabled ${darkOff.toFixed(2)}:1 is not weaker than ${dark.toFixed(2)}:1`);
  // Still drawn, though: a boundary nobody can see is a control that has lost
  // its shape rather than its use.
  assert.ok(lightOff > 1.5 && darkOff > 1.5, `disabled ${lightOff.toFixed(2)}:1 and ${darkOff.toFixed(2)}:1 are too faint to read as a boundary`);
});

test('control boundary: input controls rest on the role', async () => {
  const resting = {
    'src/component/inputs/scss/_css__inputs.scss': '--sf-input-field--border-color',
    'src/component/textarea/scss/_css__textarea.scss': '--sf-textarea-textarea--border-color',
    'src/component/dropdown/scss/_css__dropdown.scss': '--sf-dropdown-field--border-color',
    'src/component/country-code/scss/_css_country_code.scss': '--sf-country-code-field--border-color',
    'src/component/checkbox/scss/_css__checkbox.scss': '--sf-checkbox-box--border-color',
    'src/component/radio/scss/_css_radio.scss': '--sf-radio-button-box--border-color',
    'src/component/switch/scss/_css_switch.scss': '--sf-switch-toggler--border-color',
    'src/component/quantity/scss/_css__quantity.scss': '--sf-quantity-wrap--border-color',
    'src/component/file-upload/scss/_css__file_upload.scss': '--sf-file-upload--border-color',
    'src/component/buttons/scss/_css__buttons.scss': '--sf-button--border-color',
    'src/component/icon-buttons/scss/_css_icon_buttons.scss': '--sf-icon-button--border-color',
  };
  for (const [path, variable] of Object.entries(resting)) {
    const source = await read(path);
    // A public variable may stand before the role (standard 1.3.8 §6): the
    // rest state reads it, with the role as the fallback.
    const rests = source.includes(`${variable}: var(--sf-outline);`)
      || new RegExp(`${variable}: var\\(--sf-[a-z]+(?:-[a-z]+)*-border-color, var\\(--sf-outline\\)\\);`, 'u').test(source);
    assert.ok(rests, `${path}: ${variable} rests on --sf-outline`);
  }
  // Nothing may ask for the role that was removed.
  for (const path of Object.keys(resting)) {
    assert.doesNotMatch(await read(path), /var\(--sf-outline-control\)/u, `${path}: the third role is gone`);
  }
  // A segmented control draws its own perimeter instead of taking a button's
  // border variable, so it is read by what it declares. It stayed on
  // --sf-outline when the role was introduced: the group then stood in a
  // heavier line than the buttons beside it, which is what the owner saw --
  // «Отменить» calm and «Моё / Для всех» dark, in the same bar.
  const group = await read('src/component/button-group/scss/_css__button-group.scss');
  for (const side of ['block', 'inline']) {
    assert.ok(group.includes(`border-${side}-color: var(--sf-outline);`),
      `button-group: its ${side} perimeter rests on --sf-outline`);
  }
  // The link segments of the same group draw the same perimeter, in a file of
  // their own -- left behind, half a control was a heavier line than the rest.
  const custom = await read('src/component/buttons/scss/_css__buttons_custom.scss');
  assert.ok(custom.includes('border-color: var(--sf-outline);'),
    'a link segment draws the group perimeter in the boundary role');

  const doc = await read('docs/foundation-composition-geometry.md');
  assert.ok(doc.includes('tests/browser/control-boundary.cli.js'));
});
