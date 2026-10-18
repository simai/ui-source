import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, access} from 'node:fs/promises';
import {isSchema} from '../src/core/js/composition/schema-name.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

/* A Smart template reads the value its component resolved, not the raw
   attribute. tests/browser/template-context.browser.mjs renders every Smart
   component and holds the rule; this test holds the exemptions it reads: each
   names a real component, a getter it defines, and why the template takes a
   different value. */
test('template context: every exemption names a resolving getter and a reason', async () => {
  const contract = JSON.parse(await read('contracts/template-context.json'));
  assert.ok(isSchema(contract, 'simai.template-context', 1), 'either form of the format name');
  await access(new URL(`../${contract.checked_by}`, import.meta.url));
  const seen = new Set();
  for (const {component, prop, reason} of contract.exemptions) {
    const id = `${component}.${prop}`;
    assert.ok(!seen.has(id), `${id} listed twice`);
    seen.add(id);
    assert.ok(typeof reason === 'string' && reason.length > 40, `${id}: a reason is required`);
    const source = await read(`src/smart/${component}/index.js`);
    assert.match(source, new RegExp(`^  get ${prop}\\(\\) \\{`, 'm'), `${id}: no getter`);
  }
  const probe = await read(contract.checked_by);
  assert.match(probe, /contracts', 'template-context\.json'/);
  assert.match(probe, /no longer differs; remove the exemption/);
});

/* The defects the first run found, held at the source so a refactor of one
   templateContext() does not quietly drop the resolved value again. */
test('template context: the resolved names the templates read are passed', async () => {
  const expected = {
    badges: ['iconStart', 'iconEnd'],
    buttons: ['iconStart', 'iconEnd', 'type'],
    'icon-buttons': ['type', 'variant'],
    inputs: ['iconStart', 'textEnd', 'type', 'maskLazy'],
    'list-item': ['type'],
    modal: ['blur'],
    skeleton: ['variant', 'type'],
    tags: ['kind', 'type', 'size', 'inline', 'line'],
    textarea: ['type', 'minlength', 'maxlength'],
    toast: ['type'],
    toggle: ['type'],
  };
  for (const [component, names] of Object.entries(expected)) {
    const source = await read(`src/smart/${component}/index.js`);
    const body = source.match(/^ {2}templateContext\(\) \{[\s\S]*?^ {2}\}/m)?.[0] || '';
    for (const name of names) assert.match(body, new RegExp(`\\b${name}: this\\.${name},`), `${component}.${name}`);
  }
  const modal = await read('src/smart/modal/index.js');
  assert.match(modal, /isBlurTypeValue\(this\.getAttribute\("blur"\)\) \|\|\n {6}this\.getBooleanAttr\("blur", false\)/);
});
