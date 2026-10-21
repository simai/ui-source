#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Anchored badges with many copies of the badges script (simai/ui-source#12
// follow-up). The released pair crashed a tab: the Loader inserted a
// dependency's script once per plugin naming it -- sf-avatar, sf-icon,
// sf-icon-button and sf-badge all name badges -- and each copy of the
// anchored-badge runtime ran its own observer and remembered its own writes,
// so each took another copy's name for the author's and appended
// «, 3 непрочитанных» again, without end.
//
// The page loads through the real Loader: class-based anchored badges in an
// aria-labelled link, an aria-labelled button, an .sf-avatar and an
// .sf-badge-anchor, beside <sf-avatar>, <sf-icon>, <sf-icon-button> and
// <sf-badge> with their own badge inputs (four plugins that name badges --
// the owner docs thread's reproduction is this mix). Then the badges script is
// injected twice more by hand. What it holds:
//   1. the Loader inserts the badges script and sheet once each, however
//      many plugins ask, and asking again inserts nothing;
//   2. one anchored-badge observer runs, whatever number of copies ran;
//   3. the names are right («Входящие, 3 непрочитанных») -- the aria-label
//      attributes and the names the browser computes -- and stable for 3 s:
//      no attribute is written once they settle;
//   4. a changed data-count rewrites the name once; 0 gives the original back;
//      a badge taken out gives it back too; the tab stays alive throughout;
//   5. a compact admin menu keeps its items' words and initials readable:
//      «Пользователи», «Настройки сайта», and the favourites button reads
//      «Избранное», not "star".
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const mounts = [
  ['/distr/core/', join(out, 'core', 'core')],
  ['/distr/rule/', join(out, 'core', 'rule')],
  ['/distr/component/', join(out, 'component', 'component')],
  ['/distr/utility/', join(out, 'utility', 'utility')],
  ['/distr/smart/', join(out, 'smart', 'smart')],
];
const absent = [join(out, 'core', 'core', 'js', 'core.js'), join(out, 'core', 'core', 'css', 'core.css'),
  join(out, 'component', 'component', 'badges', 'js', 'badges.js')].filter((path) => !existsSync(path));
if (absent.length) throw new Error(`asset(s) not found: ${absent.join(', ')}`);

// Before anything runs: every observer that watches badge counts is counted,
// and every aria-label write. A runaway is stopped after WRITE_CAP writes, so
// a defective build reports numbers instead of hanging the probe.
const WRITE_CAP = 20000;
const instrument = `<script>
  window.__badgeProbe = {observers: 0, labelWrites: 0, capped: false};
  (() => {
    const observe = MutationObserver.prototype.observe;
    MutationObserver.prototype.observe = function (target, options) {
      if (options && Array.isArray(options.attributeFilter) && options.attributeFilter.includes('data-count')) window.__badgeProbe.observers++;
      return observe.call(this, target, options);
    };
    const set = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if (name === 'aria-label') {
        const probe = window.__badgeProbe;
        if (++probe.labelWrites > ${WRITE_CAP}) { probe.capped = true; throw new Error('aria-label write cap reached'); }
      }
      return set.call(this, name, value);
    };
  })();
</script>`;

const badge = (count = 3) => `<span class="sf-badge sf-badge--anchored" data-count="${count}"></span>`;
const page = `<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"><title>anchored badges, many copies</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
${instrument}
<script>
  window.sfPath = '/distr/';
  window.SF_BOOT_CONFIG = {cacheVersion: 'anchored-badges-copies', pluginListVersion: 'anchored-badges-copies',
    preloader: {enabled: false}, icons: {enabled: false}, smart: {base: true}, theme: false};
</script></head><body style="margin:16px">
<div id="fixture" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
  <a id="link" href="#inbox" aria-label="Входящие" style="position:relative;display:inline-flex"><i class="sf-icon" aria-hidden="true">mail</i>${badge()}</a>
  <button id="button" type="button" class="sf-icon-button sf-icon-button--icon sf-icon-button--tonal sf-icon-button--primary sf-icon-button--size-1 flex items-cross-center" aria-label="Входящие"><i class="sf-icon" aria-hidden="true">inbox</i>${badge()}</button>
  <span id="avatar" class="sf-avatar sf-avatar--size-2 sf-avatar--text inline-flex items-cross-center content-main-center" role="img" aria-label="Входящие"><span class="sf-avatar-text" aria-hidden="true">ВХ</span>${badge()}</span>
  <span id="anchor" class="sf-badge-anchor sf-badge-anchor--size-1 sf-badge-anchor--round" role="img" aria-label="Почта"><i class="sf-icon sf-icon--size-3" aria-hidden="true">mail</i>${badge()}</span>
  <sf-avatar id="s-avatar" size="2" text="АБ" aria-label="Анна Белова" badge-count="3"></sf-avatar>
  <sf-icon id="s-icon" icon="mail" label="Почта" badge-count="3"></sf-icon>
  <sf-icon-button id="s-button" icon="notifications" aria-label="Уведомления" badge-count="5"></sf-icon-button>
  <sf-badge id="s-badge" text="Новое"></sf-badge>
</div>
<script src="/distr/core/js/core.js"></script></body></html>`;

const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8'};
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/page.html') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page);
  }
  const mount = mounts.find(([prefix]) => path.startsWith(prefix));
  if (!mount) { response.writeHead(404); return response.end(); }
  const file = resolve(mount[1], path.slice(mount[0].length));
  if (!file.startsWith(mount[1] + sep)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    response.writeHead(200, {'content-type': types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'});
    response.end(body);
  } catch {
    response.writeHead(404); response.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
// A page that hangs is a failure with a name, not a stuck probe.
const within = (promise, ms, what) => Promise.race([promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${what}: no answer in ${ms} ms (the tab is stuck)`)), ms))]);
const nameOf = async (tab, selector) => {
  const snapshot = await within(tab.locator(selector).first().ariaSnapshot(), 10000, `name of ${selector}`);
  return snapshot.match(/"([^"]*)"/u)?.[1] ?? snapshot;
};
const LABELLED = ['link', 'button', 'avatar', 'anchor'];
const EXPECTED = {link: 'Входящие', button: 'Входящие', avatar: 'Входящие', anchor: 'Почта'};
const labels = (tab) => within(tab.evaluate((ids) => Object.fromEntries(ids.map((id) => [id, document.getElementById(id).getAttribute('aria-label')])), LABELLED), 10000, 'labels');

const browser = await chromium.launch();
try {
  const tab = await browser.newPage({viewport: {width: 1000, height: 700}});
  const errors = [];
  tab.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) errors.push(error.message); });
  let crashed = false;
  tab.on('crash', () => { crashed = true; });
  await tab.goto(`${base}/page.html`);
  await within(tab.waitForFunction(() => window.SF?.AnchoredBadge && customElements.get('sf-avatar') && customElements.get('sf-icon-button')
    && customElements.get('sf-icon') && customElements.get('sf-badge')
    && Object.values(window.SF ?? {}).some((one) => one && typeof one === 'object' && 'mutationObserver' in one && one.searchEnd), null, {timeout: 15000}), 20000, 'the page loads');
  await tab.waitForTimeout(500);

  // 1. What the Loader inserted, before anything is added by hand.
  const BADGES_JS = /\/component\/badges\/js\/badges(\.min)?\.js/u;
  const BADGES_CSS = /\/component\/badges\/css\/badges(\.min)?\.css/u;
  const inserted = await tab.evaluate(([js, css]) => {
    const group = (selector, attribute, pattern) => {
      const found = {};
      document.querySelectorAll(selector).forEach((node) => {
        const url = node.getAttribute(attribute);
        if (url && new RegExp(pattern).test(url)) found[node[attribute === 'src' ? 'src' : 'href']] = (found[node[attribute === 'src' ? 'src' : 'href']] || 0) + 1;
      });
      return found;
    };
    return {scripts: group('script[src]', 'src', js), sheets: group('link[rel="stylesheet"]', 'href', css)};
  }, [BADGES_JS.source, BADGES_CSS.source]);
  // The plugins that name badges: each asks the Loader for it.
  const askers = await tab.evaluate(() => {
    const loader = Object.values(window.SF).find((one) => one && typeof one === 'object' && 'mutationObserver' in one);
    // A rule on the page whose relations name badges, lazy or not.
    return Object.entries(loader.findPlugins || {})
      .filter(([, rule]) => (rule?.relation || []).some((one) => (one?.name ?? one) === 'badges'))
      .filter(([, rule]) => (rule.tags || []).some((tag) => document.querySelector(tag)))
      .map(([name]) => name);
  });
  evidence.loaderInserted = inserted;
  evidence.pluginsNamingBadges = askers;
  check('four or more plugins on the page name badges', askers.length >= 4, {askers});
  const scriptCounts = Object.values(inserted.scripts);
  check('the Loader inserts the badges script once', scriptCounts.length === 1 && scriptCounts[0] === 1, {inserted});
  const sheetCounts = Object.values(inserted.sheets);
  check('the Loader inserts the badges sheet once', sheetCounts.length === 1 && sheetCounts[0] === 1, {inserted});

  // Asking again inserts nothing: the same URL through addScript, and the
  // plugin by name.
  const again = await tab.evaluate(async (pattern) => {
    const loader = Object.values(window.SF).find((one) => one && typeof one === 'object' && 'mutationObserver' in one);
    const node = [...document.querySelectorAll('script[src]')].find((one) => new RegExp(pattern).test(one.getAttribute('src')));
    const url = node.getAttribute('src').replace(/[?&]sf_v=[^&#]*/u, '');
    const first = loader.addScript(url);
    const second = loader.addScript(url);
    await Promise.all([first, second]);
    loader.ensurePlugin?.('badges');
    await new Promise((done) => setTimeout(done, 300));
    return {samePromise: first === second, count: [...document.querySelectorAll('script[src]')].filter((one) => new RegExp(pattern).test(one.getAttribute('src'))).length};
  }, BADGES_JS.source);
  evidence.askedAgain = again;
  check('asking the Loader again for the same script inserts nothing', again.count === 1 && again.samePromise, again);

  // 2. Two more copies, by hand: the readable file, unversioned.
  await tab.evaluate(async () => {
    for (let i = 0; i < 2; i++) {
      await new Promise((done) => {
        const script = document.createElement('script');
        script.src = '/distr/component/badges/js/badges.js';
        script.addEventListener('load', done, {once: true});
        script.addEventListener('error', done, {once: true});
        document.head.append(script);
      });
    }
  });
  await tab.waitForTimeout(800);
  const copies = await tab.evaluate((pattern) => ({
    scriptElements: [...document.querySelectorAll('script[src]')].filter((one) => new RegExp(pattern).test(one.getAttribute('src'))).length,
    observers: window.__badgeProbe.observers,
    labelWrites: window.__badgeProbe.labelWrites,
    capped: window.__badgeProbe.capped,
  }), BADGES_JS.source);
  evidence.afterHandCopies = copies;
  check('three copies of the badges script ran (one Loader, two by hand)', copies.scriptElements === 3, copies);
  check('one anchored-badge observer runs, whatever number of copies ran', copies.observers === 1, copies);
  check('no runaway of aria-label writes', !copies.capped && copies.labelWrites < 50, copies);

  // 3. The names, and their stability for 3 s.
  const settled = await labels(tab);
  evidence.labels = settled;
  for (const id of LABELLED) {
    const want = `${EXPECTED[id]}, 3 непрочитанных`;
    check(`${id}: aria-label is «${want}»`, settled[id] === want, {got: settled[id]});
    const name = await nameOf(tab, `#${id}`);
    check(`${id}: the browser names it «${want}»`, name === want, {got: name});
  }
  const smartNames = {
    avatar: await nameOf(tab, '#s-avatar button'),
    iconButton: await nameOf(tab, '#s-button button'),
  };
  evidence.smartNames = smartNames;
  check('sf-avatar: «Анна Белова, 3 непрочитанных»', smartNames.avatar === 'Анна Белова, 3 непрочитанных', smartNames);
  check('sf-icon-button: «Уведомления, 5 непрочитанных»', smartNames.iconButton === 'Уведомления, 5 непрочитанных', smartNames);
  const stable = await within(tab.evaluate(async () => {
    const before = window.__badgeProbe.labelWrites;
    let records = 0;
    const counter = new MutationObserver((list) => { records += list.length; });
    counter.observe(document.getElementById('fixture'), {attributes: true, subtree: true, childList: true, characterData: true});
    await new Promise((done) => setTimeout(done, 3000));
    counter.disconnect();
    return {records, labelWrites: window.__badgeProbe.labelWrites - before};
  }), 15000, 'three quiet seconds');
  evidence.quietThreeSeconds = stable;
  check('nothing in the badges is written for 3 s after they settle', stable.records === 0 && stable.labelWrites === 0, stable);
  const after = await labels(tab);
  check('the names are the same after 3 s', JSON.stringify(after) === JSON.stringify(settled), {after, settled});

  // 4. A count that changes, 0, a badge taken out.
  const change = (id, count) => within(tab.evaluate(async ([id, count]) => {
    const owner = document.getElementById(id);
    let writes = 0;
    const counter = new MutationObserver((list) => { writes += list.filter((one) => one.attributeName === 'aria-label').length; });
    counter.observe(owner, {attributes: true, attributeFilter: ['aria-label']});
    owner.querySelector('.sf-badge').setAttribute('data-count', count);
    await new Promise((done) => setTimeout(done, 400));
    counter.disconnect();
    return {writes, label: owner.getAttribute('aria-label')};
  }, [id, count]), 10000, `data-count ${count} on ${id}`);
  for (const id of ['link', 'button', 'avatar']) {
    const seven = await change(id, '7');
    check(`${id}: data-count 7 rewrites the name once`, seven.writes === 1 && seven.label === `${EXPECTED[id]}, 7 непрочитанных`, seven);
    const zero = await change(id, '0');
    check(`${id}: data-count 0 gives the original name back, in one write`, zero.writes === 1 && zero.label === EXPECTED[id], zero);
    check(`${id}: the browser reads the original name at 0`, await nameOf(tab, `#${id}`) === EXPECTED[id]);
    const back = await change(id, '2');
    check(`${id}: a count again joins the name once`, back.writes === 1 && back.label === `${EXPECTED[id]}, 2 непрочитанных`, back);
    evidence[`${id} changes`] = {seven, zero, back};
  }
  const removed = await within(tab.evaluate(async () => {
    const owner = document.getElementById('anchor');
    owner.querySelector('.sf-badge').remove();
    await new Promise((done) => setTimeout(done, 400));
    return owner.getAttribute('aria-label');
  }), 10000, 'badge removal');
  check('a badge taken out gives its owner the original name', removed === 'Почта', {removed});
  const end = await tab.evaluate(() => ({...window.__badgeProbe}));
  evidence.final = end;
  check('the tab is alive', !crashed && !end.capped, {crashed, end});
  check('no page errors', errors.length === 0, {errors});
  await tab.close();

  // 5. The compact admin menu keeps its words for the accessibility tree.
  const menu = await browser.newPage({viewport: {width: 1000, height: 700}});
  await menu.setContent(`<!doctype html><html lang="ru" class="theme-light"><head><meta charset="utf-8"></head><body style="margin:16px">
    <section class="sf-admin-menu-panel small flex flex-col" id="panel"><nav class="sf-admin-menu-section sf-admin-menu-main" aria-label="Компактная панель"><ul class="p-0 m-0">
      <li class="sf-admin-menu-item-wrap flex flex-col"><a id="users" class="sf-admin-menu-item flex items-cross-center" href="#users"><span class="sf-admin-menu-item-container flex items-cross-center"><i class="sf-icon" aria-hidden="true">group</i><span>Пользователи</span></span></a></li>
      <li class="sf-admin-menu-item-wrap flex flex-col"><a id="site" class="sf-admin-menu-item flex items-cross-center" href="#site"><span class="sf-admin-menu-item-container flex items-cross-center"><span class="sf-admin-menu-item-placeholder flex items-cross-center content-main-center flex-none">НС</span><span class="sf-admin-menu-item-label">Настройки сайта</span></span></a></li>
      <li class="sf-admin-menu-item-wrap flex flex-col"><button id="favourites" type="button" class="sf-admin-menu-item flex-1 flex items-cross-center"><span class="sf-admin-menu-item-container flex items-cross-center flex-1"><i class="sf-icon" aria-hidden="true">star</i><span>Избранное</span></span></button></li>
    </ul></nav></section></body></html>`);
  for (const path of ['core/core/css/core.css', 'core/core/css/utility.full.css', 'component/component/icons/css/icons.css', 'component/component/badges/css/badges.css', 'component/component/admin-menu/css/admin-menu.css']) {
    await menu.addStyleTag({path: join(out, path)});
  }
  await menu.waitForTimeout(200);
  const names = {users: await nameOf(menu, '#users'), site: await nameOf(menu, '#site'), favourites: await nameOf(menu, '#favourites')};
  const boxes = await menu.evaluate(() => {
    const box = (selector) => { const r = document.querySelector(selector).getBoundingClientRect(); return {width: r.width, height: r.height}; };
    return {
      words: box('#users .sf-admin-menu-item-container > span'),
      label: box('#site .sf-admin-menu-item-label'),
      initials: box('#site .sf-admin-menu-item-placeholder'),
      initialsText: document.querySelector('#site .sf-admin-menu-item-placeholder').innerText,
    };
  });
  evidence.compactAdmin = {names, boxes};
  check('compact admin: an item reads its words', names.users === 'Пользователи', names);
  check('compact admin: an item with initials reads its words', /Настройки сайта/u.test(names.site), names);
  check('compact admin: the favourites button reads «Избранное»', names.favourites === 'Избранное', names);
  check('compact admin: the words are out of sight', boxes.words.width <= 1 && boxes.words.height <= 1 && boxes.label.width <= 1, boxes);
  check('compact admin: the initials stay visible as the avatar', boxes.initials.width >= 16 && boxes.initials.height >= 16 && boxes.initialsText === 'НС', boxes);
  await menu.close();
} catch (error) {
  failures.push({name: 'probe ran to the end', said: error.message});
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('ANCHORED_BADGES_COPIES_OK');
