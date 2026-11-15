import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

// One threshold ladder (owner decision C181 (2), 2026-11-14; ui-control
// control/research/2026-11-14-standards-tokens-utilities.md, demo
// prototypes/foundation-names-demo.html). A component adapts to the width of
// its own place with @container, at a step of the ladder in
// src/core/scss/vars/_sf_var__breakpoint.scss ($container-step-array), written
// container-step(<step>) -- never a length of its own. A query on the screen's
// width is for the page frame, and for the size system's one density
// breakpoint (lg, 60rem: tests/ladder-one-breakpoint.contract.test.mjs).
//
// Components that still adapt to the screen at a breakpoint of the ladder are
// listed in SCREEN_QUERIES with the reason; the list only shrinks: a new
// screen query in a component fails here. A container condition cannot style
// the container itself, so moving one of them needs an inner element to be the
// container -- a change of markup, its own task.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const files = (dir) => !existsSync(join(root, dir)) ? [] : readdirSync(join(root, dir)).flatMap((name) => {
  const path = join(dir, name);
  return statSync(join(root, path)).isDirectory() ? files(path) : /\.(s?css)$/u.test(name) ? [path] : [];
});
const uncomment = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, (block) => block.replace(/[^\n]/gu, ' ')).replace(/(^|[^:])\/\/.*$/gmu, '$1');
const LENGTH = /\d*\.?\d+(?:rem|px|em|ch|vw|vh|cqi|cqw)\b/u;

// The size scale's steps, read from the Sass source (rem).
const sizeSource = read('src/core/scss/vars/_sf_var__size.scss');
const sizeStep = (range, step) => {
  const block = sizeSource.match(new RegExp(`\\b${range}: \\(([\\s\\S]*?)\\)`, 'u'))[1];
  return Number(block.match(new RegExp(`\\b${step}: ([0-9.]+)rem`, 'u'))[1]);
};

const breakpointSource = read('src/core/scss/vars/_sf_var__breakpoint.scss');
const LADDER = Object.fromEntries([...breakpointSource.match(/\$container-step-array: \(([\s\S]*?)\n\);/u)[1]
  .matchAll(/^\s*([a-i]\d): map\.get\(size\.\$size-array, ([a-i]), (\d)\)/gmu)]
  .map(([, name, range, step]) => {
    assert.equal(name, `${range}${step}`, `container step ${name} names the size step it reads`);
    return [name, sizeStep(range, step)];
  }));
const SCREEN = Object.fromEntries([...breakpointSource.match(/\$breakpoint-array: \(([\s\S]*?)\);/u)[1]
  .matchAll(/^\s*(\w+): ([0-9.]+)(?:rem)?,/gmu)].map(([, name, value]) => [name, Number(value)]));
const DENSITY = SCREEN.lg;

// Components adapting to the screen, at a step of the breakpoint ladder, and why.
const SCREEN_QUERIES = {
  // The page frame.
  'src/smart/header-site': 'page frame: the row\'s gutter and centring line up with the page column (.container) at each window step; the collapse itself is a container step of the bar (C104, C181 (2))',
  'src/smart/alert-bar': 'page frame: a site bar lines up with the page column (.container) at each window step',
  'src/smart/contents': 'page frame: below md the open list is a bottom sheet of the screen',
  'src/component/modal': 'page frame: below md a window is a sheet of the screen',
  'src/smart/wizard': 'page frame (group build 6, to confirm): below sm the wizard\'s window or side panel is the whole screen (C159 (2), C157 (4), C179 (4)) and its footer stays at the screen\'s bottom',
  'src/smart/drawer': 'page frame: below md a side panel is the whole screen (C157 (4)), below sm its foot\'s buttons share the row (C157 (3))',
  'src/smart/confirm': 'a dialog on a narrow screen; containing its inline size would collapse a card as wide as its content',
  'src/smart/confirm-change': 'a dialog on a narrow screen; containing its inline size would collapse a card as wide as its content',
  'src/smart/list-description': 'owner decision C180 (3): on a phone (below md, sf-drawer\'s whole-screen panel) a label is always over its value; a phone\'s list is wider than a 24rem panel\'s, so no container step tells them apart',
  // Not moved to @container yet (C181 follow-up, 2026-11-14: pagination, pager,
  // progress-run and search moved; these three wait for a choice).
  'src/component/reference-link': 'to move: the card stacks below sm and the rule styles the card itself; class markup has no element around the card to be the container',
  'src/component/admin-menu': 'page frame (to confirm): below sm the panel fills a phone screen; the root stands in the application shell, where a contained root would collapse',
  'src/component/download-file': 'to move: the card is as wide as its text (C51), so it cannot be its own container; the narrow form follows a place the card does not own',
};
// Container conditions that are a page frame of their own: the workspace's
// author-chosen split and wide steps (classes on the size scale), and the cq-*
// utilities, which read the breakpoint array.
const FRAME_CONTAINERS = new Set(['src/core/scss/_sf_css__composition.scss', 'src/utility/query-layout/default/scss/index.scss']);

// A plain CSS template has no Sass, so it cannot call container-step(); the
// one condition such a file may write is listed here with its reason, exactly
// (group build 6, dispatcher decision: a lint exception, not a redesign).
const PLAIN_CSS_CONDITIONS = {
  'src/smart/list/js/templates/default.css': {
    prelude: 'sf-list (inline-size < 20rem)',
    reason: 'sf-list 1.14.0 (fix/first-paint-fp): the narrow list of C47 by a container query on the frame, so a printed first paint is narrow before any script; 20rem is the size step g0 written out, the template is plain CSS',
  },
};

const owner = (file) => file.split('/').slice(0, 3).join('/');
const sources = () => ['src/component', 'src/smart', 'src/core/scss', 'src/core/figma_variables', 'src/utility'].flatMap(files);

test('C181: every container step is a step of the size scale, in increasing order, and holds the screen breakpoints', () => {
  const values = Object.values(LADDER);
  assert.ok(values.length >= 5, 'the ladder is read from the source');
  assert.deepEqual(values, [...values].sort((a, b) => a - b));
  assert.deepEqual(Object.keys(LADDER), ['g0', 'g2', 'g5', 'g6', 'g8', 'h0', 'h1', 'h2', 'h5', 'h8']);
  for (const name of ['sm', 'md', 'lg', 'xl']) assert.ok(values.includes(SCREEN[name]), `screen breakpoint ${name} is a container step`);
  // The cq-* utilities read those breakpoints as container conditions.
  const profile = JSON.parse(read('src/core/contracts/container-conditions.v1.json'));
  for (const name of profile.breakpoints) assert.ok(values.includes(SCREEN[name]), `cq-${name} is a container step`);
});

test('C181: container-step() is the one way to a step and refuses a length that is not on the ladder', () => {
  const mixins = read('src/core/scss/mix/_mix__breakpoint.scss');
  assert.match(mixins, /@function container-step\(\$step, \$frame: 0rem\)/u);
  assert.match(mixins, /@error "Container step `#\{\$step\}` is not on the ladder/u);
});

// A prelude runs to the first brace that is not an interpolation's.
const PRELUDE = '((?:#\\{[^}]*\\}|[^{;])*)\\{';
const preludes = (source, rule) => [...source.matchAll(new RegExp(`@${rule}${PRELUDE}`, 'gu'))].map(([, prelude]) => prelude.trim());
const literal = (prelude) => prelude.replace(/#\{[^}]*\}/gu, '');
// The density breakpoint, in any of the forms the sources write it.
const isDensity = (prelude) => {
  const rest = prelude.replace(/#\{\s*bp\.\$breakpoint-desktop\s*\}|bp\.\$breakpoint-desktop|\$breakpoint-desktop/gu, 'DENSITY')
    .replace(new RegExp(`\\b${DENSITY}rem\\b`, 'gu'), 'DENSITY');
  return /DENSITY/u.test(rest) && !LENGTH.test(rest) && !/\$|#\{/u.test(rest);
};
const SCREEN_MIXIN = /@include\s+(?:[\w-]+\.)?(?:breakpoint-media|media-breakpoint-(?:up|down|between|only))\(\s*([^)]*)\)|@include\s+(?:[\w-]+\.)?breakpoint-device-media\(\s*([^)]*)\)/gu;

test('C181: no @container condition in the sources writes a length of its own', () => {
  const offenders = [];
  let seen = 0;
  for (const file of sources()) {
    for (const prelude of preludes(uncomment(read(file)), 'container')) {
      seen += 1;
      if (PLAIN_CSS_CONDITIONS[file]?.prelude === prelude) continue;
      if (LENGTH.test(literal(prelude))) offenders.push(`${file}: @container ${prelude}`);
      else if (!/container-step\(/u.test(prelude) && !FRAME_CONTAINERS.has(file)) offenders.push(`${file}: @container ${prelude} (not container-step())`);
    }
  }
  assert.ok(seen > 10, 'the sources hold container conditions');
  assert.deepEqual(offenders, []);
});

const screenQueries = (file) => {
  const source = uncomment(read(file));
  const found = [];
  for (const prelude of preludes(source, 'media')) {
    if (!/width|breakpoint|\$|#\{/u.test(prelude) || isDensity(prelude)) continue;
    found.push(`@media ${prelude}`);
  }
  for (const [match, screen, device] of source.matchAll(SCREEN_MIXIN)) {
    if (device !== undefined && /^\s*desktop\s*(?:,|$)/u.test(device)) continue; // the density breakpoint
    if (screen !== undefined && /^\s*xs\s*$/u.test(screen)) continue; // no query at all
    found.push(match);
  }
  return found;
};

test('C181: a component queries the screen only at a breakpoint, and only from the listed page frame', () => {
  const offenders = [];
  for (const file of ['src/component', 'src/smart'].flatMap(files)) {
    for (const query of screenQueries(file)) {
      const lengths = [...literal(query).matchAll(/(\d*\.?\d+)rem\b/gu)].map(([, value]) => Number(value));
      if (LENGTH.test(literal(query).replace(/(\d*\.?\d+)rem\b/gu, ''))) offenders.push(`${file}: ${query} (a length outside rem)`);
      for (const value of lengths) if (!Object.values(SCREEN).includes(value)) offenders.push(`${file}: ${query} (${value}rem is no breakpoint)`);
      if (!SCREEN_QUERIES[owner(file)]) offenders.push(`${file}: ${query} (a component adapts with @container; the screen is for the page frame)`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('C181: the screen-query list names only components that still query the screen', () => {
  const stale = Object.keys(SCREEN_QUERIES).filter((dir) => !files(dir).some((file) => screenQueries(file).length));
  assert.deepEqual(stale, []);
});

// The built sheets, when the gate names the build: UI_CORE_ROOT=<ui root> (a
// distr/ beside). Without it the test is skipped -- the published pair is not
// the candidate.
const distribution = process.env.UI_CORE_ROOT ? resolve(process.env.UI_CORE_ROOT, 'distr') : null;
const builtSheets = (dir) => !existsSync(dir) ? [] : readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? builtSheets(path) : name.endsWith('.css') && !name.endsWith('.min.css') ? [path] : [];
});
// A component whose step is its whole width takes its frame off (two inline
// insets of --sf-space-1, 1rem): sf-alert and sf-toast.
const FRAMED = {'sf-alert': 2, 'sf-toast': 2};
const PAGE_FRAME_CONTAINERS = new Set(['sf-workspace']);

test('C181: every container condition the build ships is a step of the ladder', {skip: distribution ? false : 'UI_CORE_ROOT names no build'}, () => {
  const steps = Object.values(LADDER);
  const offenders = [];
  let seen = 0;
  for (const dir of ['core', 'component', 'smart']) for (const file of builtSheets(join(distribution, dir))) {
    for (const [, prelude] of readFileSync(file, 'utf8').matchAll(/@container([^{]*)\{/gu)) {
      const name = prelude.trim().match(/^([a-z][\w-]*)\s/u)?.[1];
      if (PAGE_FRAME_CONTAINERS.has(name)) continue;
      for (const [, value] of prelude.matchAll(/(\d*\.?\d+)rem\b/gu)) {
        seen += 1;
        const ok = steps.includes(Number(value)) || (FRAMED[name] && steps.includes(Number(value) + FRAMED[name]));
        if (!ok) offenders.push(`${relative(distribution, file)}: @container${prelude.trimEnd()}`);
      }
    }
  }
  assert.ok(seen > 10, 'the build ships container conditions');
  assert.deepEqual([...new Set(offenders)], []);
});

test('C181: every screen query the build ships in a component is a breakpoint, from a listed unit', {skip: distribution ? false : 'UI_CORE_ROOT names no build'}, () => {
  const screen = Object.values(SCREEN).filter(Boolean);
  // PostCSS writes a range below a breakpoint as max-width a thousandth under it.
  const isBreakpoint = (value) => screen.some((step) => Math.abs(step - value) < 0.0015);
  const offenders = [];
  for (const dir of ['component', 'smart']) for (const file of builtSheets(join(distribution, dir))) {
    const unit = relative(distribution, file).split('/').slice(0, 2).join('/');
    for (const [, prelude] of readFileSync(file, 'utf8').matchAll(/@media([^{]*)\{/gu)) {
      const values = [...prelude.matchAll(/(\d*\.?\d+)rem\b/gu)].map(([, value]) => Number(value));
      if (!values.length || values.every((value) => value === DENSITY)) continue;
      if (!values.every(isBreakpoint) || !SCREEN_QUERIES[`src/${unit}`]) offenders.push(`${unit}: @media${prelude.trimEnd()}`);
    }
  }
  assert.deepEqual([...new Set(offenders)], []);
});
