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
    const aliases = Object.entries(events).filter(([, event]) => event.alias_of).map(([key]) => key);
    for (const alias of aliases) assert.equal(events[alias].alias_of, 'change', `${name} ${alias}`);
    assert.deepEqual(aliases.sort(), [...(listed.get(name) || [])].sort(), `${name}: aliases match the axes table`);
  }
  for (const name of listed.keys()) assert.ok(axes.controls.includes(name), name);

  // No other component claims a canonical name or an alias it does not list.
  for (const entry of await readdir(new URL('../src/smart/', import.meta.url), {withFileTypes: true})) {
    if (!entry.isDirectory() || axes.controls.includes(entry.name)) continue;
    const manifest = await read(`src/smart/${entry.name}/smart.manifest.json`).catch(() => null);
    if (!manifest) continue;
    for (const [key, event] of Object.entries(JSON.parse(manifest).events || {})) {
      assert.ok(!event.alias_of && !event.canonical, `${entry.name} ${key}`);
    }
  }

  const group = await read('src/smart/button-group/index.js');
  assert.match(group, /this\.emitComponentEvent\('button-group-change', detail\);\n    this\.dispatchEvent\(new CustomEvent\('change', \{/);
  assert.equal(group.match(/this\.emitValueChange\(\{/g)?.length, 2, 'select and clear');
  const slider = await read('src/component/range-slider/js/_range_slider.js');
  assert.match(slider, /if \(!root\._sfSettingValue\) \{\n      dispatchSliderEvent\(root, 'change', unencoded, \{ handle \}, 'change'\);/);
  assert.match(slider, /root\._sfSettingValue = true;\n  try \{\n    root\.noUiSlider\.set\(nextValue\);/);
  // The Smart slider forwards only the prefixed names; repeating `change` would
  // double it. Its onChange listens to change, the canonical name, and nothing
  // else of it names change.
  const smartSlider = await read('src/smart/range-slider/index.js');
  assert.doesNotMatch(smartSlider, /new (?:Custom)?Event\(\s*['"]change['"]/);
  assert.deepEqual(smartSlider.match(/['"]change['"]/g), ["'change'"]);
  assert.match(smartSlider, /onChange\(handler, options\) \{\n    if \(typeof handler === 'function'\) \{\n      this\.addEventListener\('change', /);
});

/* A tag's template reads the resolved kind: kind="checkbox" rendered an inert
   box because the template read the raw `type`. */
test('change event: a checkbox tag by kind is interactive', async () => {
  const tags = await read('src/smart/tags/index.js');
  assert.match(tags, /templateContext\(\) \{[\s\S]*?kind: this\.kind,\n      type: this\.type,/);
});
