// Board study defects BV-6..BV-9 (ui-control control/research/2026-11-17-board-view,
// DEV letter msg-c226d8962ade4bfd839d): one Tab stop per list, «Move to» in
// the handle's menu with the host's veto, Enter picks up and Space selects a
// selectable item, and hidden helpers that never widen the page. The browser
// half is the probe in control/evidence/2026-11-17-sortable-bv/probe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SORTABLE_CHECK_EVENT, sortableKeyAction, sortableMoveTargets, sortableRefusal, sortableRovingStep,
  sortableSelectable, requestSortableTransfer,
} from '../src/core/js/composition/sortable.mjs';
import { moveMenuEntries, moveMenuTransfer } from '../src/core/js/composition/sortable-move-menu.mjs';

const read = (path) => readFileSync(new globalThis.URL(`../${path}`, import.meta.url), 'utf8');

test('BV-6: the list axis goes between items, the other axis in and out of an item (logical)', () => {
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '];
  const steps = (options) => keys.map((key) => sortableRovingStep(key, options) || '-').join(' ');
  assert.equal(steps({ orientation: 'vertical' }), 'prev next out in first last - -');
  assert.equal(steps({ orientation: 'vertical', rtl: true }), 'prev next in out first last - -');
  assert.equal(steps({ orientation: 'horizontal' }), 'out in prev next first last - -');
  assert.equal(steps({ orientation: 'horizontal', rtl: true }), 'out in next prev first last - -');
});

test('BV-6: items and the controls inside them leave the Tab order; the list keeps one stop', () => {
  const core = read('src/core/js/composition/sortable.mjs');
  // Every item but the current one is -1; the current is 0.
  assert.match(core, /const want = item === this\.currentItem \? '0' : '-1';/);
  // The controls in an item are tamed, their own tabindex kept and given back.
  assert.match(core, /for \(const control of controlsOf\(item\)\) tame\(control\);/);
  assert.match(core, /for \(const control of this\.querySelectorAll\(`\[\$\{TAMED\}\]`\)\) untame\(control\);/);
  // sf-list-item rows keep their own roving.
  assert.match(core, /const OWN_ROVING = '\[data-sf-list-roving\]';/);
});

test('BV-8: Enter picks up; Space selects a selectable item and picks up any other', () => {
  assert.equal(sortableKeyAction('Enter', false), 'pick');
  assert.equal(sortableKeyAction('Enter', true), 'pick');
  assert.equal(sortableKeyAction(' ', false), 'pick');
  assert.equal(sortableKeyAction(' ', true), 'select');
  assert.equal(sortableKeyAction('a', false), null);
  const item = (marks, attributes = {}) => ({
    hasAttribute: (name) => name in attributes,
    querySelectorAll: () => marks.map((mark) => ({ closest: () => item.self, disabled: false, getAttribute: () => null, ...mark })),
  });
  const plain = item([]);
  plain.self = plain;
  assert.equal(sortableSelectable(plain), false);
  const marked = item([{}]);
  marked.self = marked;
  const markedOne = { ...marked, querySelectorAll: () => [{ closest: () => markedOne, disabled: false, getAttribute: () => null }] };
  assert.equal(sortableSelectable(markedOne), true);
  const disabledMark = { hasAttribute: () => false, querySelectorAll: () => [{ closest: () => disabledMark, disabled: true, getAttribute: () => null }] };
  assert.equal(sortableSelectable(disabledMark), false);
  assert.equal(sortableSelectable({ hasAttribute: (name) => name === 'aria-selected', querySelectorAll: () => [] }), true);
  // The row mode of SF.Sortable.attach follows the same rule.
  const core = read('src/core/js/composition/sortable.mjs');
  assert.match(core, /sortableKeyAction\(event\.key, sortableSelectable\(item\)\) !== 'pick'/);
});

// Three lists of one group on a page, a host that refuses one of them.
function board(veto) {
  const lists = [];
  const listeners = [];
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) { Object.assign(this, { type, detail: init.detail, cancelable: init.cancelable, defaultPrevented: false }); }
    preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
  };
  const list = (id, label, group = 'board') => {
    const self = {
      id, label, group, mode: 'move', items: [], announced: [], sent: [],
      getAttribute(name) { return { id, label, group, mode: null, accepts: null }[name] ?? null; },
      querySelectorAll() { return self.items; },
      announce(text) { self.announced.push(text); },
      dispatchEvent(event) {
        if (event.type === SORTABLE_CHECK_EVENT) for (const listener of listeners) listener(event);
        else self.sent.push(event);
        return !event.defaultPrevented;
      },
    };
    lists.push(self);
    return self;
  };
  const card = (id, owner) => {
    const self = { getAttribute: (name) => (name === 'data-sf-sortable-item' ? id : null), closest: () => owner, cloneNode: () => ({ querySelectorAll: () => [], textContent: `Card ${id}` }) };
    owner.items.push(self);
    return self;
  };
  globalThis.document = { querySelectorAll: () => lists };
  globalThis.SF = {};
  listeners.push(veto);
  return { lists, list, card };
}

test('BV-7: «Move to» lists the group, the current list checked, a refused one disabled with the host\'s reason', () => {
  const { list, card } = board((event) => {
    if (event.detail.to === 'sent' && event.detail.from !== 'paid') {
      event.preventDefault();
      event.detail.reason = 'Only from Paid';
    }
  });
  const fresh = list('new', 'New');
  list('paid', 'Paid');
  const sent = list('sent', 'Sent');
  list('other', 'Other', 'elsewhere');
  const one = card('o1', fresh);
  card('o2', fresh);
  const targets = sortableMoveTargets(fresh, one);
  assert.deepEqual(targets.map((target) => [target.label, target.current, target.reason]), [
    ['New', true, ''], ['Paid', false, ''], ['Sent', false, 'Only from Paid'],
  ]);
  const entries = moveMenuEntries(0, 2, targets);
  const to = entries.find((entry) => entry.id === 'to');
  assert.equal(entries.at(-2).type, 'separator');
  assert.deepEqual(to.submenu.map((row) => [row.id, row.text, Boolean(row.checked), row.disabled, row.caption ?? '']), [
    ['to:0', 'New', true, true, ''], ['to:1', 'Paid', false, false, ''], ['to:2', 'Sent', false, true, 'Only from Paid'],
  ]);
  // Only an allowed target is a choice.
  assert.equal(moveMenuTransfer('to:0', targets), null);
  assert.equal(moveMenuTransfer('to:2', targets), null);
  assert.equal(moveMenuTransfer('to:1', targets).label, 'Paid');
  // A list alone in its group gets no «Move to».
  assert.equal(moveMenuEntries(0, 2, [{ label: 'New', current: true, reason: '' }]).some((entry) => entry.id === 'to'), false);
  // The transfer sends the request a drag between lists ends with, to the end of the target; a refused one sends nothing.
  assert.equal(requestSortableTransfer(fresh, one, sent), false);
  assert.equal(sent.sent.length, 0);
  const paid = targets[1].list;
  assert.equal(requestSortableTransfer(fresh, one, paid), true);
  assert.deepEqual({ ...paid.sent[0].detail }, { item: 'o1', from: 'new', to: 'paid', index: 0, mode: 'move' });
  assert.equal(fresh.announced.length, 1);
  // The veto with no words says a plain «not here».
  const quiet = board((event) => event.preventDefault());
  const a = quiet.list('a', 'A');
  const b = quiet.list('b', 'B');
  assert.equal(sortableRefusal(b, a, quiet.card('x', a)), 'Not here');
  assert.equal(sortableRefusal(a, a, null), '');
});

test('BV-7: the veto also holds for a drag and a keyboard move; the menu key opens the menu', () => {
  const core = read('src/core/js/composition/sortable.mjs');
  const menu = read('src/core/js/composition/sortable-move-menu.mjs');
  assert.match(core, /accepts\(list, shared\.session\?\.group\) && !refusedInSession\(list\)/);
  assert.match(core, /if \(list && accepts\(list, shared\.session\.group\) && refusedInSession\(list\)\) \{/);
  assert.match(menu, /event\.key === 'ContextMenu' \|\| \(event\.key === 'F10' && event\.shiftKey\)/);
  const [en, ru] = ['en', 'ru'].map((lang) => JSON.parse(read(`src/smart/sortable/lang/${lang}.json`)).runtime);
  assert.equal(ru['move-to'], 'Переместить в');
  assert.equal(en['move-to'], 'Move to');
  assert.equal(ru.refused, 'Сюда нельзя');
  assert.match(ru['instructions-select'], /^Пробел — выбрать, Enter — взять/u);
  assert.match(en['instructions-select'], /^Space to select, Enter to pick up/u);
});

test('BV-9: hidden helpers stand at the start corner of their box, never where they would have flowed', () => {
  const sortable = read('src/smart/sortable/scss/_smart__sortable.scss');
  const live = /\.sf-sortable-live \{([^}]*)\}/u.exec(sortable)[1];
  assert.match(live, /position: absolute;/);
  assert.match(live, /inset-block-start: 0;/);
  assert.match(live, /inset-inline-start: 0;/);
  assert.doesNotMatch(live, /left: -|-9999|-10000/);
  const checkbox = read('src/component/checkbox/scss/_custom__checkbox.scss');
  assert.match(checkbox, /\.sf-checkbox-box \{[^}]*position: relative;/);
});
