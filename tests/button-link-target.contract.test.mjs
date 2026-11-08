import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// sf-button 1.7.0 (Larena after sf-wizard, msg-12cd5ef6): a link button says
// where it opens and its relation. The behaviour in a browser is the
// conformance probe's p11-link-target-rel; this holds the source to it.
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('src/smart/button/smart.manifest.json'));
const template = read('src/smart/button/js/templates/default.js');
const index = read('src/smart/button/index.js');

test('sf-button declares target and rel as string settings', () => {
  for (const name of ['target', 'rel']) {
    assert.equal(manifest.inputs.properties[name]?.type, 'string', name);
    assert.equal(manifest.inputs.properties[name]?.default, '', name);
    assert.ok(manifest.composition.declarative.props.includes(name), `${name} is a composition prop`);
  }
});

test('target and rel are written on the link only, never forwarded onto a button', () => {
  const link = template.slice(template.indexOf('if (context.href)'), template.indexOf('<button'));
  const button = template.slice(template.indexOf('<button'));
  assert.match(link, /target=\$\{context\.linkTarget \|\| nothing\}/);
  assert.match(link, /rel=\$\{context\.linkRel \|\| nothing\}/);
  assert.doesNotMatch(button, /target=|rel=/);
  // Declared, they are not host attributes to forward.
  assert.match(index, /"target",\n\s*"rel",/);
});

test('a new tab with no rel is noopener noreferrer; a written rel is kept', async () => {
  const source = index.slice(index.indexOf('function linkRelation'), index.indexOf('function applyButtonAttributes'));
  const linkRelation = new Function(`${source}; return linkRelation;`)();
  assert.equal(linkRelation('_blank', ''), 'noopener noreferrer');
  assert.equal(linkRelation('_BLANK', null), 'noopener noreferrer');
  assert.equal(linkRelation('_blank', 'noopener'), 'noopener');
  assert.equal(linkRelation('_self', ''), '');
  assert.equal(linkRelation('', 'nofollow'), 'nofollow');
});
