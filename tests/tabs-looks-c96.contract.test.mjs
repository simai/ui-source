// Owner decision C96 (1) (2026-11-12, DEV register RG-B-35): the tabs have two
// looks, the line (default) and the plate (sf-tabs--pills). The class markup
// still drew filled primary buttons without a modifier and kept the full look;
// a .sf-tabs without a look modifier now draws the line, and sf-tabs--full is
// a dated former name: the line with the tabs sharing the row.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sheet = readFileSync(resolve(root, 'src/component/tabs/scss/_css__tabs.scss'), 'utf8');
const LINE = '.sf-tabs:is(.sf-tabs--underline, :not(.sf-tabs--pills, .sf-tabs--vertical))';
const BARE_LINE = ':is(.sf-tabs--underline, :where(.sf-tabs:not(.sf-tabs--pills, .sf-tabs--vertical)))';

function rules(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map(([, selector, body]) => ({selector: selector.replace(/\/\/[^\n]*\n|\/\*[\s\S]*?\*\//gu, '').trim(), body}));
}

test('C96 (1): a .sf-tabs without a look modifier draws the line', () => {
  assert.doesNotMatch(sheet, /\.sf-tabs\.sf-tabs--underline\b/u, 'every line rule also takes the bare .sf-tabs');
  assert.doesNotMatch(sheet, /(?:^|[\s,])\.sf-tabs--underline[\s.>:]/mu, 'every bare line rule also takes the bare .sf-tabs');
  assert.ok(sheet.split(LINE).length > 25, 'the line rules read the default');
  assert.ok(sheet.split(BARE_LINE).length > 10, 'the line layout rules read the default at their own specificity');
  // The selected tab of the line is transparent with the indicator line.
  const selected = rules(sheet).find(({selector}) => selector.startsWith(`${LINE} > .sf-tabs-top-container > .sf-tabs-top .sf-button.selected`));
  assert.ok(selected, 'the line paints the selected tab');
  assert.match(selected.body, /--sf-button--background-color: transparent;/u);
});

test('C96 (1): sf-tabs--full keeps only the shared row; its fills, borders and hover are gone', () => {
  const full = rules(sheet).filter(({selector}) => selector.includes('sf-tabs--full'));
  assert.ok(full.length >= 4 && full.length <= 5, `${full.length} full rules`);
  for (const {selector, body} of full) {
    assert.doesNotMatch(body, /background-color|border-color|border-(?:top|bottom|inline-start|inline-end)-width|radius|text-container--color|--sf-icon--color/u, selector);
  }
  assert.ok(full.some(({body}) => /grid-auto-columns: minmax\(max-content, 1fr\)/u.test(body)), 'equal columns');
  const transparentRow = rules(sheet).find(({body}) => /--sf-tabs-top-container--border-width: 0;/u.test(body));
  assert.doesNotMatch(transparentRow.selector, /--full/u, 'the full row keeps the line under the row');
});

test('C96 (1): the plate and the menu column keep their own rules', () => {
  assert.ok(rules(sheet).some(({selector}) => selector.startsWith('.sf-tabs.sf-tabs--pills > .sf-tabs-top-container > .sf-tabs-top .sf-button.selected')));
  assert.match(sheet, /\.sf-tabs--vertical > \.sf-tabs-top-container > \.sf-tabs-top \{/u);
});

test('C96 (1): sf-tabs--full is a dated former name in the one table', async () => {
  const {retiredClassName} = await import('../src/core/js/utility-class-aliases.js');
  const retired = retiredClassName('sf-tabs--full');
  assert.equal(retired.to, 'sf-tabs');
  assert.equal(retired.found.remove_after, '2027-01-01');
  assert.equal(retiredClassName('sf-tabs--pills'), null);
  assert.equal(retiredClassName('sf-tabs--underline'), null);
});
