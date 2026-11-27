// Group build 20 D (header and data display): sf-header-site fit, sf-language
// shrink="code", the record scale at the value's text. The browser probe
// tests/browser/header-site-fit-gb20.browser.mjs draws them.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('sf-header-site 1.17.0: fit is a boolean setting, default off, documented', () => {
  const component = json('src/smart/header-site/component.json');
  assert.equal(component.version, '1.17.0');
  assert.deepEqual({type: component.settings.fit.type, default: component.settings.fit.default}, {type: 'boolean', default: false});
  const manifest = json('src/smart/header-site/smart.manifest.json');
  assert.equal(manifest.version, '1.17.0');
  assert.ok(manifest.props?.fit ?? manifest.attributes?.fit ?? JSON.stringify(manifest).includes('"fit"'));
  assert.match(read('src/smart/header-site/docs.md'), /collapse="lg" fit/u);
});

test('sf-header-site: fit lifts the auto fitting above a collapse step only', () => {
  const source = read('src/smart/header-site/index.js');
  assert.match(source, /const FIT_STEPS = \['sm', 'md', 'lg', 'xl'\];/u);
  assert.match(source, /get fitsRow\(\) \{\s*if \(this\.collapse === 'auto'\) return true;\s*return Boolean\(this\.fit\) && FIT_STEPS\.includes\(this\.collapse\);/u);
  // Every auto-only branch of 1.16.0 now asks fitsRow.
  assert.doesNotMatch(source, /this\.collapse === 'auto' && !this\.collapsed/u);
  assert.match(source, /const SHRINKING_TOOLS = '\[shrink="icon"\], sf-language\[shrink="code"\]';/u);
  // The fewest tools give way, in the page's order.
  assert.match(source, /setToolsShrunk\(count\) \{/u);
  assert.match(source, /while \(k < count && needs\.whole > roomWith\(k\) \+ 0\.5\) k \+= 1;/u);
});

test('sf-language 1.8.0: shrink none|code, host state data-shrunk, shrinkBoxes', () => {
  const component = json('src/smart/language/component.json');
  assert.equal(component.version, '1.8.0');
  assert.deepEqual(component.settings.shrink.values, ['none', 'code']);
  assert.equal(component.settings.shrink.default, 'none');
  assert.equal(component['host-states']['data-shrunk'], 'boolean');
  assert.match(read('src/smart/language/index.js'), /shrinkBoxes\(\) \{/u);
  assert.match(read('src/smart/language/docs.md'), /\| `shrink` \| `none` `code` \| `none` \|/u);
});

test('the shrunk code trigger: the held box one line narrower and the glyph hidden, both in core', () => {
  const core = read('src/core/scss/_sf_css__placeholder.scss');
  assert.match(core, /:where\(sf-language\[shrink="code"\]\[data-shrunk="true"\]:not\(\[trigger="icon"\], \[trigger="name"\]\)\) \{\s*--sf-language--trigger: calc\(2 \* var\(--sf-language--space-x\) \+ 2 \* var\(--sf-language--text-x\) \+ 2 \* var\(--sf-language--line\)\);/u);
  assert.match(core, /:where\(sf-language\[shrink="code"\]\[data-shrunk="true"\]:not\(\[trigger="icon"\], \[trigger="name"\]\)\) > \.sf-language-parts > sf-button > button > sf-icon:first-child > \* \{\s*display: none !important;/u);
  // The button sheet is unchanged: a site with its own copy of it still hides the glyph with core.
  assert.equal(json('src/component/buttons/passport.json').version, '1.22.5');
  assert.doesNotMatch(read('src/component/buttons/scss/_css__buttons_shrink.scss'), /sf-language/u);
});

test('field renderers 1.30.3: a viewed scale takes the value text, the cell keeps its line', () => {
  const source = read('src/smart/field-renderers/index.js');
  assert.match(source, /const SCALE_SIZE = \{'1': '2', '1\/2': '1'\};/u);
  assert.equal((source.match(/<sf-progress-scale size=\$\{scaleSize\(\)\}/gu) || []).length, 2);
  assert.doesNotMatch(source, /<sf-progress-scale size="1"/u);
  assert.match(source, /type: 'progress-scale', props: \{line: CELL_LINE/u);
  assert.equal(json('src/core/passports/module.smart-field-renderers.json').version, '1.30.3');
});
