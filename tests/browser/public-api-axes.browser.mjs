#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// A rename is only non-breaking if the old name still works on the built bytes.
// This drives the real custom elements: the legacy attribute, the canonical one,
// both together, and a change to either after the element is live.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const cases = [
  // The legacy *attribute* (type) carries a current value: ghost itself is now a
  // legacy value of sf-button, drawn as link (journal value-button-ghost-to-link).
  {tag: 'sf-button', root: '.sf-button', prefix: 'sf-button--', legacy: 'tonal', canonical: 'surface',
   css: ['core/core/css/core.css', 'component/component/buttons/css/buttons.css'],
   js: 'smart/smart/buttons/js/buttons.js'},
  {tag: 'sf-icon-button', root: '.sf-icon-button', prefix: 'sf-icon-button--', legacy: 'ghost', canonical: 'surface',
   css: ['core/core/css/core.css', 'component/component/icon-buttons/css/icon-buttons.css'],
   js: 'smart/smart/icon-buttons/js/icon-buttons.js'},
];

// A renamed value must answer to the old word too, and render the canonical class.
const valueCases = [
  {tag: 'sf-alert', root: '.sf-alert', css: ['core/core/css/core.css', 'component/component/alerts/css/alerts.css'],
   js: 'smart/smart/alert/js/alert.js', axis: 'status', legacyAttribute: 'type',
   pairs: [['danger', 'sf-alert--error'], ['clear', 'sf-alert--neutral'], ['error', 'sf-alert--error']]},
  {tag: 'sf-toast', root: '.sf-toast', css: ['core/core/css/core.css', 'component/component/toast/css/toast.css'],
   js: 'smart/smart/toast/js/toast.js', axis: 'status', legacyAttribute: 'type',
   pairs: [['primary', 'sf-toast--info'], ['default', 'sf-toast--neutral'], ['warning', 'sf-toast--warning']]},
];

// The renames and the two splits, each read from the class the element draws:
// a legacy name or a legacy value must still reach the right class.
const classCases = [
  {tag: 'sf-tooltip', root: '.sf-tooltip', css: ['core/core/css/core.css', 'component/component/tooltip/css/tooltip.css'],
   js: 'smart/smart/tooltip/js/tooltip.js', attributes: {type: 'dark', text: 'x'}, expect: 'sf-tooltip--dark'},
  {tag: 'sf-list-item', root: '.sf-list-item', css: ['core/core/css/core.css', 'component/component/dropdown/css/dropdown.css'],
   js: 'smart/smart/list-item/js/list-item.js', attributes: {type: 'icon', text: 'x'}, expect: 'sf-list-item--icon'},
  {tag: 'sf-list-item', root: '.sf-list-item', css: ['core/core/css/core.css', 'component/component/dropdown/css/dropdown.css'],
   js: 'smart/smart/list-item/js/list-item.js', attributes: {kind: 'avatar', text: 'x'}, expect: 'sf-list-item--avatar'},
  {tag: 'sf-tag', root: '.sf-tag', css: ['core/core/css/core.css', 'component/component/tags/css/tags.css'],
   js: 'smart/smart/tags/js/tags.js', attributes: {type: 'success', text: 'x'}, expect: 'sf-tag--success',
   note: 'a status word given as the legacy type reaches the status axis'},
  {tag: 'sf-tag', root: '.sf-tag', css: ['core/core/css/core.css', 'component/component/tags/css/tags.css'],
   js: 'smart/smart/tags/js/tags.js', attributes: {type: 'icon', text: 'x'}, expect: 'sf-tag--icon',
   note: 'and a content word reaches the kind axis'},
  {tag: 'sf-tag', root: '.sf-tag', css: ['core/core/css/core.css', 'component/component/tags/css/tags.css'],
   js: 'smart/smart/tags/js/tags.js', attributes: {kind: 'icon', status: 'warning', text: 'x'}, expect: 'sf-tag--warning',
   absent: 'sf-tag--icon', note: 'with both set, the status is what the one class reports'},
  {tag: 'sf-badge', root: '.sf-badge', css: ['core/core/css/core.css', 'component/component/badges/css/badges.css'],
   js: 'smart/smart/badges/js/badges.js', attributes: {scheme: 'danger', text: 'x'}, expect: 'sf-badge--error',
   note: 'the legacy status word given as a scheme draws the canonical class'},
  {tag: 'sf-badge', root: '.sf-badge', css: ['core/core/css/core.css', 'component/component/badges/css/badges.css'],
   js: 'smart/smart/badges/js/badges.js', attributes: {scheme: 'primary', text: 'x'}, expect: 'sf-badge--primary',
   note: 'and a colour role stays a colour role'},
  {tag: 'sf-progress-bar', root: '.sf-progress-bar', css: ['core/core/css/core.css', 'component/component/progress-bar/css/progress-bar.css'],
   js: 'smart/smart/progress-bar/js/progress-bar.js', attributes: {tone: 'success', value: '40'}, expect: 'sf-progress-bar--success'},
  {tag: 'sf-progress-bar', root: '.sf-progress-bar', css: ['core/core/css/core.css', 'component/component/progress-bar/css/progress-bar.css'],
   js: 'smart/smart/progress-bar/js/progress-bar.js', attributes: {tone: 'primary', value: '40'}, expect: 'sf-progress-bar--neutral',
   note: 'the legacy colour word is answered as neutral'},
];

const failures = [];
const browser = await chromium.launch();
try {
  for (const subject of cases) {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html class="theme-light"><body></body></html>');
    for (const path of subject.css) await page.addStyleTag({path: join(out, path)});
    // A Smart bundle is built against the shared runtime (2026-10-13).
    await page.addScriptTag({path: join(out, 'core/core/js/smart-base.js')});
    await page.addScriptTag({path: join(out, subject.js), type: 'module'});
    await page.waitForFunction((tag) => Boolean(customElements.get(tag)), subject.tag);

    const classesOf = (attributes) => page.evaluate(async ({tag, root, attributes: pairs}) => {
      const element = document.createElement(tag);
      for (const [name, value] of Object.entries(pairs)) element.setAttribute(name, value);
      element.setAttribute('size', '1');
      element.setAttribute('scheme', 'on-surface');
      document.body.append(element);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const rendered = element.querySelector(root) || element.shadowRoot?.querySelector(root);
      const list = rendered ? [...rendered.classList] : [];
      const reported = element.appearance;
      element.remove();
      return {list, reported};
    }, {tag: subject.tag, root: subject.root, attributes: attributes});

    const legacyOnly = await classesOf({type: subject.legacy});
    if (!legacyOnly.list.includes(`${subject.prefix}${subject.legacy}`)) {
      failures.push({tag: subject.tag, attribute: 'type', classes: legacyOnly.list, expected: `the legacy name still draws ${subject.legacy}`});
    }
    if (legacyOnly.reported !== subject.legacy) {
      failures.push({tag: subject.tag, reported: legacyOnly.reported, expected: 'the canonical property reports what the legacy attribute asked for'});
    }

    const canonicalOnly = await classesOf({appearance: subject.canonical});
    if (!canonicalOnly.list.includes(`${subject.prefix}${subject.canonical}`)) {
      failures.push({tag: subject.tag, attribute: 'appearance', classes: canonicalOnly.list, expected: `the canonical name draws ${subject.canonical}`});
    }

    // Both set: the canonical name wins, and the element says so.
    const both = await classesOf({type: subject.legacy, appearance: subject.canonical});
    if (!both.list.includes(`${subject.prefix}${subject.canonical}`) || both.list.includes(`${subject.prefix}${subject.legacy}`)) {
      failures.push({tag: subject.tag, classes: both.list, expected: 'the canonical name wins when both are set'});
    }

    // A change to the legacy attribute after the element is live still re-renders.
    const afterChange = await page.evaluate(async ({tag, root}) => {
      const element = document.createElement(tag);
      element.setAttribute('size', '1');
      element.setAttribute('type', 'ghost');
      document.body.append(element);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      element.setAttribute('type', 'surface');
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const rendered = element.querySelector(root) || element.shadowRoot?.querySelector(root);
      const list = rendered ? [...rendered.classList] : [];
      element.remove();
      return list;
    }, {tag: subject.tag, root: subject.root});
    if (!afterChange.includes(`${subject.prefix}surface`)) {
      failures.push({tag: subject.tag, classes: afterChange, expected: 'a change to the legacy attribute re-renders'});
    }

    await page.close();
  }

  for (const subject of valueCases) {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html class="theme-light"><body></body></html>');
    for (const path of subject.css) await page.addStyleTag({path: join(out, path)});
    // A Smart bundle is built against the shared runtime (2026-10-13).
    await page.addScriptTag({path: join(out, 'core/core/js/smart-base.js')});
    await page.addScriptTag({path: join(out, subject.js), type: 'module'});
    await page.waitForFunction((tag) => Boolean(customElements.get(tag)), subject.tag);

    for (const [word, expected] of subject.pairs) {
      const seen = await page.evaluate(async ({tag, root, attribute, value}) => {
        const element = document.createElement(tag);
        element.setAttribute(attribute, value);
        document.body.append(element);
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        const rendered = element.querySelector(root) || element.shadowRoot?.querySelector(root);
        const list = rendered ? [...rendered.classList] : [];
        const reported = element.status;
        element.remove();
        return {list, reported};
      }, {tag: subject.tag, root: subject.root, attribute: subject.legacyAttribute, value: word});

      if (!seen.list.includes(expected)) {
        failures.push({tag: subject.tag, word, classes: seen.list, expected: `${expected}, so the old word keeps working and the canonical class is drawn`});
      }
      if (!seen.reported || seen.reported === word && expected.endsWith(word) === false) {
        failures.push({tag: subject.tag, word, reported: seen.reported, expected: 'the canonical value reported back'});
      }
    }
    await page.close();
  }

  for (const subject of classCases) {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html class="theme-light"><body></body></html>');
    for (const path of subject.css) await page.addStyleTag({path: join(out, path)});
    // A Smart bundle is built against the shared runtime (2026-10-13).
    await page.addScriptTag({path: join(out, 'core/core/js/smart-base.js')});
    await page.addScriptTag({path: join(out, subject.js), type: 'module'});
    await page.waitForFunction((tag) => Boolean(customElements.get(tag)), subject.tag);

    const classes = await page.evaluate(async ({tag, root, attributes}) => {
      const element = document.createElement(tag);
      for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
      document.body.append(element);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const rendered = element.querySelector(root) || element.shadowRoot?.querySelector(root);
      const list = rendered ? [...rendered.classList] : [];
      element.remove();
      return list;
    }, {tag: subject.tag, root: subject.root, attributes: subject.attributes});

    if (!classes.includes(subject.expect)) {
      failures.push({tag: subject.tag, attributes: subject.attributes, classes, expected: subject.expect, note: subject.note});
    }
    if (subject.absent && classes.includes(subject.absent)) {
      failures.push({tag: subject.tag, attributes: subject.attributes, classes, unexpected: subject.absent, note: subject.note});
    }
    await page.close();
  }
} finally {
  await browser.close();
}
if (failures.length) throw new Error(JSON.stringify(failures, null, 2));
process.stdout.write('Public API axes: PASS — every renamed axis and both splits answer their legacy names and values, the canonical name wins, and a late change re-renders\n');
