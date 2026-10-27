#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//        ASSEMBLY_SOURCE_ROOT=/absolute/path/to/src node this-file   (the source modules)
//
// The page side of the assembly runtime (SF.Assembly, src/core/js/assembly/,
// standard simai.smart-component 1.3.8 §7), in Chromium, on the modules a
// build ships as source (<output>/core/core/js/assembly/*.mjs):
//   - a layout places the roles in <x-role>, shows a key as {{key}}, and moves
//     the layout's content inside a container's <x-role> into the part;
//   - a role per entry inside a tab panel repeats the panel per entry with
//     data-entry; a part with start "opened" starts when its panel opens, and
//     once started defers its reads while the panel is closed (§7.2.1, §7.2.3);
//   - if takes a part out of the DOM and brings the same element back;
//     hidden keeps it with hidden and its controls disabled (§7.2.2);
//   - today's components through the interface adapter: settings as
//     properties and attributes, values read on their events, events as
//     <tag>-<verb> and native change, actions as methods, a cancelable
//     request refused by a rule (§4, §8);
//   - a part's interface events stop at the assembly; the page hears the
//     assembly's own <tag>-<verb> events and its change of values (§7.4); a
//     native change or input of a form control inside is the page's DOM event
//     and reaches the page (dispatcher decision 2026-10-27);
//   - keys kept in the address, Back restores them (§7.5);
//   - the live region, errors as sf-component-error, the scope ending when the
//     assembly is taken out of the page (§7.4.1, §4.1, §7.7);
//   - a layout switch moves the parts with their state (§7.3);
//   - a part whose code has not arrived fetches none while its role's `if` is
//     false (the role's own or a layout element's), nor inside a closed
//     container before it opens: the network is watched (§7.2.1; stand 24 F1,
//     simai/ui-source#47).
/* global URL, console, document, location, process, requestAnimationFrame, setTimeout, window */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';

const sourceRoot = process.env.ASSEMBLY_SOURCE_ROOT;
if (!process.argv[2] && !sourceRoot) throw new Error('Build output root is required');
// The page imports /core/js/assembly/index.mjs: <output>/core holds core/js/, as src/ does.
const root = resolve(process.argv[2] ? join(process.argv[2], 'core') : sourceRoot);
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8'};

const page = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>assembly runtime</title></head><body><div id="stage"></div>
<script type="module">
import Assembly from '/core/js/assembly/index.mjs';
window.Assembly = Assembly;
Assembly.debug(true);
// "Today's components": plain custom elements, no Smart base, no part protocol.
customElements.define('t-input', class extends HTMLElement {
  connectedCallback() {
    if (this.field) return;
    this.field = document.createElement('input');
    this.field.addEventListener('input', () => { this.value = this.field.value; this.dispatchEvent(new Event('change', {bubbles: true})); });
    this.append(this.field);
  }
  get value() { return this._value ?? ''; }
  set value(v) { this._value = v; if (this.field) this.field.value = v ?? ''; }
  set items(list) { this._items = list; this.dataset.items = String(list?.length ?? 0); }
  get items() { return this._items; }
  clear() { this.value = ''; return {answer: 'applied'}; }
});
customElements.define('t-button', class extends HTMLElement {
  connectedCallback() { if (!this.firstChild) { const b = document.createElement('button'); b.textContent = this.getAttribute('text') ?? ''; b.addEventListener('click', () => this.dispatchEvent(new CustomEvent('t-button-press', {bubbles: true, detail: {}}))); this.append(b); } }
  static get observedAttributes() { return ['text']; }
  attributeChangedCallback() { if (this.firstChild) this.firstChild.textContent = this.getAttribute('text'); }
  close() { const event = new CustomEvent('t-button-close', {bubbles: true, cancelable: true, detail: {reason: 'escape'}}); return this.dispatchEvent(event) ? {answer: 'applied'} : {answer: 'refused', reason: 'refused'}; }
});
customElements.define('t-tabs', class extends HTMLElement {
  connectedCallback() { new MutationObserver(() => this.show()).observe(this, {childList: true}); this.show(); }
  set items(list) { this._items = list; if (!list?.some((one) => one.id === this._selected)) this._selected = list?.[0]?.id ?? null; this.show(); }
  get items() { return this._items; }
  get selected() { return this._selected ?? null; }
  set selected(id) { this._selected = id; this.show(); }
  show() { for (const panel of this.querySelectorAll(':scope > [role=tabpanel]')) panel.hidden = panel.dataset.entry !== this._selected; }
  pick(id) { this.selected = id; this.dispatchEvent(new CustomEvent('t-tabs-change', {bubbles: true, detail: {selected: id}})); }
});
customElements.define('t-section', class extends HTMLElement {
  set group(v) { this._group = v; this.reads = (this.reads ?? 0) + 1; this.textContent = 'group ' + v; }
  get group() { return this._group; }
  set revision(v) { this._revision = v; this.reads = (this.reads ?? 0) + 1; }
  get revision() { return this._revision; }
});
Assembly.interfaces.registerAll({
  't-input': {version: '1.0.0', settings: {items: {type: 'list'}, name: {type: 'string'}}, values: {value: {type: 'string'}}, events: {change: {carries: 'native'}}, actions: {clear: {}}},
  't-button': {version: '1.0.0', settings: {text: {type: 'string'}, disabled: {type: 'boolean'}}, values: {}, events: {press: {carries: {}}, close: {carries: {reason: 'string'}, cancelable: true}}, actions: {close: {}}},
  't-tabs': {version: '1.0.0', settings: {items: {type: 'list'}}, values: {selected: {type: 'string'}}, events: {change: {carries: {selected: 'string'}}}, actions: {}},
  't-section': {version: '1.0.0', settings: {group: {type: 'string'}, revision: {type: 'number'}}, values: {}, events: {}, actions: {}},
});
Assembly.define({
  tag: 't-form', kind: 'assembly', settings: {title: {type: 'string', default: 'Форма'}}, values: {query: {type: 'string', value: 'query'}, total: {type: 'number', value: 'total'}},
  events: {sent: {carries: {query: 'string'}}}, actions: {send: {}},
  accessibility: {announces: {total: 'polite'}},
  keys: {title: {type: 'string', writer: 'parent'}, query: {type: 'string', writer: 'search'}, total: {type: 'number', writer: 'logic', initial: 0},
    company: {type: 'boolean', writer: 'logic', initial: false, persist: 'url'}, note: {type: 'boolean', writer: 'logic', initial: true},
    dirty: {type: 'boolean', writer: 'logic', initial: true}, revision: {type: 'number', writer: 'logic', initial: 1},
    sections: {type: 'list', writer: 'logic', initial: [{id: 'main'}, {id: 'access'}]}, current: {type: 'string', writer: 'tabs'}},
  roles: {
    search: {part: 't-input', bind: {'values.value': 'query', 'settings.items': 'sections'}},
    send: {part: 't-button'},
    inn: {part: 't-input', if: 'company', settings: {name: 'inn'}},
    memo: {part: 't-input', hidden: 'note'},
    tabs: {part: 't-tabs', bind: {'settings.items': 'sections', 'values.selected': 'current'}},
    section: {part: 't-section', each: 'sections', start: 'opened', bind: {'settings.group': 'entry.id', 'settings.revision': 'revision'}},
  },
  rules: [
    {id: 'r-send', on: 'send.press', steps: [{add: 'total', by: {value: 1}}, {set: 'company', to: {value: true}}, {emit: 'sent', with: {query: {key: 'query'}}}]},
    {id: 'r-close', on: 'send.close', if: {left: {key: 'dirty'}, op: 'yes'}, steps: [{refuse: {reason: {value: 'unsaved'}}}]},
    {id: 'r-outside', on: 'outside.send', steps: [{do: 'search.clear'}, {set: 'note', to: {value: false}}]},
  ],
}, {
  layouts: {
    default: '<h2>{{title}}: {{total}}</h2><x-role name="search"></x-role><x-role name="send"></x-role><section if="company"><x-role name="inn"></x-role></section><x-role name="memo"></x-role><x-role name="tabs"><div role="tabpanel"><x-role name="section"></x-role></div></x-role>',
    compact: '<x-role name="tabs"></x-role><x-role name="search"></x-role><x-role name="send"></x-role><x-role name="inn"></x-role><x-role name="memo"></x-role><x-role name="section"></x-role>',
  },
  lang: {ru: {values: {total: 'Всего'}, roles: {send: {settings: {text: 'Отправить'}}}}},
});
// Parts whose code is fetched: the Loader is a stand-in that imports
// /parts/<tag>.mjs, so every fetch is a request the test sees.
window.SF = {Loader: {ensureSmartElementLoaded(tag) { import('/parts/' + tag + '.mjs'); }}};
Assembly.interfaces.registerAll({
  't-late': {version: '1.0.0', settings: {}, values: {}, events: {}, actions: {}},
  't-side': {version: '1.0.0', settings: {}, values: {}, events: {}, actions: {}},
  't-later': {version: '1.0.0', settings: {}, values: {}, events: {}, actions: {}},
});
Assembly.define({
  tag: 't-lazy', kind: 'assembly', settings: {}, values: {}, events: {}, actions: {},
  keys: {open: {type: 'boolean', writer: 'logic', initial: false}},
  roles: {panel: {part: 't-late', if: 'open'}, side: {part: 't-side'}, later: {part: 't-later', start: 'opened'}},
  rules: [],
}, {
  layouts: {default: '<x-role name="panel"></x-role><section if="open"><x-role name="side"></x-role></section><div class="closed" hidden><x-role name="later"></x-role></div>'},
});
window.__ready = true;
</script></body></html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/' || url.pathname === '/index.html') { res.writeHead(200, {'content-type': TYPES['.html']}); res.end(page); return; }
  const lazy = /^\/parts\/(t-[a-z]+)\.mjs$/.exec(url.pathname);
  if (lazy) { res.writeHead(200, {'content-type': TYPES['.mjs']}); res.end(`customElements.define('${lazy[1]}', class extends HTMLElement {});`); return; }
  const file = join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, {'content-type': TYPES[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'}); res.end(await readFile(file)); } catch { res.writeHead(404).end(); }
});
const port = await new Promise((done) => server.listen(0, () => done(server.address().port)));
const browser = await chromium.launch();
const failures = [];
const check = (name, pass, detail = '') => { if (!pass) failures.push(`${name}${detail ? ` — ${detail}` : ''}`); };
try {
  const tab = await browser.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  await tab.goto(`http://localhost:${port}/`);
  await tab.waitForFunction(() => window.__ready);
  await tab.evaluate(async () => {
    window.heard = [];
    for (const name of ['t-form-sent', 't-button-press', 'change', 'sf-component-error']) document.addEventListener(name, (event) => window.heard.push(`${name}:${event.target.localName}`));
    const form = document.createElement('t-form');
    form.id = 'f';
    document.getElementById('stage').append(form);
    await window.Assembly.whenIdle();
  });
  const first = await tab.evaluate(() => {
    const form = document.getElementById('f');
    const part = (role) => form.querySelector(`[data-sf-role="${role}"]`);
    return {
      heading: form.querySelector('h2').textContent,
      placed: ['search', 'send', 'tabs', 'memo'].every((role) => part(role)?.parentElement?.matches(`x-role[name="${role}"]`)),
      buttonText: part('send').getAttribute('text'),
      innOut: !form.querySelector('[data-sf-role="inn"]')?.isConnected && !form.querySelector('section'),
      memoHidden: form.querySelector('x-role[name="memo"]').hidden && part('memo').querySelector('input').disabled === true,
      panels: [...part('tabs').children].filter((one) => one.getAttribute('role') === 'tabpanel').map((one) => [one.dataset.entry, one.hidden]),
      started: [...form.querySelectorAll('t-section')].map((one) => [one.dataset.sfRole, one.hasAttribute('data-sf-started'), one.getAttribute('aria-busy')]),
      items: part('search').dataset.items,
      instance: form.getAttribute('data-sf-instance'),
    };
  });
  check('a layout shows {{key}}', first.heading === 'Форма: 0', first.heading);
  check('roles are placed in their <x-role>', first.placed);
  check('a constant word setting comes from the language file', first.buttonText === 'Отправить', first.buttonText);
  check('if: the part and its layout element are out of the DOM', first.innOut);
  check('hidden: the place is hidden, its controls disabled', first.memoHidden);
  check('a panel repeats per entry inside the container, in entry order', JSON.stringify(first.panels.map(([id]) => id)) === '["main","access"]', JSON.stringify(first.panels));
  check('the container opened the first panel', JSON.stringify(first.panels.map(([, hidden]) => hidden)) === '[false,true]', JSON.stringify(first.panels));
  check('only the part in the open panel started', JSON.stringify(first.started) === '[["section[main]",true,null],["section[access]",false,"true"]]', JSON.stringify(first.started));
  check('a list setting arrives as a property', first.items === '2');
  check('the instance id is its role path', first.instance === 'page/f');

  // A person types: the native change carries the value into the key and out.
  await tab.fill('[data-sf-role="search"] input', 'abc');
  await tab.evaluate(() => window.Assembly.whenIdle());
  const typed = await tab.evaluate(() => ({query: document.getElementById('f').query, heard: [...window.heard]}));
  check('a value is read from the part on its event and written by its role', typed.query === 'abc', typed.query);
  check('the page hears the assembly\'s change and the control\'s native change', typed.heard.filter((one) => one.startsWith('change')).sort().join() === 'change:t-form,change:t-input', typed.heard.join());

  // A press: a rule, an emit; the part's event stops at the frame; the live region speaks.
  await tab.click('[data-sf-role="send"] button');
  await tab.evaluate(() => window.Assembly.whenIdle());
  const pressed = await tab.evaluate(() => {
    const form = document.getElementById('f');
    return {heard: [...window.heard], heading: form.querySelector('h2').textContent, live: form.querySelector('[data-sf-announce]').textContent,
      inn: form.querySelector('[data-sf-role="inn"]')?.parentElement?.parentElement?.localName, address: location.search};
  });
  check('the part\'s own event did not cross the frame', !pressed.heard.includes('t-button-press:t-button'), pressed.heard.join());
  check('the assembly\'s event reached the page', pressed.heard.includes('t-form-sent:t-form'), pressed.heard.join());
  check('a key shown in the layout follows', pressed.heading === 'Форма: 1', pressed.heading);
  check('the live region announces the value with its word', pressed.live === 'Всего: 1', pressed.live);
  check('if: the same part returns with its layout element', pressed.inn === 'section', String(pressed.inn));
  check('persist url: the key is in the address', pressed.address.includes('company=true'), pressed.address);

  // A cancelable request refused by a rule.
  const refused = await tab.evaluate(() => document.querySelector('[data-sf-role="send"]').close());
  check('refuse reaches the cancelable request at once', refused.answer === 'refused', JSON.stringify(refused));

  // An action from outside through its generated method; a method of today's component; hidden turns off.
  await tab.evaluate(() => document.getElementById('f').send());
  await tab.evaluate(() => window.Assembly.whenIdle());
  const acted = await tab.evaluate(() => ({value: document.querySelector('[data-sf-role="search"]').value, memo: document.querySelector('x-role[name="memo"]').hidden,
    enabled: document.querySelector('[data-sf-role="memo"] input').disabled === false}));
  check('a rule asks a method of today\'s component', acted.value === '', acted.value);
  check('hidden returns the part and enables its controls again', acted.memo === false && acted.enabled);

  // Opening a tab starts its part; a started part behind a closed tab defers its reads.
  await tab.evaluate(() => document.querySelector('t-tabs').pick('access'));
  await tab.evaluate(() => window.Assembly.whenIdle());
  await tab.waitForFunction(() => document.querySelector('[data-sf-role="section[access]"]').hasAttribute('data-sf-started'), null, {timeout: 3000}).catch(() => {});
  const opened = await tab.evaluate(() => ({started: document.querySelector('[data-sf-role="section[access]"]').hasAttribute('data-sf-started'), current: document.getElementById('f').sfCore.keys.current}));
  check('a part starts when its panel opens', opened.started);
  check('the container\'s value is written by its role', opened.current === 'access', opened.current);
  const deferred = await tab.evaluate(async () => {
    const core = document.getElementById('f').sfCore;
    const main = document.querySelector('[data-sf-role="section[main]"]');
    const before = main.reads;
    for (const revision of [2, 3, 4]) {
      const turn = core.newTurn('test', {});
      turn.writes.set('revision', {value: revision, writer: 'logic'});
      core.commit(turn);
      await new Promise((done) => setTimeout(done, 0));
    }
    const behind = main.reads - before;
    const busy = main.getAttribute('aria-busy');
    document.querySelector('t-tabs').pick('main');
    await new Promise((done) => setTimeout(done, 20));
    return {behind, busy, after: main.reads - before, revision: main.revision, idle: main.getAttribute('aria-busy')};
  });
  check('a part behind a closed panel reads nothing meanwhile, marked busy', deferred.behind === 0 && deferred.busy === 'true', JSON.stringify(deferred));
  check('it reads once, with the current value, when it opens', deferred.after === 1 && deferred.revision === 4 && deferred.idle === null, JSON.stringify(deferred));

  // A layout switch moves the parts with their state.
  const switched = await tab.evaluate(() => {
    const form = document.getElementById('f');
    const search = form.querySelector('[data-sf-role="search"]');
    form.layout = 'compact';
    return {same: form.querySelector('[data-sf-role="search"]') === search, value: search.value, layout: form.querySelector('[data-sf-layout]').getAttribute('data-sf-layout'), first: form.querySelector('[data-sf-layout] > x-role').getAttribute('name')};
  });
  check('a layout switch keeps the part and its state', switched.same && switched.layout === 'compact' && switched.first === 'tabs', JSON.stringify(switched));

  // Back restores a key kept in the address.
  await tab.goBack();
  await tab.evaluate(() => window.Assembly.whenIdle());
  const back = await tab.evaluate(() => document.getElementById('f').sfCore.keys.company);
  check('Back restores the key', back === false, String(back));

  // An undeclared setting is an error the page hears; taking the assembly out ends its scope.
  const ended = await tab.evaluate(async () => {
    const form = document.getElementById('f');
    form.sfCore.setSetting('missing', 1);
    const core = form.sfCore;
    const signal = core.partsOf('search')[0].context.signal;
    form.remove();
    await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));
    return {error: window.heard.includes('sf-component-error:t-form'), aborted: signal.aborted, disposed: core.disposed, instances: window.Assembly.instances()};
  });
  check('an error reaches the page as sf-component-error', ended.error);
  check('taken out of the page, the instance\'s scope ends', ended.aborted && ended.disposed && !ended.instances.includes('page/f'), JSON.stringify(ended));

  // Code is fetched for a part that starts, never for one its `if` holds or a
  // closed container hides (§7.2.1; stand 24 F1).
  const fetched = [];
  tab.on('request', (request) => { const path = new URL(request.url()).pathname; if (path.startsWith('/parts/')) fetched.push(path); });
  await tab.evaluate(async () => {
    const lazy = document.createElement('t-lazy');
    lazy.id = 'lazy';
    document.getElementById('stage').append(lazy);
    await window.Assembly.whenIdle();
    await new Promise((done) => setTimeout(done, 100));
  });
  const held = await tab.evaluate(() => {
    const parts = window.Assembly.instances().includes('page/lazy') && document.getElementById('lazy').sfCore;
    return {started: ['panel', 'side', 'later'].map((role) => parts.partsOf(role)[0]?.started), marked: parts.partsOf('panel')[0]?.element.hasAttribute('data-sf-start')};
  });
  check('if false: the part is placed, not started, and marked unstarted for the Loader', JSON.stringify(held.started) === '[false,false,false]' && held.marked, JSON.stringify(held));
  check('no code is fetched for a part under a false if or in a closed container', fetched.length === 0, fetched.join(', '));
  await tab.evaluate(async () => {
    const core = document.getElementById('lazy').sfCore;
    const turn = core.newTurn('test', {});
    turn.writes.set('open', {value: true, writer: 'logic'});
    core.commit(turn);
    await window.Assembly.whenIdle();
  });
  await tab.waitForFunction(() => customElements.get('t-late') && customElements.get('t-side'), null, {timeout: 3000}).catch(() => {});
  const shown = await tab.evaluate(() => ({started: ['panel', 'side', 'later'].map((role) => document.getElementById('lazy').sfCore.partsOf(role)[0]?.started),
    busy: document.querySelector('t-late').getAttribute('aria-busy'), mark: document.querySelector('t-late').hasAttribute('data-sf-started')}));
  check('the first true if starts the part and fetches its code once', JSON.stringify(shown.started) === '[true,true,false]' && shown.busy === null && shown.mark
    && JSON.stringify([...fetched].sort()) === '["/parts/t-late.mjs","/parts/t-side.mjs"]', `${JSON.stringify(shown)} ${fetched.join(', ')}`);
  await tab.evaluate(() => { document.querySelector('#lazy .closed').hidden = false; });
  await tab.waitForFunction(() => customElements.get('t-later'), null, {timeout: 3000}).catch(() => {});
  check('a closed container fetches its part\'s code when it opens', fetched.filter((one) => one === '/parts/t-later.mjs').length === 1, fetched.join(', '));
  await tab.evaluate(async () => {
    const core = document.getElementById('lazy').sfCore;
    for (const value of [false, true]) {
      const turn = core.newTurn('test', {});
      turn.writes.set('open', {value, writer: 'logic'});
      core.commit(turn);
      await window.Assembly.whenIdle();
    }
  });
  check('a part shown again fetches nothing', fetched.length === 3, fetched.join(', '));

  check('no page errors', errors.length === 0, errors.join('; '));
  const journal = await tab.evaluate(() => window.Assembly.journal.entries().filter((entry) => entry.level === 'error').map((entry) => entry.text));
  check('the journal has the one error the test caused', journal.length === 1 && /no setting "missing"/.test(journal[0]), journal.join('; '));
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(`assembly runtime: ${failures.length} failure(s)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('assembly runtime: all checks passed');
