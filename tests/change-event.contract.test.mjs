import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, readdir} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

/* Every form value control reports a committed change as `change` on its host,
   and its manifest says so: `change` is canonical, each older name points at
   it. Before, a consumer had to guess between change, sf-button-group-change,
   sf-datepicker-change, sf-dropdown:change and sf-range-slider-change, and a
   button group and a range slider emitted no `change` at all. */
test('change event: one canonical name for every value control', async () => {
  const axes = JSON.parse(await read('contracts/public-api-axes.json')).change_event;
  const listed = new Map(axes.aliases.map((entry) => [entry.component, entry.legacy]));
  for (const name of axes.controls) {
    const events = JSON.parse(await read(`src/smart/${name}/smart.manifest.json`)).events;
    assert.equal(events.change?.canonical, true, `${name}: change is canonical`);
    // The names that point at `change`, which is what this axis is about. A
    // control's other events have dated names of their own (a file upload's
    // eight, a code input's complete) and they point at their own event.
    const aliases = Object.entries(events).filter(([, event]) => event.alias_of === 'change').map(([key]) => key);
    assert.deepEqual(aliases.sort(), [...(listed.get(name) || [])].sort(), `${name}: the names pointing at change match the axes table`);
  }
  for (const name of listed.keys()) assert.ok(axes.controls.includes(name), name);

  // Outside the axis a canonical event is one a dated name points at -- the
  // generator marks it there and nowhere else (scripts/generate-component-
  // files.mjs eventsOf), so an invented `change` is still caught -- and every
  // alias points at a canonical event of its own manifest.
  for (const entry of await readdir(new URL('../src/smart/', import.meta.url), {withFileTypes: true})) {
    if (!entry.isDirectory() || axes.controls.includes(entry.name)) continue;
    const manifest = await read(`src/smart/${entry.name}/smart.manifest.json`).catch(() => null);
    if (!manifest) continue;
    const events = JSON.parse(manifest).events || {};
    for (const [key, event] of Object.entries(events)) {
      if (event.alias_of) {
        assert.ok(!event.canonical, `${entry.name} ${key}: an alias is not canonical`);
        assert.equal(events[event.alias_of]?.canonical, true, `${entry.name} ${key}: alias_of ${event.alias_of} is not canonical here`);
      }
      if (event.canonical) {
        assert.ok(Object.values(events).some((other) => other.alias_of === key), `${entry.name} ${key}: canonical with no dated name pointing at it`);
      }
    }
  }

  const group = await read('src/smart/button-group/index.js');
  // Once, under its native name (sfEmit: change keeps it, core/js/
  // element-manifest.js eventName); the shim sends sf-button-group-change
  // after it (standard 1.3.8 §16.20, aliases.json).
  assert.match(group, /emitValueChange\(detail\) \{\n    this\.sfEmit\('change', detail\);\n  \}/);
  assert.equal(group.match(/this\.emitValueChange\(\{/g)?.length, 2, 'select and clear');
  const slider = await read('src/component/range-slider/js/_range_slider.js');
  assert.match(slider, /if \(!root\._sfSettingValue\) \{\n      dispatchSliderEvent\(root, 'change', unencoded, \{ handle \}, 'change'\);/);
  assert.match(slider, /root\._sfSettingValue = true;\n  try \{\n    root\.noUiSlider\.set\(nextValue\);/);
  // The Smart slider stops the class component's change and
  // sf-range-slider-change at its host and sends change once, as its own
  // (standard 1.3.8 §8, through sfEmit, under its native name); the shim
  // sends the old names after it (aliases.json). Its onChange listens to
  // change, the canonical name.
  const smartSlider = await read('src/smart/range-slider/index.js');
  assert.doesNotMatch(smartSlider, /new (?:Custom)?Event\(\s*['"]change['"]/);
  assert.equal(smartSlider.match(/this\.sfEmit\('change', /g)?.length, 1);
  assert.doesNotMatch(smartSlider, /dispatchAliased\(this, 'change'/);
  assert.match(smartSlider, /_handleInnerChange = \(event\) => \{\n    event\.stopPropagation\(\);/);
  assert.doesNotMatch(smartSlider, /'sf-range-slider-change': 'onSliderChange'/);
  const sliderAliases = JSON.parse(await read('src/smart/range-slider/aliases.json')).aliases.filter((row) => row.kind === 'event');
  assert.deepEqual(sliderAliases.map((row) => [row.from, row.to]), [['sf-range-slider-change', 'change'], ['onSliderChange', 'change']]);
  assert.match(smartSlider, /onChange\(handler, options\) \{\n    if \(typeof handler === 'function'\) \{\n      this\.addEventListener\('change', /);
});

/* A tag's template reads the resolved kind: kind="checkbox" rendered an inert
   box because the template read the raw `type`. */
test('change event: a checkbox tag by kind is interactive', async () => {
  const tags = await read('src/smart/tag/index.js');
  assert.match(tags, /templateContext\(\) \{[\s\S]*?kind: this\.kind,\n      type: this\.type,/);
});
