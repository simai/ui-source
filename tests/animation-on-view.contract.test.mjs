import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Animate when scrolled into view (utility.animation 1.1.0): an element with
// `animation-on-view` waits (data-sf-on-view="waiting", the sheet pauses the
// animation) until it is in view, then is shown once; one observer for the
// page; nothing is marked without IntersectionObserver or under reduced
// motion. The browser half, on the built sheet and core, is
// tests/browser/animation-on-view.browser.mjs.

const {installOnView, onViewSeen, ON_VIEW_CLASS, ON_VIEW_STATE, ON_VIEW_THRESHOLD} = await import('../src/core/js/on-view.js');
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

// A document just big enough: elements with classes, attributes, children.
function element(classes = '', children = []) {
  const one = {
    nodeType: 1,
    classes: new Set(classes.split(/\s+/u).filter(Boolean)),
    attrs: {},
    children,
    isConnected: true,
    getAttribute(name) { return this.attrs[name] ?? null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    matches(selector) { return matches(this, selector); },
    querySelectorAll(selector) { return descendants(this).filter((node) => matches(node, selector)); },
  };
  return one;
}
const descendants = (node) => node.children.flatMap((child) => [child, ...descendants(child)]);
function matches(node, selector) {
  if (selector === `.${ON_VIEW_CLASS}:not([${ON_VIEW_STATE}])`) return node.classes.has(ON_VIEW_CLASS) && !(ON_VIEW_STATE in node.attrs);
  if (selector === `[${ON_VIEW_STATE}="waiting"]`) return node.attrs[ON_VIEW_STATE] === 'waiting';
  throw new Error(`unexpected selector ${selector}`);
}

function page({reduce = false, sight = true} = {}) {
  const body = element();
  const html = element('', [body]);
  const doc = {nodeType: 9, documentElement: html, querySelectorAll: (selector) => [html, ...descendants(html)].filter((node) => matches(node, selector))};
  const sights = [];
  const changes = [];
  const motionListeners = [];
  const motion = {matches: reduce, addEventListener: (type, listener) => motionListeners.push(listener), removeEventListener() {}};
  class FakeSight {
    constructor(callback, options) { this.callback = callback; this.options = options; this.targets = new Set(); sights.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
  }
  class FakeChanges {
    constructor(callback) { this.callback = callback; changes.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() {}
  }
  const win = {document: doc, innerHeight: 800, MutationObserver: FakeChanges, matchMedia: () => motion};
  if (sight) win.IntersectionObserver = FakeSight;
  return {win, body, sights, changes, motion, motionListeners};
}
const entry = (target, ratio, height = 100) => ({target, isIntersecting: ratio > 0, intersectionRatio: ratio, boundingClientRect: {height}, rootBounds: {height: 800}});

test('an element in the markup waits, and is shown once 15 % of it is in view', () => {
  const {win, body, sights} = page();
  const card = element('animation animation-from-bottom animation-on-view');
  const plain = element('animation');
  body.children.push(card, plain);
  const onView = installOnView(win);
  assert.equal(card.getAttribute(ON_VIEW_STATE), 'waiting');
  assert.equal(plain.getAttribute(ON_VIEW_STATE), null, 'an element without the class is left alone');
  assert.equal(sights.length, 1);
  assert.deepEqual(sights[0].options.threshold, [0, ON_VIEW_THRESHOLD]);
  sights[0].callback([entry(card, 0.05)]);
  assert.equal(card.getAttribute(ON_VIEW_STATE), 'waiting', 'a sliver is not enough');
  sights[0].callback([entry(card, 0.2)]);
  assert.equal(card.getAttribute(ON_VIEW_STATE), 'shown');
  assert.equal(sights[0].targets.has(card), false, 'unobserved once shown');
  assert.equal(onView.waiting, 0);
  sights[0].callback([entry(card, 0)]);
  assert.equal(card.getAttribute(ON_VIEW_STATE), 'shown', 'played once: leaving the view does not hold it again');
  onView.stop();
});

test('one observer for the page; markup added later waits too; a second install finds the first', () => {
  const {win, body, sights, changes} = page();
  const onView = installOnView(win);
  assert.equal(sights.length, 0, 'the IntersectionObserver is created on first use');
  assert.equal(installOnView(win), onView);
  assert.deepEqual(changes[0].options, {childList: true, subtree: true});
  const first = element('animation animation-on-view');
  const second = element('animation animation-on-view');
  const wrapper = element('', [second]);
  body.children.push(first, wrapper);
  changes[0].callback([{addedNodes: [first, wrapper], removedNodes: []}]);
  assert.equal(first.getAttribute(ON_VIEW_STATE), 'waiting');
  assert.equal(second.getAttribute(ON_VIEW_STATE), 'waiting');
  assert.equal(sights.length, 1, 'still one observer');
  assert.equal(sights[0].targets.size, 2);
  wrapper.isConnected = false;
  second.isConnected = false;
  changes[0].callback([{addedNodes: [], removedNodes: [wrapper]}]);
  assert.equal(sights[0].targets.has(second), false, 'a removed element is no longer observed');
  assert.equal(onView.waiting, 1);
  onView.stop();
});

test('reduced motion and a browser without IntersectionObserver mark nothing; turning reduced motion on shows the waiting', () => {
  for (const options of [{reduce: true}, {sight: false}]) {
    const {win, body} = page(options);
    const card = element('animation animation-on-view');
    body.children.push(card);
    const onView = installOnView(win);
    assert.equal(card.getAttribute(ON_VIEW_STATE), null, JSON.stringify(options));
    onView.stop();
  }
  const {win, body, motion, motionListeners} = page();
  const card = element('animation animation-on-view');
  body.children.push(card);
  const onView = installOnView(win);
  assert.equal(card.getAttribute(ON_VIEW_STATE), 'waiting');
  motion.matches = true;
  for (const listener of motionListeners) listener();
  assert.equal(card.getAttribute(ON_VIEW_STATE), 'shown');
  onView.stop();
});

test('an element too tall to ever show 15 % starts as soon as it enters', () => {
  assert.equal(onViewSeen(entry({}, 0.01, 8000)), true);
  assert.equal(onViewSeen(entry({}, 0.01, 1600)), false);
  assert.equal(onViewSeen(entry({}, 0, 8000)), false);
});

test('the sheet pauses only a marked element; the rule loads the class; core runs the module', () => {
  const sheet = read('../src/utility/animation/default/scss/_sf_css__animation.scss');
  assert.match(sheet, /\.animation-on-view\[data-sf-on-view='waiting'\]\s*\{\s*animation-play-state: paused;/u);
  assert.match(sheet, /prefers-reduced-motion: reduce\)\s*\{\s*\.animation-on-view\[data-sf-on-view='waiting'\]\s*\{\s*animation-play-state: running;/u);
  const context = {SF: {RuleLoader: {}}};
  new Function('SF', read('../src/utility/animation/default/rule.js'))(context.SF);
  const rule = context.SF.RuleLoader['animation/default'];
  for (const name of ['animation', 'animation-on-view', 'animation-from-left', 'infinite']) assert.equal(rule.test(name), true, name);
  assert.equal(rule.test('animation-on'), false);
  assert.match(read('../src/core/js/index.js'), /^import '\.\/on-view\.js';$/mu);
  assert.equal(JSON.parse(read('../src/utility/animation/passport.json')).version, '1.1.0');
});
