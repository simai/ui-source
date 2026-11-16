// First paint leftovers of the R222 status (ui-control control/evidence/
// 2026-11-16-first-paint-fp open items 8 and 10, RG-S2-7): the bare sf-tag's
// status and pressable widths, the 1/2 site bar holding a size-1 row, and a
// printed sf-tag-group «+N» replaced by the drawn one.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const core = read('src/core/scss/_sf_css__placeholder.scss');
const group = read('src/smart/tag-group/index.js');

const ruleOf = (selector) => {
  const at = core.indexOf(`${selector} {`);
  assert.ok(at >= 0, `no rule ${selector}`);
  return core.slice(at, core.indexOf('}', at));
};

test('status tag: the badge side room, its line kept on a text line (open item 8)', () => {
  const status = ruleOf(':where(sf-tag[status]:not([status=""]):not([interactive]):not([closable]):not(:defined))');
  assert.match(status, /--sf-tag--box-edge: var\(--sf-space-1\\\/2\);/u);
  assert.doesNotMatch(status, /--sf-tag--box-control/u, 'a status on a line keeps the line\'s height');
  const offLine = ruleOf(':where(sf-tag[status]:not([status=""]):not([interactive]):not([closable]):not([line]:not([line=""])):not(:defined))');
  assert.match(offLine, /--sf-tag--box-control: var\(--sf-c2\);/u);
  assert.match(offLine, /--sf-tag--box-text: var\(--sf-text-size-1\\\/3\);/u);
});

test('pressable removable tag: the cross stands centred in its --sf-c2 target (open item 8)', () => {
  const rule = ruleOf(':where(sf-tag[interactive]:not([interactive="false"])[closable]:not([closable="false"]):not([line]:not([line=""])):not(:defined))');
  assert.match(rule, /--sf-tag--box-cross-gap: max\(calc\(var\(--sf-px\) \* 0\), calc\(\(var\(--sf-c2\) - var\(--sf-tag--box-cross\)\) \/ 2\)\);/u);
  assert.match(core, /padding-inline-end: calc\(var\(--sf-tag--box-edge\) \+ var\(--sf-tag--box-cross-on\) \* \(var\(--sf-tag--box-cross\) \+ var\(--sf-tag--box-cross-gap\)\)\);/u);
});

test('RG-S2-7: a 1/2 site bar with a size-1 control in its row holds the size-1 box', () => {
  assert.match(core, /\$sf-site-header-wide: ':is\(sf-button, sf-button-icon, sf-icon-button, sf-segmented, sf-button-group, sf-language, sf-menu\):is\(\[size="1"\], \[size=""\], :not\(\[size\]\)\)';/u);
  assert.match(core, /\[size="1\/2"\]:where\(:has\(> \[slot="tools"\]#\{\$sf-site-header-wide\}, > \.sf-site-header > \.sf-site-header-row > \.sf-site-header-tools > #\{\$sf-site-header-wide\}\)\)/u);
  // The nav and the actions count only above the collapse step, the sheet's own.
  assert.match(core, /@each \$collapse, \$step in \(sm: g6, md: h1, lg: h5, xl: h8\)/u);
  assert.match(core, /\[size="1\/2"\]\[collapse="none"\]:where\(:has\(#\{\$sf-site-header-wide-row\}\)\)/u);
});

test('open item 10: the drawn «+N» replaces a printed one', () => {
  const fit = group.slice(group.indexOf('  fit() {'), group.indexOf('  moreElement('));
  assert.match(fit, /this\.querySelectorAll\(`:scope > \[\$\{MORE\}\]`\)/u);
  assert.match(fit, /if \(node !== this\._more\) node\.remove\(\);/u);
});
