import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relative) => readFile(path.resolve(root, relative), 'utf8');
const json = async (relative) => JSON.parse(await source(relative));
const uiDocRoot = process.env.UI_DOC_ROOT || '';
const uiDoc = (relative) => readFile(path.resolve(uiDocRoot, relative), 'utf8');

test('button group is registered as a component and a Smart Component', async () => {
  const [rules, componentRule, smartRule] = await Promise.all([
    source('src/core/js/rule.src.js'),
    source('src/component/button-group/rule.js'),
    source('src/smart/button-group/rule.js'),
  ]);

  assert.match(rules, /component\/button-group\/rule\.js/);
  assert.match(rules, /smart\/button-group\/rule\.js/);
  assert.match(componentRule, /type: 'component'/);
  assert.match(smartRule, /tags: \['sf-button-group'\]/);
  assert.match(smartRule, /name: 'button-group'/);
  assert.match(smartRule, /name: 'cl-buttons'/);
});

test('button group keeps layout and state ownership separated', async () => {
  const [component, styles, smart, template] = await Promise.all([
    source('src/component/button-group/js/_button-group.js'),
    source('src/component/button-group/scss/_css__button-group.scss'),
    source('src/smart/button-group/index.js'),
    source('src/smart/button-group/js/templates/default.js'),
  ]);

  assert.match(component, /syncButtonGroup/);
  assert.match(component, /MutationObserver/);
  assert.match(component, /childList: true/);
  assert.match(component, /getAttribute\('data-orientation'\)/);
  assert.match(component, /ORIENTED_ROLES\.has\(role\)/);
  assert.match(component, /removeAttribute\('aria-orientation'\)/);
  assert.doesNotMatch(component, /localStorage|fetch\(|XMLHttpRequest/);
  assert.match(smart, /emitComponentEvent\('button-group-change'/);
  assert.match(smart, /ArrowLeft/);
  assert.match(smart, /ArrowRight/);
  assert.match(smart, /ArrowUp/);
  assert.match(smart, /ArrowDown/);
  assert.match(smart, /Home/);
  assert.match(smart, /End/);
  assert.match(smart, /sf-after-render/);
  assert.doesNotMatch(smart, /queueMicrotask/);
  assert.doesNotMatch(smart, /localStorage|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(template, /aria-pressed|aria-checked|role="radio"|tabindex=/);
  assert.match(smart, /button\.setAttribute\('role', 'radio'\)/);
  assert.match(smart, /button\.setAttribute\('aria-checked'/);
  assert.match(smart, /button\.tabIndex =/);
  assert.match(smart, /syncButtonSemantics/);
  assert.match(template, /role="radiogroup"/);
  assert.match(template, /segment=/);
  // spacing, the axis; tightness is its legacy name (2026-10-13).
  assert.match(template, /spacing=/);
  assert.match(styles, /border-start-end-radius: 0/);
  assert.match(styles, /border-end-start-radius: 0/);
  assert.doesNotMatch(styles, /margin-inline-start:\s*-1px/);
  assert.match(styles, /@layer sf\.override/);
  // The perimeter rests on the boundary role, like every other control a person
  // presses or fills in. It was carrying the solid primitive of its own while
  // the rest of the Framework had moved, so a segmented control stood in a
  // heavier line than the buttons beside it.
  assert.match(styles, /border-block-color: var\(--sf-outline\)/);
  assert.match(styles, /border-inline-color: var\(--sf-outline\)/);
  assert.match(styles, /--sf-button--border-inline-start-width: 0/);
  assert.match(styles, /--sf-button--border-inline-end-width: var\(--sf-px\)/);
  assert.match(styles, /border-inline-start-width: 0/);
  assert.match(styles, /border-inline-end-width: var\(--sf-px\)/);
  assert.match(styles, /sf-button\[segment\]\[type\]\[scheme\]/);
  assert.doesNotMatch(styles, /sf-button\[data-sf-button-group-value\]/);
  assert.match(styles, /border-start-start-radius: var\(--sf-button--radius\)/);
  assert.match(styles, /border-end-end-radius: var\(--sf-button--radius\)/);
  assert.match(styles, /data-orientation='vertical'/);
  assert.match(styles, /aria-orientation='vertical'/);
  assert.match(styles, /focus-visible/);
  // One ring for the system: inside a seamless group it is the same outline,
  // turned inwards, instead of a second inset shadow of its own.
  assert.match(styles, /outline-offset: calc\(var\(--sf-focus--width\) \* -1\)/);
  assert.doesNotMatch(styles, /--sf-ui-focus/);
  assert.match(styles, /forced-colors: active/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(styles, /\b1px\b|0\.01ms/);
});

// The segmented appearance (simai/ui-source#4): a look, not a component and
// not tabs. The browser probe tests/browser/button-group-segmented.browser.mjs
// measures it on the built bytes; this holds the source to the same shape.
test('button group offers a segmented appearance with the same semantics', async () => {
  const [manifest, smart, template, component, styles, variables, axes] = await Promise.all([
    json('src/smart/button-group/smart.manifest.json'),
    source('src/smart/button-group/index.js'),
    source('src/smart/button-group/js/templates/default.js'),
    source('src/component/button-group/js/_button-group.js'),
    source('src/component/button-group/scss/_css__button-group.scss'),
    json('src/core/contracts/public-variables.v1.json'),
    json('contracts/public-api-axes.json'),
  ]);
  const inputs = manifest.inputs.properties;
  assert.deepEqual(inputs.appearance.enum, ['default', 'segmented']);
  assert.equal(inputs.appearance.default, 'default');
  assert.deepEqual(inputs.plate.enum, ['scheme', 'raised']);
  assert.equal(inputs['full-width'].type, 'boolean');
  assert.deepEqual(inputs.size.enum, ['1/3', '1/2', '1', '2', '3']);
  const item = inputs.items.items.properties;
  for (const field of ['value', 'label', 'icon', 'icon-only', 'count', 'aria-label', 'disabled']) assert.ok(item[field], `item.${field}`);
  assert.deepEqual(item.count.type, ['string', 'number']);
  // The same group: role, keyboard and events do not depend on the look.
  assert.equal(manifest.accessibility.role, 'radiogroup');
  assert.ok(manifest.events.change.canonical);
  assert.doesNotMatch(template, /role="tab|tablist|aria-selected/);
  assert.match(smart, /appearance: \{ default: 'default', values: \['default', 'segmented'\] \}/);
  assert.match(smart, /plate: \{ default: 'scheme', values: \['scheme', 'raised'\] \}/);
  assert.match(smart, /attribute: 'full-width', type: Boolean/);
  assert.match(smart, /:scope > sf-button, :scope > button/);
  assert.ok(axes.components.some((entry) => entry.component === 'button-group' && entry.axis === 'appearance'));
  // Segments are buttons of the same size and text classes, all of one look, so
  // the plate never changes a width; an icon-only label stays the name.
  assert.match(template, /`sf-button--size-\$\{context\.size\}`/);
  assert.match(template, /'sf-button--link',\s*'sf-button--on-surface'/);
  assert.match(template, /sf-button-group-label--hidden/);
  assert.match(template, /sf-button-group-count/);
  assert.match(template, /\[item\.ariaLabel \|\| item\.label, item\.count\]/);
  assert.doesNotMatch(template, /segment-[a-z]+(?=['"` ])|sf-button-group-segment-/u, 'no segment class carries the join substring');
  // A segmented group takes no join positions.
  assert.match(component, /sf-button-group--segmented/);
  // The track: container fill with its own dimmed ink, padding equal to the gap,
  // concentric corners, a size ladder, states from the alpha ramp.
  assert.match(styles, /background-color: var\(--sf-button-group-background-color, var\(--sf-surface-container\)\)/);
  assert.match(styles, /--sf-on-surface-variant: var\(--sf-on-surface-container--variant\)/);
  assert.match(styles, /gap: var\(--sf-button-group--padding\);\s*padding: var\(--sf-button-group--padding\)/);
  assert.match(styles, /border-radius: calc\(var\(--sf-button-group--plate-radius\) \+ var\(--sf-button-group--padding\)\)/);
  for (const size of ['1\\/3', '1\\/2', '2', '3']) assert.ok(styles.includes(`.sf-button-group--segmented.sf-button-group--size-${size} {`), size);
  assert.match(styles, /--sf-button--background-color: var\(--sf-alpha-8\)/);
  assert.match(styles, /--sf-button--background-color: var\(--sf-alpha-12\)/);
  assert.match(styles, /sf-button-group--plate-raised[^{]*\{[^}]*--sf-elevation-1--surface[^}]*--sf-elevation-1--shadow/);
  assert.match(styles, /font-variant-numeric: tabular-nums/);
  assert.match(styles, /\.sf-button-group-segment:focus-visible \{\s*outline-offset: 0;/);
  assert.match(styles, /forced-colors: active[\s\S]*sf-button-group--segmented[\s\S]*Highlight/);
  assert.doesNotMatch(styles, /\b(?:left|right|margin-left|margin-right|padding-left|padding-right)\s*:/u, 'logical properties only');
  const entry = variables.components.find((candidate) => candidate.component === 'button-group');
  assert.deepEqual(entry.variables.map((variable) => variable.name), [
    '--sf-button-group-background-color', '--sf-button-group-padding', '--sf-button-group-color',
    '--sf-button-group-plate-background-color', '--sf-button-group-plate-color', '--sf-button-group-count-color',
  ]);
});

test('button group Studio artifacts expose a meaningful selectable fixture', async () => {
  const [manifest, fixture, scenario] = await Promise.all([
    json('src/smart/button-group/smart.manifest.json'),
    json('src/smart/button-group/studio.fixture.json'),
    json('src/smart/button-group/studio.scenario.json'),
  ]);

  assert.equal(manifest.id, 'smart.button-group');
  assert.equal(manifest.custom_element, 'sf-button-group');
  assert.ok(manifest.inputs.properties.items.examples[0].length >= 2);
  assert.deepEqual(manifest.inputs.properties.tightness.enum, ['', 'low', 'high', 'highest']);
  assert.deepEqual(manifest.inputs.properties.orientation.enum, ['horizontal', 'vertical']);
  assert.deepEqual(Object.keys(fixture.props).filter((name) => !(name in manifest.inputs.properties)), []);
  assert.ok(fixture.props.items.length >= 3);
  assert.ok(fixture.props.items.every((item) => !item.disabled));
  assert.equal(scenario.actions[0].method, 'select');
  assert.equal(scenario.actions[1].type, 'keypress');
  assert.ok(scenario.assertions.some((assertion) => assertion.name === 'sf-button-group-change'));
});

test('button group documentation separates generic actions from managed selection', {
  skip: !uiDocRoot,
}, async () => {
  const [page, overview, vertical] = await Promise.all([
    uiDoc('content/ru/components/actions/button-group.md'),
    uiDoc('examples/components/button-group/overview/index.html'),
    uiDoc('examples/components/button-group/orientation/index.html'),
  ]);

  assert.match(page, /Smart Button Group/);
  assert.match(page, /data-orientation="vertical"/);
  assert.match(overview, /role="group"/);
  assert.doesNotMatch(overview, /aria-pressed|role="radio"/);
  assert.match(vertical, /data-orientation="vertical"/);
  assert.doesNotMatch(vertical, /aria-orientation/);
  assert.doesNotMatch(`${overview}\n${vertical}`, /<style\b|style=/);
});
