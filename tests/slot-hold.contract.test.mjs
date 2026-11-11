// A component that holds its slot nodes keeps them in the page until it draws
// (pair ui-a0370c0c99fb acceptance, D1): sf-header-site took its nav out when
// it connected, and a page that found its sf-menu by id after
// customElements.whenDefined('sf-menu') got null on 8 of 20 loads. The
// browser probe is tests/browser/header-site-slot-in-document.browser.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const base = readFileSync(resolve(root, 'src/core/js/smart-base.js'), 'utf8');
const header = readFileSync(resolve(root, 'src/smart/header-site/index.js'), 'utf8');

test('the base holds slot nodes only for a component that asks, and releases them in the drawing task', () => {
  assert.match(base, /static holdsSlotNodesUntilDrawn = false;/u);
  assert.match(base, /holdSlotNode\(node\) \{\n {4}if \(this\.constructor\.holdsSlotNodesUntilDrawn !== true\) \{\n {6}node\.remove\(\);/u);
  // captureSlotTemplates hands every live slot child to holdSlotNode.
  assert.match(base, /noteAuthored\(slotNodes\);\n {6}this\.holdSlotNode\(child\);/u);
  // Released right before the template's render, with no await between.
  assert.match(base, /this\.releaseHeldSlotNodes\(\);\s*this\.markStylePending\(this\);[^]{0,400}?drawing\(\(\) => this\.renderTemplateResult\(templateResult\)\);/u);
  const between = base.slice(base.indexOf('this.releaseHeldSlotNodes();\n    this.markStylePending'), base.indexOf('drawing(() => this.renderTemplateResult(templateResult));'));
  assert.doesNotMatch(between, /\bawait\b/u);
});

test('sf-header-site holds its slots and its nav until it draws', () => {
  assert.match(header, /static holdsSlotNodesUntilDrawn = true;/u);
  assert.match(header, /nodes\.forEach\(\(node\) => this\.holdSlotNode\(node\)\);/u);
  assert.doesNotMatch(header, /nodes\.forEach\(\(node\) => node\.remove\(\)\)/u);
});
