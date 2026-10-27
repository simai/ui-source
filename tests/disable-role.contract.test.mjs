import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Two roles, one for each side of a disabled control:
//
//   --sf-disable      12% of a neutral — a wash, meant to replace a fill
//   --sf-on-disable   80% light / 48% dark — the content that sits on it
//
// Most of the set reads them that way: sixty-odd declarations paint content with
// --sf-on-disable and twenty paint a fill with --sf-disable. Thirteen had them
// swapped — the checkbox, the radio, the switch and the toggle painted their
// label, their description and their glyph with the 12% wash. Measured on the
// served runtime, a disabled checkbox label came out at 1.15:1 against the light
// page and 1.31:1 against the dark one: ink at twelve per cent opacity is not
// dimmed text, it is an absent one.
//
// WCAG exempts a disabled control from 1.4.3 and 1.4.11, so neither number is a
// conformance failure. The contract is about the roles meaning what they say.
//
// The light branch of --sf-on-disable was 24% until the owner raised it, first
// to the top of the alpha scale and then past it. At 24% the label measured
// 1.34:1 while the dark branch measured 4.12:1, and the gap hid more than the
// state: a locked ticked box showed its tick at 1.31:1, so the light theme
// concealed the value and not only the affordance. 44% only reached 1.76:1 --
// still a ghost beside the dark theme -- because neutral-50 over white tops out
// at 4.47:1 even at full opacity. 80% lands at 3.10:1, which is where the dark
// theme has always been.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const styleFiles = () => {
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) { walk(path); continue; }
      if (entry.name.endsWith('.scss') || entry.name.endsWith('.css')) found.push(path);
    }
  };
  walk('src/component');
  walk('src/smart');
  walk('src/utility');
  return found;
};

// A whole declaration is read, not its first token: the role is as likely to sit
// in a var() fallback as in the value itself.
const PAINTS_CONTENT = /(?:^|[;{\s])color:[^;]*--sf-disable\b|--sf-[a-z0-9-]*--color:[^;]*--sf-disable\b/u;
const PAINTS_FILL = /(?:background(?:-color)?|border-color|box-shadow|outline-color):[^;]*--sf-on-disable\b|--sf-[a-z0-9-]*--(?:background-color|border-color|outline-color):[^;]*--sf-on-disable\b/u;

test('the disabled fill role never paints content', () => {
  const offenders = [];
  for (const path of styleFiles()) {
    read(path).split('\n').forEach((line, index) => {
      if (PAINTS_CONTENT.test(line)) offenders.push(`${path}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, [],
    '--sf-disable is a 12% wash; content on a disabled control is --sf-on-disable');
});

// The reverse is not a defect — the switch and the toggle paint their knob with
// --sf-on-disable on purpose, because the knob is the content of the track. The
// contract records where that happens, so a new one has to be deliberate.
test('the disabled content role paints a fill only where the fill is the content', () => {
  const found = [];
  for (const path of styleFiles()) {
    for (const line of read(path).split('\n')) {
      if (PAINTS_FILL.test(line)) found.push(`${path}: ${line.trim()}`);
    }
  }
  assert.deepEqual(found.sort(), [
    'src/component/dropdown/scss/_css__list-item.scss: --sf-checkbox-box--border-color: var(--sf-on-disable);',
    'src/component/icon-buttons/scss/_css_icon_buttons.scss: --sf-close-icon--background-color: var(--sf-on-disable);',
    'src/component/icon-buttons/scss/_css_icon_buttons.scss: --sf-close-icon--background-color: var(--sf-on-disable);',
    // The third is the destructive status: a disabled close goes grey whatever
    // colour it carries when it is live.
    'src/component/icon-buttons/scss/_css_icon_buttons.scss: --sf-close-icon--background-color: var(--sf-on-disable);',
    'src/component/quantity/scss/_css__quantity.scss: background-color: var(--sf-on-disable);',
    'src/component/radio/scss/_css_radio.scss: --sf-radio-button-mark--background-color: var(--sf-on-disable);',
    'src/component/range-slider/scss/_css__thumbs.scss: background-color: var(--sf-on-disable);',
    'src/component/switch/scss/_css_switch.scss: --sf-switch-inner--background-color: var(--sf-on-disable);',
    'src/component/toggle/scss/_css_toggle.scss: --sf-toggle-inner--background-color: var(--sf-on-disable);',
    'src/smart/icon-button/js/templates/default.css: --sf-close-icon--background-color: var(--sf-on-disable);',
  ].sort());
});

// A control that is both on and disabled used to be painted as on, full stop.
// The checkbox's checked rule set --sf-primary on the box and --sf-on-primary on
// the tick with nothing to stop it, and the radio's mark kept full primary while
// the ring beside it had already gone grey. Measured on the served runtime, a
// disabled ticked checkbox came out identical to an enabled one in both themes:
// box rgb(0,91,190), tick at 6.48:1, label at 17.21:1. A locked consent box read
// as an editable one.
//
// The switch had it right all along — `.active:not(:has(input:disabled))` — so
// the fix is the switch's own guard applied to the other two.
const SELECTION_CONTROLS = [
  'src/component/checkbox/scss/_css__checkbox.scss',
  'src/component/radio/scss/_css_radio.scss',
  'src/component/switch/scss/_css_switch.scss',
  'src/smart/checkbox/js/templates/default.css',
];

const ON_STATE = /:has\(input:checked\)|:has\(input:indeterminate\)|\.active(?![a-z-])/u;
const GUARDED = /:not\(:has\(input:disabled\)\)|input:enabled/u;
const PAINTS_ON_ROLE = /--sf-primary\b|--sf-on-primary\b/u;

test('the on state of a selection control loses to the disabled state', () => {
  const offenders = [];
  for (const path of SELECTION_CONTROLS) {
    const blocks = read(path).split('}');
    for (const block of blocks) {
      const brace = block.lastIndexOf('{');
      if (brace === -1) continue;
      const selector = block.slice(0, brace);
      const body = block.slice(brace + 1);
      if (!ON_STATE.test(selector)) continue;
      if (!PAINTS_ON_ROLE.test(body)) continue;
      // A selector list is only as strong as its weakest branch.
      for (const branch of selector.split(',')) {
        if (!ON_STATE.test(branch)) continue;
        if (GUARDED.test(branch)) continue;
        offenders.push(`${path}: ${branch.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'a locked control painted in --sf-primary reads as an editable one');
});

// Swapping the role is a text edit; keeping it on screen is a cascade question,
// and that is where this nearly went wrong. Collapsing three disabled-label
// branches into one `:has(input:disabled)` read better and lost a class, so the
// resting rule beside it -- `:not(.error):has(input:not(:checked))` -- outweighed
// it and every unticked disabled label went back to full black. Nothing in the
// text of the file was wrong; the weight was.
const specificity = (selector) => {
  let ids = 0, classes = 0, elements = 0;
  // :is(), :not(), :has() take the specificity of their heaviest argument; the
  // functional pseudo-class itself counts for nothing.
  let text = selector;
  for (let guard = 0; guard < 10; guard += 1) {
    const match = text.match(/:(?:is|not|has|where)\(([^()]*)\)/u);
    if (!match) break;
    const inner = match[1].split(',').map((part) => specificity(part));
    const heaviest = match[0].startsWith(':where')
      ? { ids: 0, classes: 0, elements: 0 }
      : inner.reduce((a, b) => (a.ids * 1e4 + a.classes * 1e2 + a.elements
        >= b.ids * 1e4 + b.classes * 1e2 + b.elements ? a : b));
    ids += heaviest.ids; classes += heaviest.classes; elements += heaviest.elements;
    text = text.replace(match[0], ' ');
  }
  ids += (text.match(/#[\w-]+/gu) || []).length;
  classes += (text.match(/\.[\w\\/-]+/gu) || []).length
    + (text.match(/\[[^\]]*\]/gu) || []).length
    + (text.match(/:(?!:)[a-z-]+/gu) || []).length;
  elements += (text.match(/(?:^|[\s>+~])([a-z][\w-]*)/gu) || []).length;
  return { ids, classes, elements };
};
const weight = (s) => { const v = specificity(s); return v.ids * 1e4 + v.classes * 1e2 + v.elements; };

const rulesFor = (path, target) => {
  const out = [];
  // Comments carry class names of their own -- the utility hints name .flex and
  // its friends -- and an @layer opener sits in front of the first selector of
  // its block. Both have to go before anything is counted.
  const source = read(path).replace(/\/\*[\s\S]*?\*\//gu, ' ');
  for (const block of source.split('}')) {
    const brace = block.lastIndexOf('{');
    if (brace === -1) continue;
    const body = block.slice(brace + 1);
    if (!/--color:|(?:^|[;{\s])color:/u.test(body)) continue;
    let selector = block.slice(0, brace);
    const opener = selector.lastIndexOf('{');
    if (opener !== -1) selector = selector.slice(opener + 1);
    for (const branch of selector.split(',')) {
      if (!branch.includes(target)) continue;
      out.push(branch.trim().replace(/\s+/gu, ' '));
    }
  }
  return out;
};

test('a disabled rule outweighs the resting rule it has to beat', () => {
  const targets = [
    ['src/component/checkbox/scss/_css__checkbox.scss', '.sf-checkbox-label'],
    ['src/component/checkbox/scss/_css__checkbox.scss', '.sf-checkbox-description'],
    ['src/component/radio/scss/_css_radio.scss', '.sf-radio-button-text'],
    ['src/component/radio/scss/_css_radio.scss', '.sf-radio-button-description'],
    ['src/component/switch/scss/_css_switch.scss', '.sf-switch-description'],
  ];
  const offenders = [];
  for (const [path, target] of targets) {
    const branches = rulesFor(path, target);
    const disabled = branches.filter((b) => /disabled/u.test(b));
    const resting = branches.filter((b) => !/disabled/u.test(b));
    if (!disabled.length || !resting.length) continue;
    const weakest = Math.min(...disabled.map(weight));
    for (const rest of resting) {
      if (weight(rest) > weakest) offenders.push(`${target}: "${rest}" outweighs the disabled rule`);
    }
  }
  assert.deepEqual(offenders, [],
    'a disabled label that loses the cascade is painted as if it were editable');
});


// The three values are written down because each is a judgement, not a
// derivation: WCAG exempts a disabled control, so nothing outside this file says
// what they should be.
//
// The border has now been at three values. At 24% against ink of 80% it was the
// faintest thing on a disabled control and an outlined field read as having no
// edge at all, so it followed the ink up to 80. At 80 it was the same line as
// --sf-outline in the light theme -- a field at rest and a field nobody can type
// in drawn alike -- and in the dark theme stronger than it, 4.13:1 against
// 3.12:1, so the control that was switched off was the one that stood out. It
// sits at the ink scale's lower step now, 48 in both themes and from the tone of
// the boundary rather than of the ink: 1.86:1 and 2.27:1, under the live
// boundary and over the edge of a region (owner, 2026-10-08).
test('the disabled roles keep the alphas the owner chose', () => {
  const theme = read('src/core/scss/_sf_css__theme.scss');
  const value = (name) => {
    const match = theme.match(new RegExp(`--sf-${name}: ([^;]+);`, 'u'));
    return match ? match[1].trim() : null;
  };
  assert.equal(value('disable'),
    'light-dark(var(--sf-neutral-50--alfa-12), var(--sf-neutral-90--alfa-12))');
  assert.equal(value('on-disable'),
    'light-dark(var(--sf-neutral-50--alfa-80), var(--sf-neutral-90--alfa-48))');
  assert.equal(value('outline-disable'),
    'light-dark(var(--sf-neutral-50--alfa-48), var(--sf-neutral-60--alfa-48))');
});
