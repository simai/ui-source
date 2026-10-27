import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const modal = read('src/smart/modal/index.js');
const gallery = read('src/smart/gallery/index.js');
const loader = read('src/core/js/loader.js');

test('Smart modal events bubble and are composed', () => {
    assert.doesNotMatch(modal, /bubbles: false/);
    // The window's events go through sfEmit (bubbles and composed, core
    // element-manifest.js); the retiring lifecycle copies are sent the same way.
    assert.match(modal, /return this\.sfEmit\(verb, \{ modalId: this\.modalId, \.\.\.detail \}, \{ cancelable \}\);/);
    assert.match(modal, /new CustomEvent\(type, \{ bubbles: true, composed: true, detail \}\)/);
    assert.match(read('src/core/js/element-manifest.js'), /bubbles: true,\s*composed: true,/);
});

test('modal on* helpers keep only their own modal events', () => {
    // Eight helpers by the new names (§8), the two retiring lifecycle copies by theirs.
    assert.equal((modal.match(/return this\.onModalEvent\("[a-z-]+", handler, options\);/g) || []).length, 8);
    assert.match(modal, /this\.addEventListener\(this\.sfEventName\(verb\), this\.ownModalHandler\(handler\), options\)/);
    assert.equal((modal.match(/this\.addEventListener\("modal:(ready|update)", this\.ownModalHandler\(handler\), options\)/g) || []).length, 2);
    const body = modal.split('  ownModalHandler(handler) {')[1].split('\n  }\n')[0];
    const own = new Function('handler', body);
    const self = {}; const calls = [];
    const wrapped = own.call(self, function () { calls.push(this); });
    // Detail carries no element (§8): the emitter is the event's target.
    wrapped({target: {}});
    wrapped({target: self});
    assert.deepEqual(calls, [self]);
});

test('Gallery and SF.create handlers ignore nested modal events', () => {
    assert.match(gallery, /_handleModalAfterOpen\(event\) \{\s*\/\/[^\n]*\n\s*if \(event\?\.target && event\.target !== this\._modal\) return;/);
    assert.match(gallery, /_handleModalAfterClose\(event\) \{\s*if \(event\?\.target && event\.target !== this\._modal\) return;/);
    assert.match(loader, /\/\^\(modal\|drawer\):\/\.test\(eventName\)\s*\? \(event\) => \{ if \(event\.target === element\) value\.call\(element, event\); \}/);
});
