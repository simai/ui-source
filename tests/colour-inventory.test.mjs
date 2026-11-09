import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {colourInventory, reviewColourFindings, scanColours} from '../scripts/colour-inventory-lib.mjs';

// C18 (owner, 2026-11-08): every colour from the dynamic or static palette.
// The inventory fails on any raw colour that colour-policy.v1.json does not
// review.

const repositoryRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const policy = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'src/core/contracts/colour-policy.v1.json'), 'utf8'));

test('hex, colour functions and named colours in value positions are found', () => {
  const source = [
    '.a { color: #fff; background: #11223344; border-color: rgb(0 0 0 / 30%); }',
    '.b { outline: 1px solid black; fill: hsl(10 20% 30%); }',
    "el.style.boxShadow = '0 0 0 4px lightgrey';",
    '<path fill="white"></path>',
    '.c { color: rgb(map-get($shade, r), 0, 0); }',
  ].join('\n');
  const found = scanColours(source, 'component/x/index.scss');
  assert.deepEqual(found.map(finding => finding.text.replace(/\s+/g, ' ')), ['#fff', '#11223344', 'rgb(0', 'black', 'hsl(1', 'lightgrey', 'white', 'rgb(map-get(']);
  assert.ok(found.every(finding => finding.status === 'unreviewed'));
  assert.equal(found[0].line, 1);
  assert.equal(found[3].line, 2);
  const script = scanColours("panel.style.borderBottom = '0 solid black'; button.style.boxShadow = `0 0 0 4px lightgrey`;", 'component/x/js/index.js');
  assert.deepEqual(script.map(finding => finding.text), ['black', 'lightgrey']);
});

test('tokens, keywords, ids, entities, identifiers and prose are not colours', () => {
  for (const [file, source] of [
    ['component/x/index.scss', '.x { color: var(--sf-on-surface); background: transparent; border-color: currentColor; }'],
    ['component/x/index.scss', '.sf-special-white { color: inherit; } .color-red-5 {}'],
    ['smart/x/index.js', "document.querySelector('#accordion'); const a = '&#039;';"],
    ['smart/x/index.js', "const red = channel(red, green, blue); this.setColorTheme('white');"],
    ['core/js/tailwind-map.js', 'const m = base.match(/^(bg|text)-(white|black)$/);'],
    ['smart/x/component.json', '{"summary": "a fixed 60% black scrim"}'],
    ['smart/x/meta.mjs', 'export default {"description": "neutral raised surface: white in light"};'],
  ]) assert.deepEqual(scanColours(source, file).map(finding => finding.text), [], `${file}: ${source}`);
});

test('comments, fixtures, definitions and vendor code are categorised, not silently approved', () => {
  for (const [file, source, category] of [
    ['component/x/index.scss', '// was #000', 'comment-review'],
    ['component/x/index.html', '<!-- was #000 -->', 'comment-review'],
    ['smart/x/examples.json', '{"value": "#112233"}', 'fixture-review'],
    ['smart/x/static/default/a.html', '<path fill="#005BBE"></path>', 'fixture-review'],
    ['core/scss/vars/_sf_var__color.scss', '$x: #fff;', 'definition-review'],
    ['core/js/vendor/lib.js', 'x = "#fff";', 'vendor-review'],
    ['smart/x/index.js', 'x = "#fff";', 'script-data-template-review'],
    ['component/x/index.scss', '.x { color: #fff; }', 'style-review'],
  ]) {
    const [finding] = scanColours(source, file);
    assert.equal(finding.category, category, `${file}: ${source}`);
    assert.equal(finding.status, 'unreviewed');
  }
});

test('the source holds no unreviewed raw colour', () => {
  const result = colourInventory(path.join(repositoryRoot, 'src'), {policy});
  const open = result.findings.filter(finding => ['unreviewed', 'policy-conflict'].includes(finding.status));
  assert.equal(result.unresolvedCount, 0, open.map(finding => `${finding.file}:${finding.line} ${finding.text} [${finding.status}] ${finding.context}`).join('\n'));
  assert.deepEqual(result.unusedRules, [], 'every policy rule still reviews a finding; a rule with nothing left to review is removed');
  assert.ok(result.byStatus['accepted-system-definition'] > 0);
});

test('the policy approves no new colour outside its boundaries', () => {
  for (const [file, source] of [
    ['smart/modal/index.js', "node.style.background = '#fff';"],
    ['component/buttons/scss/_css__buttons.scss', '.x { box-shadow: 0 0 #0000; }'],
    ['component/special/scss/_white.scss', '.x { color: #000!important; }'],
    ['core/scss/_sf_css__logo.scss', '.sf-logo-1 { color: #221F20; }'],
    ['core/js/loader.js', "node.style.color = '#123456';"],
  ]) {
    const [finding] = reviewColourFindings(scanColours(source, file), policy);
    assert.equal(finding.status, 'unreviewed', `${file}: ${source}`);
  }
  for (const rule of policy.rules) {
    assert.match(rule.id, /^[a-z0-9-]+$/);
    assert.ok(rule.reason.length > 20, `${rule.id} states its reason`);
    if (rule.status.startsWith('deferred-')) assert.match(rule.reason, /remove this rule/i, `${rule.id} names when it goes`);
  }
});
