import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// The Framework grew three different meanings under the word `type`: how a
// control looks, what it reports, and what it carries. A developer could not tell
// from the name which one a component meant. contracts/public-api-axes.json fixes
// one name per question and records every legacy name that still works; this rule
// keeps the code and that record from drifting apart.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const map = json('contracts/public-api-axes.json');

// Words that betray what an axis really is, whatever it is called.
const APPEARANCE_WORDS = ['tonal', 'outline', 'outlined', 'link', 'surface', 'ghost', 'filled', 'bordered', 'flat'];
const STATUS_WORDS = ['success', 'warning', 'error', 'danger', 'info', 'critical'];

// The component directories, read once.
const components = readdirSync(resolve(root, 'src/smart'), {withFileTypes: true})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => existsSync(resolve(root, `src/smart/${name}/smart.manifest.json`)))
  .sort();
const properties = (name) => json(`src/smart/${name}/smart.manifest.json`).inputs?.properties ?? {};

test('the axes are three, and the status vocabulary is one list', () => {
  assert.deepEqual(Object.keys(map.axes), ['appearance', 'status', 'kind']);
  assert.deepEqual(map.status_vocabulary, ['success', 'warning', 'error', 'info', 'neutral']);
  for (const [alias, canonical] of Object.entries(map.status_aliases)) {
    assert.ok(map.status_vocabulary.includes(canonical), `${alias} points at a word of the vocabulary`);
    assert.ok(!map.status_vocabulary.includes(alias), `${alias} is not itself part of the vocabulary`);
  }
  for (const entry of map.components) {
    assert.ok(Object.keys(map.axes).includes(entry.axis), `${entry.component}: ${entry.axis} is one of the axes`);
    assert.ok(['converted', 'pending', 'canonical_from_the_start'].includes(entry.state), `${entry.component}: a known state`);
  }
});

test('a converted component carries the canonical name, and the legacy name still answers', () => {
  for (const entry of map.components.filter(({state}) => state === 'converted')) {
    const declared = properties(entry.component);
    assert.ok(declared[entry.axis], `${entry.component}: the manifest declares ${entry.axis}`);
    for (const legacy of entry.legacy) {
      assert.ok(declared[legacy], `${entry.component}: ${legacy} is still declared, so a consumer does not break`);
      // A legacy name that answered two questions from one list — a split rather
      // than a rename — offers the union of the axes it routes to. The empty
      // string is how an axis says "nothing reported", and no legacy list has it.
      if (entry.legacy_input_remains_its_own_axis) {
        // The legacy name is not retired: it is another axis that also answers
        // this one's words. It must not offer them as choices, or the two axes
        // would compete for the same value.
        for (const value of declared[entry.axis].enum.filter(Boolean)) {
          assert.ok(
            !declared[legacy].enum.includes(value),
            `${entry.component}: ${legacy} answers ${value} but must not offer it`,
          );
        }
      } else {
        const routes = map.components
          .filter((other) => other.component === entry.component && other.legacy.includes(legacy))
          .map((other) => other.axis);
        const offered = [...new Set(routes.flatMap((axis) => declared[axis]?.enum ?? []))].filter(Boolean);
        assert.deepEqual(
          [...declared[legacy].enum].filter(Boolean).sort(),
          offered.sort(),
          routes.length > 1
            ? `${entry.component}: ${legacy} offers what ${routes.join(' and ')} offer together`
            : `${entry.component}: ${legacy} offers exactly what ${entry.axis} offers`,
        );
      }
      assert.match(
        declared[legacy].description,
        entry.legacy_input_remains_its_own_axis ? /still works|still accepted|reaches the [a-z]+ axis/u : /[Ll]egacy name/u,
        entry.legacy_input_remains_its_own_axis
          ? `${entry.component}: ${legacy} says that this axis's words still work there`
          : `${entry.component}: ${legacy} says it is the legacy name`,
      );
    }
    const runtime = read(`src/smart/${entry.component}/index.js`);
    // Either the prop names the legacy attribute it answers to, or — when one
    // legacy name routes to several axes — it resolves that name itself, which a
    // plain alias cannot do because the same word means different things.
    const declaresAlias = new RegExp(
      `${entry.axis}: \\{[\\s\\S]{0,320}?aliases: \\[${entry.legacy.map((l) => `'${l}'|"${l}"`).join('|')}\\]`,
      'u',
    ).test(runtime);
    const resolvesItself = new RegExp(
      `${entry.axis}: \\{[\\s\\S]{0,320}?parser:`,
      'u',
    ).test(runtime) && entry.legacy.every((legacy) => runtime.includes(`getAttribute?.('${legacy}')`));
    // Standard 1.3.8 §16.20: a component built from its component.json keeps
    // the legacy name as a dated setting alias in aliases.json, which the
    // shim maps to the axis (attribute and property).
    const aliasFile = resolve(root, `src/smart/${entry.component}/aliases.json`);
    const datedAlias = existsSync(aliasFile) && entry.legacy.every((legacy) => (JSON.parse(read(`src/smart/${entry.component}/aliases.json`)).aliases ?? [])
      .some((row) => row.kind === 'setting' && row.from === legacy && row.to === entry.axis && row.remove_after));
    assert.ok(
      declaresAlias || resolvesItself || datedAlias,
      `${entry.component}: the runtime prop must answer to ${entry.legacy.join(', ')}, by alias or by resolving it`,
    );
    // A renamed value is only non-breaking if the old word is still accepted.
    for (const [canonical, words] of Object.entries(entry.value_legacy ?? {})) {
      assert.ok(
        declared[entry.axis].enum.includes(canonical),
        `${entry.component}: ${canonical} is offered`,
      );
      for (const word of words) {
        assert.ok(
          !declared[entry.axis].enum.includes(word),
          `${entry.component}: ${word} is answered but no longer offered as a choice`,
        );
        assert.ok(
          runtime.includes(`'${word}'`),
          `${entry.component}: the runtime still accepts ${word}`,
        );
        // In the prop config, not only in a getter: the template reads the props
        // context, so a legacy word normalised in a getter alone would still
        // reach the class list as the default. A prop that resolves the legacy
        // name itself does that work in its parser instead.
        const aliasedInConfig = new RegExp(
          `${entry.axis}: \\{[\\s\\S]{0,320}?valueAliases: \\{[^}]*'${word}'`,
          'u',
        ).test(runtime);
        const resolvedInParser = new RegExp(`${entry.axis}: \\{[\\s\\S]{0,320}?parser:`, 'u').test(runtime)
          && runtime.includes(`'${word}'`);
        assert.ok(
          aliasedInConfig || resolvedInParser,
          `${entry.component}: ${word} must be answered by the prop, aliased or resolved`,
        );
      }
    }
    if (entry.axis === 'status') {
      // The empty string is how a component says it reports nothing; every other
      // value is a word of the shared vocabulary.
      for (const value of declared[entry.axis].enum.filter(Boolean)) {
        assert.ok(
          map.status_vocabulary.includes(value),
          `${entry.component}: ${value} is part of the shared status vocabulary`,
        );
      }
    }
  }
});

test('nothing calls an appearance or a status `type` without being recorded', () => {
  const recorded = new Set(map.components.map(({component, legacy}) => legacy.map((name) => `${component}.${name}`)).flat());
  // A property may be exempt, but only in writing and with a reason.
  for (const exemption of map.exempt_properties ?? []) {
    assert.ok(exemption.reason?.length > 20, `${exemption.component}.${exemption.property}: an exemption says why`);
    recorded.add(`${exemption.component}.${exemption.property}`);
  }
  for (const name of components) {
    for (const [property, definition] of Object.entries(properties(name))) {
      if (Object.keys(map.axes).includes(property)) continue;
      const values = definition.enum ?? [];
      const looksLikeAppearance = values.some((value) => APPEARANCE_WORDS.includes(value));
      const looksLikeStatus = values.some((value) => STATUS_WORDS.includes(value));
      if (!looksLikeAppearance && !looksLikeStatus) continue;
      assert.ok(
        recorded.has(`${name}.${property}`),
        `${name}.${property} answers an axis question but is not in contracts/public-api-axes.json — name it ${looksLikeAppearance ? 'appearance' : 'status'} and record the legacy name`,
      );
    }
  }
});

test('a size speaks the shared ladder, and the words it replaced still work', () => {
  const ladder = map.size_ladder;
  assert.ok(ladder.steps.includes('1'), 'the ladder has a middle');
  for (const entry of ladder.value_aliases.filter(({state}) => state === 'converted')) {
    const declared = properties(entry.component)[entry.axis];
    assert.ok(declared, `${entry.component}: ${entry.axis} is declared`);
    for (const [canonical, legacy] of Object.entries(entry.legacy)) {
      assert.ok(
        ladder.steps.includes(canonical) || canonical === 'full',
        `${entry.component}: ${canonical} is a step of the ladder`,
      );
      assert.ok(
        declared.enum.includes(canonical),
        `${entry.component}: the canonical value ${canonical} is offered`,
      );
      assert.ok(
        !declared.enum.includes(legacy),
        `${entry.component}: ${legacy} is answered but no longer offered as a choice`,
      );
    }
    const runtime = read(`src/smart/${entry.component}/index.js`);
    assert.match(runtime, /valueAliases: \{/u, `${entry.component}: the runtime still answers to the old words`);
  }
});

test('the base honours a legacy name, and the canonical one wins', () => {
  const base = read('src/core/js/smart-base.js');
  assert.match(base, /resolveAttributeName\(\{attribute = "", aliases = \[\]\} = \{\}\)/u, 'one place decides');
  assert.match(base, /if \(attribute && this\.hasAttribute\(attribute\)\) \{\s*return attribute;/u, 'the canonical name wins');
  assert.match(base, /\.\.\.normalized\.aliases/u, 'a change to a legacy name still re-renders');
  assert.match(
    base,
    // The fifth argument notes a legacy value in SF.deprecations (change lifecycle).
    /export function normalizeEnum\(value, allowed, fallback, valueAliases = null, onLegacy = null\)/u,
    'and a value can be renamed the same way',
  );
});

test('a status word outside the vocabulary is not introduced quietly', () => {
  const allowed = new Set([...map.status_vocabulary, ...Object.keys(map.status_aliases)]);
  for (const name of components) {
    for (const [property, definition] of Object.entries(properties(name))) {
      for (const value of definition.enum ?? []) {
        if (!STATUS_WORDS.includes(value)) continue;
        assert.ok(allowed.has(value), `${name}.${property}: ${value} is not in the status vocabulary or its aliases`);
      }
    }
  }
});
