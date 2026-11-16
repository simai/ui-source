// The help link in a notice's text (owner decision C126): one rule for
// sf-alert, sf-toast and sf-alert-bar -- the text's own ink, never the theme's
// link blue; underlined at the link weight, doubled under the pointer; the
// keyboard ring in the same ink. The colours are measured in the browser
// probe (ui-control evidence 2026-11-13-c126-notice-link): 4.5:1 and more for
// the link and 3:1 and more for the ring on every fill, light and dark.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const USE = "@use '../../../core/scss/mix/mix__notice-link' as notice-link;";

test('the shared rule: text ink, underline at the link weight, doubled on hover, ring in the ink', () => {
  const mix = read('src/core/scss/mix/_mix__notice-link.scss');
  assert.match(mix, /@mixin sf-notice-link\(\$text\)/);
  assert.match(mix, /#\{\$text\} a\[href\] \{\n    color: inherit;\n    text-decoration-line: underline;\n    text-decoration-color: currentColor;\n    text-decoration-thickness: var\(--sf-link--underline-weight\);/);
  assert.match(mix, /a\[href\]:is\(:hover, :active, :visited\) \{\n    color: inherit;/);
  assert.match(mix, /a\[href\]:is\(:hover, :active\) \{\n    text-decoration-thickness: calc\(2 \* var\(--sf-link--underline-weight\)\);/);
  assert.match(mix, /a\[href\]:focus-visible \{\n    outline-color: currentColor;/);
  // No link role and no literal colour in the rule.
  assert.ok(!/--sf-link\b(?!--)/.test(mix.replace(/\/\/.*$/gm, '')), 'the notice link never reads --sf-link');
  assert.ok(!/#[0-9a-f]{3,8}\b|rgb\(/i.test(mix.replace(/\/\/.*$/gm, '')), 'no literal colour');
});

test('every notice includes the rule on its text block', () => {
  const sheets = {
    'src/component/alerts/scss/_css__alerts.scss': "@include notice-link.sf-notice-link('.sf-alert .sf-alert-content');",
    'src/component/toast/scss/_css__toast.scss': "@include notice-link.sf-notice-link('.sf-toast .sf-toast-wrap');",
    'src/smart/alert-bar/scss/_smart__alert-bar.scss': "@include notice-link.sf-notice-link('.sf-alert-bar :is(.sf-alert-bar-text, .sf-alert-bar-item-text)');",
  };
  for (const [path, include] of Object.entries(sheets)) {
    const sheet = read(path);
    assert.ok(sheet.includes(USE), `${path} uses the shared rule`);
    assert.equal(sheet.split(include).length - 1, 1, `${path} includes it once on its text`);
  }
});

test('the docs say it: help only, actions are buttons; sf-alert shows it in an example', () => {
  for (const path of ['src/smart/alert/docs/docs.md', 'src/smart/toast/docs/docs.md', 'src/smart/alert-bar/docs.md', 'src/component/alerts/docs/docs.md', 'src/component/toast/docs/docs.md']) {
    const doc = read(path);
    assert.match(doc, /C126/, `${path} names the decision`);
    assert.match(doc, /Узнать больше/, `${path} shows the help link`);
  }
  const examples = JSON.parse(read('src/smart/alert/examples.json')).examples;
  const help = examples.find((one) => one.name === 'help-link');
  assert.ok(help, 'sf-alert has the help-link example');
  assert.match(help.slots['supporting-text'], /<a href="#help">Узнать больше<\/a>/);
  assert.ok(JSON.parse(read('src/smart/alert/component.json')).slots['supporting-text'], 'the slot is declared');
});
