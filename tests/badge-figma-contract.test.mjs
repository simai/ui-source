import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';
import {withoutPublicVariables} from './support/public-variables.mjs';

const read = async (path) => withoutPublicVariables(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

async function loadContract() {
  const source = await read('src/component/badges/js/contract.js');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

test('badge contract exposes the Figma matrix and semantic extensions', async () => {
  const contract = await loadContract();

  assert.deepEqual(contract.BADGE_TYPES, ['main', 'tonal', 'outline']);
  assert.deepEqual(
    contract.BADGE_SCHEMES,
    [
      'neutral',
      'primary',
      'secondary',
      'tertiary',
      'info',
      'success',
      'warning',
      'error',
      'on-surface',
    ],
  );
  assert.deepEqual(contract.BADGE_SIZES, ['1/3', '1/2', '1']);
  // The drawn looks (C140 (4)): tonal and outline in nine colours, main only
  // with error -- 9 x 2 x 3 + 3.
  assert.equal(contract.BADGE_VARIANTS.length, 57);
  assert.deepEqual(
    [...new Set(contract.BADGE_VARIANTS.filter(({type}) => type === 'main').map(({scheme}) => scheme))],
    ['error'],
  );
  assert.equal(
    contract.BADGE_VARIANTS.some(
      ({type, scheme}) => type === 'tonal' && scheme === 'on-surface',
    ),
    true,
  );
});

test('badge CSS maps every semantic scheme to theme-aware tokens', async () => {
  const css = await read('src/component/badges/scss/_css__badges.scss');
  // The status class as the selector spells it, and the token it must paint with.
  // `error` is the canonical word; `danger` is matched beside it so old markup
  // keeps its colour, which is why that selector is an :is() pair.
  const tokenMap = {
    info: 'info',
    success: 'success',
    warning: 'warning',
    ':is\\(\\.sf-badge--error, \\.sf-badge--danger\\)': 'error',
  };

  // Drawn tonal (C140 (4)): the tonal look, main on a colour but error, no look.
  const tonal = String.raw`\.sf-badge:where\(\.sf-badge--tonal, (\.sf-badge--main:not\(\.sf-badge--error, \.sf-badge--danger\), )?:not\(\.sf-badge--main, \.sf-badge--tonal, \.sf-badge--outline\)\)`;
  for (const [scheme, token] of Object.entries(tokenMap)) {
    if (token === 'error') {
      // The one filled look: the attention count.
      assert.match(css, new RegExp(`sf-badge--main${scheme} \\{[\\s\\S]*--sf-badge--background-color: var\\(--sf-error\\);`));
    } else {
      assert.doesNotMatch(css, new RegExp(`\\.sf-badge\\.sf-badge--main\\.sf-badge--${scheme} \\{`));
    }
    assert.match(
      css,
      new RegExp(`${tonal}${scheme.startsWith(':is') ? scheme : `\\.sf-badge--${scheme}`} \\{[\\s\\S]*--sf-badge--background-color: var\\(--sf-${token}-container\\);`),
    );
    assert.match(
      css,
      new RegExp(`sf-badge--outline${scheme.startsWith(':is') ? scheme : `\\.sf-badge--${scheme}`} \\{[\\s\\S]*--sf-badge--border-color: var\\(--sf-${token}-outline\\);`),
    );
  }
});

test('badge contract normalizes invalid values and unsupported pairs', async () => {
  const {normalizeBadgeContract} = await loadContract();

  assert.deepEqual(
    normalizeBadgeContract({type: 'unknown', scheme: 'unknown', size: '99'}),
    {type: 'tonal', scheme: 'neutral', size: '1/3'},
  );
  assert.deepEqual(
    normalizeBadgeContract({type: 'tonal', scheme: 'on-surface', size: '1'}),
    {type: 'tonal', scheme: 'on-surface', size: '1'},
  );
  // main is the attention count's (C140 (4)): with any colour but error it is tonal.
  for (const scheme of ['neutral', 'primary', 'on-surface', 'info', 'success', 'warning']) {
    assert.deepEqual(normalizeBadgeContract({type: 'main', scheme, size: '1'}), {type: 'tonal', scheme, size: '1'}, scheme);
  }
  assert.deepEqual(normalizeBadgeContract({type: 'main', scheme: 'error', size: '1'}), {type: 'main', scheme: 'error', size: '1'});
});

test('badge contract takes error, and reads the former danger as error (simai/ui-source#51)', async () => {
  const {normalizeBadgeContract, canonicalBadgeScheme, BADGE_SCHEME_ALIASES, BADGE_VARIANTS} = await loadContract();

  assert.deepEqual(BADGE_SCHEME_ALIASES, {danger: 'error'});
  for (const type of ['main', 'tonal', 'outline']) {
    assert.deepEqual(normalizeBadgeContract({type, scheme: 'error', size: '1'}), {type, scheme: 'error', size: '1'});
    assert.deepEqual(normalizeBadgeContract({type, scheme: 'danger', size: '1'}), {type, scheme: 'error', size: '1'});
    assert.deepEqual(normalizeBadgeContract({type, scheme: ' Danger ', size: '1'}), {type, scheme: 'error', size: '1'});
  }
  assert.equal(canonicalBadgeScheme('danger'), 'error');
  assert.equal(canonicalBadgeScheme('error'), 'error');
  assert.equal(canonicalBadgeScheme('primary'), 'primary');
  assert.equal(canonicalBadgeScheme('critical'), '');
  assert.equal(canonicalBadgeScheme(undefined), '');
  // The error rows are where the danger rows were: main, tonal, outline.
  assert.equal(BADGE_VARIANTS.filter(({scheme}) => scheme === 'error').length, 9);
  assert.equal(BADGE_VARIANTS.some(({scheme}) => scheme === 'danger'), false);
});

test('Native badge draws the canonical status class, notes danger and hugs its text (simai/ui-source#51)', async () => {
  const [core, utilityMap, css, optionBadge] = await Promise.all([
    read('src/component/badges/js/_badges.js'),
    read('src/component/badges/json/badge.utility.json'),
    read('src/component/badges/scss/_css__badges.scss'),
    read('src/smart/helpers/option-badge.js'),
  ]);
  // Inline, as sf-badge draws it: a block-level flex root filled its container.
  const root = JSON.parse(utilityMap)['.sf-badge'];
  assert.ok(root.includes('display/inline-flex (.inline-flex)'));
  assert.ok(!root.some((value) => /\(\.flex\)/.test(value)));
  assert.match(css, /utility-hint: display\/inline-flex \(\.inline-flex\)[^\n]*\*\/\n(?:\/\*[^\n]*\*\/\n)?\.sf-badge \{/);
  // The same axes as sf-badge, and a former scheme word is noted.
  assert.match(core, /params\.appearance \?\? params\.type/);
  assert.match(core, /params\.status \|\| params\.scheme/);
  assert.match(core, /BADGE_SCHEME_ALIASES\[formerScheme\]/);
  assert.match(core, /noteDeprecated\(/);
  // A filter option coloured danger keeps its colour through the alias.
  assert.match(optionBadge, /canonicalBadgeScheme\(color\)/);
  assert.doesNotMatch(optionBadge, /BADGE_SCHEMES\.includes/);
});

test('Core and Smart renderers share the canonical classes and icon-only shape', async () => {
  const [core, utilityMap, css, smart, template] = await Promise.all([
    read('src/component/badges/js/_badges.js'),
    read('src/component/badges/json/badge.utility.json'),
    read('src/component/badges/scss/_css__badges.scss'),
    read('src/smart/badge/index.js'),
    read('src/smart/badge/js/templates/default.js'),
  ]);

  assert.match(core, /`sf-badge--\$\{type\}`/);
  assert.doesNotMatch(core, /sf-badge--type-/);
  assert.match(core, /if \(this\.textContainer\)/);
  assert.doesNotMatch(utilityMap, /flex\/1|flex-1/);
  assert.doesNotMatch(css, /utility-hint:[^\n]*flex\/1/);

  // appearance and size are made from component.json (core/js/element-manifest.js),
  // with the class contract's lists.
  const component = JSON.parse(await read('src/smart/badge/component.json'));
  assert.deepEqual(component.settings.appearance.values, ['main', 'tonal', 'outline']);
  assert.deepEqual(component.settings.size.values, ['1/3', '1/2', '1']);
  // The scheme keeps its own axis — the colour roles — and the status words it
  // used to carry now live on the status axis.
  assert.match(smart, /values: BADGE_COLOUR_ROLES/);
  assert.match(smart, /values: BADGE_STATUSES/);
  assert.match(smart, /BADGE_SIZES/);
  assert.match(smart, /normalizeBadgeContract\(props\)/);
  assert.match(template, /hasTextContent/);
  assert.match(template, /: nothing/);
});

test('Badge documentation records the matrix, semantic extension and official dark variant', async () => {
  const docs = await read('src/smart/badge/docs/docs.md');

  // C140 (4): main is the attention count alone; the dark main on-surface badge is retired.
  assert.match(docs, /57 combinations are drawn/);
  assert.match(docs, /`main` with `error` alone, the attention count/);
  assert.match(docs, /`tonal \+ on-surface` draws the grey tonal badge/);
  assert.doesNotMatch(docs, /appearance="main" scheme="on-surface"/);
});
