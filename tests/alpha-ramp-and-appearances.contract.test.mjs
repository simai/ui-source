import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {withoutPublicVariables} from './support/public-variables.mjs';

// The neutral alpha ramp is one base per theme and a ladder of steps derived from
// it, so a component asks for a degree of contrast instead of choosing black or
// white per theme. The surface and ghost appearances are its consumers: if they
// ever hardcode a colour, the ramp stops being the single source.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => withoutPublicVariables(readFileSync(resolve(root, path), 'utf8'));
// The steps the neutral half of the alpha scale carries. It had 2 and 6, which
// are off the scale's footing of fours, and 20 and 24, which were on it and
// asked for by nothing; both pairs went on 2026-10-08 when the scale was
// written down. tests/alpha-scale.contract.test.mjs holds the scale itself.
const steps = [4, 8, 12, 16];

// The three families that carry the appearances. Each names the selector fragment
// that marks an appearance rule, and how that family draws its boundary: the
// button and the icon button have a border, the tag is built with `border: 0` and
// draws an inset shadow instead so a tag never grows taller than its neighbour.
const families = [
  {
    name: 'button',
    css: 'src/component/buttons/scss/_css__buttons.scss',
    mark: /--(?:surface|ghost)\b/u,
    fill: '--sf-button--background-color',
    boundary: (step) => new RegExp(`--sf-button--border-color: var\\(--sf-alpha-${step}\\)`, 'u'),
    interactive: true,
  },
  {
    name: 'icon button',
    css: 'src/component/icon-buttons/scss/_css_icon_buttons.scss',
    mark: /--(?:surface|ghost)\b/u,
    fill: '--sf-icon-button--background-color',
    boundary: (step) => new RegExp(`--sf-icon-button--border-color: var\\(--sf-alpha-${step}\\)`, 'u'),
    interactive: true,
  },
  {
    name: 'tag',
    css: 'src/component/tags/scss/_css__tags.scss',
    mark: /--appearance-(?:surface|ghost)\b/u,
    fill: '--sf-tag--background-color',
    boundary: (step) => new RegExp(`--sf-tag--box-shadow: inset 0 0 0 var\\(--sf-px\\) var\\(--sf-alpha-${step}\\)`, 'u'),
    interactive: false,
  },
];

// The files are flat CSS inside @layer blocks, so one pass over `selector { body }`
// is enough to collect the rules an appearance owns.
const appearanceRules = (family) => {
  const css = read(family.css);
  const rules = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
    const selector = match[1].trim();
    if (!family.mark.test(selector)) continue;
    rules.push({selector, body: match[2]});
  }
  return rules;
};

test('the ramp has one base with a branch per theme, and steps derived from it', () => {
  const theme = read('src/core/scss/_sf_css__theme.scss');

  // The base is declared once. light-dark() picks the branch from the color-scheme
  // the theme class sets, so the two themes cannot drift apart: ink on a light
  // surface, light on a dark one.
  assert.match(
    theme,
    /--sf-alpha-base: light-dark\(var\(--sf-black\), var\(--sf-white\)\);/u,
    'the base carries both themes in one declaration',
  );

  for (const step of steps) {
    const declaration = new RegExp(
      `--sf-alpha-${step}: color-mix\\(in srgb, var\\(--sf-transparent\\), var\\(--sf-alpha-base\\) ${step}%\\);`,
      'gu',
    );
    assert.equal(
      (theme.match(declaration) || []).length,
      1,
      `step ${step} is derived from the base once, for both themes`,
    );
  }
});

test('the theme declares each token once, and the schemes carry nothing but the scheme', () => {
  const theme = read('src/core/scss/_sf_css__theme.scss');

  // The theme classes exist to set color-scheme; that is what light-dark() reads.
  // Anything else declared there would apply to one theme only and reintroduce
  // the two lists this file was merged to remove.
  for (const [scheme, block] of [
    ['light', /\.theme-light \{([^}]*)\}/u],
    ['dark', /\.theme-dark \{([^}]*)\}/u],
  ]) {
    const match = theme.match(block);
    assert.ok(match, `the .theme-${scheme} block is declared`);
    assert.equal(
      match[1].trim(),
      `color-scheme: ${scheme};`,
      `.theme-${scheme} sets the scheme and nothing else`,
    );
  }

  const names = [...theme.matchAll(/^\s*(--[a-z0-9-]+):/gmu)].map(([, name]) => name);
  const seen = new Set();
  const twice = names.filter((name) => (seen.has(name) ? true : (seen.add(name), false)));
  assert.deepEqual(twice, [], 'no token is declared twice');
  assert.ok(names.length > 100, 'the whole semantic layer is here');

  // A token whose value names a `-40`-family primitive in one theme and an `-80`
  // one in the other must route through light-dark, not through a second block.
  const pairedDeclarations = [...theme.matchAll(/^\s*--[a-z0-9-]+: light-dark\(/gmu)];
  assert.ok(
    pairedDeclarations.length > 100,
    'the tokens that differ between the themes are paired, not duplicated',
  );
});

test('no token hides a colour inside var(), where it can never resolve', () => {
  // `var(#00000080)` parses as a custom-property reference with an impossible
  // name, so the declaration is invalid and the token silently has no value.
  // Three focus tokens were written that way and resolved to nothing in both
  // themes; a plain colour is what was meant.
  const theme = read('src/core/scss/_sf_css__theme.scss');
  const hidden = [...theme.matchAll(/^\s*(--[a-z0-9-]+):.*var\(#/gmu)].map(([, name]) => name);
  assert.deepEqual(hidden, [], 'a colour belongs in the value, not inside var()');
});

test('the ramp rises: every step is steeper than the one before it', () => {
  const sorted = [...steps].sort((a, b) => a - b);
  assert.deepEqual(steps, sorted, 'the ladder is declared in order');
  assert.equal(new Set(steps).size, steps.length, 'no step is declared twice');
});

test('every appearance rule reads the ramp and nothing else', () => {
  for (const family of families) {
    const rules = appearanceRules(family);
    assert.ok(rules.length > 0, `${family.name}: the appearances are declared`);
    for (const {selector, body} of rules) {
      assert.doesNotMatch(
        body,
        /rgba?\(|#[0-9a-fA-F]{3,8}\b/u,
        `${family.name}: a hardcoded colour in ${selector} would put it outside the ramp`,
      );
      for (const [, step] of body.matchAll(/--sf-alpha-(\d+)/gu)) {
        assert.ok(steps.includes(Number(step)), `${family.name}: --sf-alpha-${step} is not a step of the ramp`);
      }
    }
  }
});

test('ghost carries nothing at rest and surface carries a fill and a boundary', () => {
  for (const family of families) {
    const rules = appearanceRules(family);
    const rest = rules.filter(({selector}) => !/:hover|:active|\.active|:disabled|\.disabled|:focus/u.test(selector));
    const restText = rest.map(({body}) => body).join('\n');

    assert.match(
      restText,
      new RegExp(`${family.fill}: transparent`, 'u'),
      `${family.name}: ghost starts from nothing`,
    );
    assert.match(
      restText,
      new RegExp(`${family.fill}: var\\(--sf-alpha-4\\)`, 'u'),
      `${family.name}: surface has a faint fill`,
    );
    assert.match(restText, family.boundary(8), `${family.name}: and a boundary one step stronger`);
  }
});

test('the states rise through the ramp', () => {
  for (const family of families) {
    const rules = appearanceRules(family);
    const at = (pattern) => rules
      .filter(({selector}) => pattern.test(selector))
      .map(({body}) => body)
      .join('\n');

    assert.match(
      at(/:hover/u),
      new RegExp(`${family.fill}: var\\(--sf-alpha-8\\)`, 'u'),
      `${family.name}: hover is one step up from rest`,
    );
    assert.match(at(/:hover/u), family.boundary(12), `${family.name}: and the boundary rises with it`);

    if (family.interactive) {
      assert.match(
        at(/:active|\.active/u),
        new RegExp(`${family.fill}: var\\(--sf-alpha-12\\)`, 'u'),
        `${family.name}: pressed is another step up`,
      );
      assert.match(at(/:active|\.active/u), family.boundary(16), `${family.name}: and so is the boundary`);
    }

    const disabled = at(/:disabled|\.disabled/u);
    assert.match(
      disabled,
      new RegExp(`${family.fill}: transparent`, 'u'),
      `${family.name}: a disabled appearance carries no fill`,
    );
  }
});

test('a status tag keeps its colour: the appearance is only for the neutral types', () => {
  for (const {selector} of appearanceRules(families[2])) {
    for (const status of ['success', 'error', 'warning']) {
      assert.ok(
        !selector.includes(`sf-tag--${status}`),
        `an appearance must not reach ${status}, whose colour is its meaning`,
      );
    }
  }
  // And the neutral types are named, so a new type does not silently inherit one.
  const neutral = appearanceRules(families[2])
    .filter(({selector}) => !/:hover|:active|\.active|:disabled|\.disabled/u.test(selector));
  for (const {selector} of neutral) {
    assert.match(selector, /sf-tag--default/u, 'the neutral types are listed explicitly');
  }
});

test('the appearances are part of the public API, and documented', () => {
  // The manifests are generated from meta.mjs, so the enum has one source. If the
  // two ever drift, Studio and the runtime would disagree about what exists.
  const enumOf = (meta, name) => {
    const declared = read(meta).match(new RegExp(`const ${name} = \\[([^\\]]+)\\]`, 'u'))?.[1] ?? '';
    return [...declared.matchAll(/'([^']+)'/gu)].map(([, value]) => value);
  };

  for (const [component, constant] of [['button', 'BUTTON_APPEARANCE_VALUES'], ['icon-button', 'ICON_BUTTON_APPEARANCE_VALUES']]) {
    const manifest = JSON.parse(read(`src/smart/${component}/smart.manifest.json`));
    // The axis is `appearance`; `type` still mirrors it, which the axes rule checks.
    assert.deepEqual(
      manifest.inputs.properties.appearance.enum,
      ['default', 'tonal', 'outline', 'link', 'surface', 'ghost'],
      `${component}: the list stays closed and carries the two appearances`,
    );
    assert.deepEqual(enumOf(`src/smart/${component}/meta.mjs`, constant), manifest.inputs.properties.appearance.enum);
    const docs = read(`src/smart/${component}/docs/docs.md`);
    assert.match(docs, /surface\|ghost/u, `${component}: the type list names them`);
    assert.match(docs, /alpha ramp/u, `${component}: and says what they are built on`);
  }

  // On a tag the appearance is its own axis, because `type` there says what the
  // tag carries or reports, not how it looks.
  const tag = JSON.parse(read('src/smart/tags/smart.manifest.json'));
  assert.deepEqual(tag.inputs.properties.appearance.enum, ['default', 'surface', 'ghost']);
  assert.ok(
    !tag.inputs.properties.type.enum.includes('surface'),
    'the tag type stays what it was: an appearance is not a content shape',
  );
  const runtime = read('src/smart/tags/index.js');
  assert.match(runtime, /getEnumAttr\('appearance', \['default', 'surface', 'ghost'\], 'default'\)/u);
  const template = read('src/smart/tags/js/templates/default.js');
  assert.match(template, /sf-tag--appearance-\$\{context\.appearance\}/u, 'and it reaches the class list');
  const docs = read('src/smart/tags/docs/docs.md');
  assert.match(docs, /appearance="default\|surface\|ghost"/u);
  assert.match(docs, /alpha ramp/u);
});

test('every size dresses the new appearances too', () => {
  const buttons = read('src/component/buttons/scss/_css__buttons.scss');
  for (const size of ['1', '2', '3', '1\\/2', '1\\/3']) {
    assert.ok(
      buttons.includes(`.sf-button.sf-button--size-${size}.sf-button--surface .sf-button-text-container`),
      `size ${size} would otherwise leave surface text unsized`,
    );
    // Ghost now reads as link, so it is sized wherever link is.
    assert.ok(
      buttons.includes(`.sf-button.sf-button--size-${size}:is(.sf-button--link, .sf-button--ghost).sf-button--primary .sf-button-text-container`),
      `size ${size} would otherwise leave ghost text unsized`,
    );
  }
});
