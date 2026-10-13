import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const source = (file) => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');

test('Radio and Switch use the Framework hairline token', async () => {
  for (const [kind, file] of [
    ['radio', '_css_radio.scss'],
    ['switch', '_css_switch.scss'],
  ]) {
    const css = await source(`component/${kind}/scss/${file}`);
    assert.match(css, /--sf-[\w-]+--border:\s*var\(--sf-px\) solid/);
    assert.match(css, /--sf-[\w-]+--border-width:\s*var\(--sf-px\)/);
    assert.doesNotMatch(css, /(?:^|[\s:])1px(?:[\s;]|$)/m);
  }
});

test('Radio, Switch and Toggle expose their whole enabled label as interactive', async () => {
  for (const [kind, file, root] of [
    ['radio', '_css_radio_custom.scss', 'sf-radio-button'],
    ['switch', '_css_switch_custom.scss', 'sf-switch'],
    ['toggle', '_css_toggle_custom.scss', 'sf-toggle'],
  ]) {
    const css = await source(`component/${kind}/scss/${file}`);
    assert.match(css, new RegExp(`\\.${root}:not\\(\\.disabled\\):has\\(input:not\\(:disabled\\)\\)\\s*\\{[^}]*cursor:\\s*pointer`, 's'));
    assert.match(css, new RegExp(`\\.${root}:has\\(input:disabled\\)\\s*\\{[^}]*cursor:\\s*default`, 's'));
  }
});

test('Switch and Toggle constructors preserve native switch semantics', async () => {
  for (const kind of ['switch', 'toggle']) {
    const js = await source(`component/${kind}/js/_${kind}.js`);
    assert.match(js, /input\.type\s*=\s*['"]checkbox['"]/);
    assert.match(js, /input\.setAttribute\(['"]role['"],\s*['"]switch['"]\)/);
    assert.match(js, /(?:this\.)?input\.defaultChecked\s*=\s*(?:this\.)?input\.checked/);
  }
});

test('font Radio remains a named native group with a complete visual state contract', async () => {
  const js = await source('component/radio/js/_radio.js');
  const css = await source('component/radio/scss/_css_radio_custom.scss');
  assert.match(js, /input\.setAttribute\('aria-label', optionLabel\)/);
  assert.match(js, /input\.defaultChecked\s*=\s*input\.checked/);
  assert.match(css, /\.sf-radio-button--type-font/);
  assert.match(css, /\.sf-radio-text\.active/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
});

test('Smart Switch and Toggle templates preserve native switch semantics', async () => {
  for (const kind of ['switch', 'toggle']) {
    const template = await source(`smart/${kind}/js/templates/default.js`);
    assert.match(template, /type="checkbox"/);
    assert.match(template, /role="switch"/);
    assert.match(template, /\.checked=\$\{/);
  }
});

test('selection owner manifests declare base composition, closed variants and native state', async () => {
  const expectations = {
    radio: { sizes: ['1/2', '1', '2'], types: null, role: 'radio' },
    switch: { sizes: ['1/2', '1', '2'], types: null, role: 'switch' },
    toggle: { sizes: ['1', '2'], types: ['simple', 'icon', 'short'], role: 'switch' },
  };

  for (const [kind, expected] of Object.entries(expectations)) {
    const manifest = JSON.parse(await source(`smart/${kind}/smart.manifest.json`));
    assert.deepEqual(manifest.composition.uses, [`component.${kind}`]);
    assert.deepEqual(manifest.inputs.properties.size.enum, expected.sizes);
    if (expected.types) assert.deepEqual(manifest.inputs.properties.type.enum, expected.types);
    assert.equal(manifest.contracts.state_owner.const, 'native_input');
    assert.equal(manifest.accessibility.role, expected.role);
    assert.ok(manifest.contracts[`${kind}_states`].enum.includes('checked'));
    assert.ok(manifest.state.visual_states.includes('disabled'));
    assert.match(manifest.ai_guidance.use_when, /./);
  }
});

test('ui-doc documents each selection owner and its source-backed examples', {
  skip: !process.env.UI_DOC_ROOT,
}, async () => {
  const root = process.env.UI_DOC_ROOT;
  const expectations = {
    radio: ['components/radio/overview', 'components/radio/state-checked', 'components/radio/state-disabled', 'components/radio/state-error', 'components/radio/sizes', 'components/radio/types'],
    switch: ['components/switch/overview', 'components/switch/state-checked', 'components/switch/state-disabled', 'components/switch/sizes'],
    // Toggle was replaced by the switch. Its page carries the migration, not a
    // second catalogue of variants, and its one example is written in the
    // markup the migration leads to — the check below holds it to that.
    toggle: ['components/toggle/overview'],
  };

  for (const [kind, examples] of Object.entries(expectations)) {
    const markdown = await readFile(join(root, `content/ru/components/forms/${kind}.md`), 'utf8');
    assert.match(markdown, /^## (?:Пример|После переноса)$/m);
    if (kind !== 'toggle') {
      for (const heading of ['Разметка', 'Состояния', 'Доступность']) {
        assert.match(markdown, new RegExp(`^## ${heading}$`, 'm'));
      }
    }
    for (const example of examples) {
      assert.match(markdown, new RegExp(`id="${example.replace('/', '\\/')}"`));
      const html = await readFile(join(root, `examples/${example}/index.html`), 'utf8');
      assert.match(html, /<(?:input|sf-)/);
    }
  }

  // A replaced owner must not leave live markup of the component that is going
  // away: whoever copies from this page has to land on the replacement.
  const toggleExample = await readFile(join(root, 'examples/components/toggle/overview/index.html'), 'utf8');
  assert.match(toggleExample, /class="sf-switch/u, 'the migration example is written as a switch');
  assert.doesNotMatch(toggleExample, /class="[^"]*\bsf-toggle\b/u, 'no sf-toggle markup is left to copy');

  // The font tiles share their example with the plain radio; read the tile group.
  const types = await readFile(join(root, 'examples/components/radio/types/index.html'), 'utf8');
  const font = types.slice(types.indexOf('<fieldset'), types.indexOf('</fieldset>'));
  assert.match(font, /sf-radio-wrap--type-font/);
  assert.equal((font.match(/type="radio"/g) || []).length, 3);
  assert.equal((font.match(/aria-label=/g) || []).length, 3);

  for (const kind of ['switch', 'toggle']) {
    for (const example of expectations[kind]) {
      const html = await readFile(join(root, `examples/${example}/index.html`), 'utf8');
      assert.match(html, /role="switch"/);
    }
  }
});

// The Smart layer builds its size class straight from the attribute:
// `sf-switch--size-${size}`. When the ladder moved to two rungs the stylesheets
// followed and the manifests did not, so size="1/3" still passed the contract
// and produced a class no stylesheet defines — the control quietly fell back to
// its base size — while size="2", which the stylesheets do define, was refused.
// Neither side may move alone again.
test('the size a Smart element accepts is a size its stylesheet draws', async () => {
  const selectors = {
    checkbox: 'sf-checkbox',
    radio: 'sf-radio-button',
    switch: 'sf-switch',
    toggle: 'sf-toggle',
  };

  for (const [kind, prefix] of Object.entries(selectors)) {
    const styles = await source(`component/${kind}/scss/_css_${kind}.scss`)
      .catch(() => source(`component/${kind}/scss/_css__${kind}.scss`));
    const drawn = [...styles.matchAll(new RegExp(`${prefix}--size-([0-9]+(?:\\\\/[0-9]+)?)`, 'gu'))]
      .map((match) => match[1].replace('\\', ''));
    const manifest = JSON.parse(await source(`smart/${kind}/smart.manifest.json`));
    const accepted = manifest.inputs.properties.size.enum;

    assert.ok(drawn.length > 0, `${kind}: no size modifier found in the stylesheet`);
    for (const size of accepted) {
      assert.ok(
        drawn.includes(size),
        `${kind}: the manifest accepts size ${size}, which the stylesheet never draws`,
      );
    }
    for (const size of new Set(drawn)) {
      assert.ok(
        accepted.includes(size),
        `${kind}: the stylesheet draws size ${size}, which the manifest refuses`,
      );
    }
  }
});
