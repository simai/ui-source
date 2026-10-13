import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const modal = read('src/smart/modal/index.js');
const gallery = read('src/smart/gallery/index.js');
const loader = read('src/core/js/loader.js');

test('Smart modal events bubble and are composed', () => {
    assert.doesNotMatch(modal, /bubbles: false/);
    assert.equal((modal.match(/bubbles: true,\s*composed: true,/g) || []).length, 4);
});

test('modal on* helpers keep only their own modal events', () => {
    assert.equal((modal.match(/this\.addEventListener\("modal:[a-z-]+", this\.ownModalHandler\(handler\), options\)/g) || []).length, 10);
    const body = modal.split('  ownModalHandler(handler) {')[1].split('\n  }\n')[0];
    const own = new Function('handler', body);
    const self = {}; const calls = [];
    const wrapped = own.call(self, function () { calls.push(this); });
    wrapped({detail: {modal: {}}});
    wrapped({detail: {modal: self}});
    assert.deepEqual(calls, [self]);
});

test('Gallery and SF.create handlers ignore nested modal events', () => {
    assert.match(gallery, /_handleModalAfterOpen\(event\) \{\s*\/\/[^\n]*\n\s*if \(event\?\.target && event\.target !== this\._modal\) return;/);
    assert.match(gallery, /_handleModalAfterClose\(event\) \{\s*if \(event\?\.target && event\.target !== this\._modal\) return;/);
    assert.match(loader, /\/\^\(modal\|drawer\):\/\.test\(eventName\)\s*\? \(event\) => \{ if \(event\.target === element\) value\.call\(element, event\); \}/);
});
