#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// Code block rows for a page that writes them at build time (component.highlight
// 1.10.0; DEV letter msg-dd9ece44, Docara PR 72), on the built bytes through the
// Loader, at 1440 and 390, light and dark:
//   - rows written by hand with the mark classes (sf-code-line--added, --removed,
//     --highlight, --focus, --prompt, --output) draw as the runtime's rows of the
//     same marks: the same fill, the same sign and prompt glyph, the same ink of
//     the output, and the runtime's rows carry those classes;
//   - data-lines="40" numbers a region from 40; data-start wins over it; a
//     region from 998 to 1003 keeps every row's code at one x;
//   - rows 1 to 10 keep their code at one x (the number column held under
//     two digits with its room);
//   - a line marker (// [!code ++]) reaches the highlighter: the boot script
//     hid it in a comment while the page was parsed;
//   - data-title (C285) is the head's name in place of the language.
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
if (!existsSync(join(out, 'core', 'core', 'js', 'core.js'))) throw new Error(`no core.js under ${out}`);

const row = (cls, number, parts, content, copy = '') => `<span class="sf-code-line${cls ? ` ${cls}` : ''}"${copy}><span class="sf-code-line__number" aria-hidden="true">${number}</span>${parts}<span class="sf-code-line__content">${content}</span></span>`;
const sign = '<span class="sf-code-line__sign" aria-hidden="true"></span>';
const state = (word) => `<span class="sf-code-line__state">${word}: </span>`;
// Hand-written rows as Docara writes them: no white space between spans.
const authored = `<div class="sf-highlight sf-code-surface" data-sf-highlight-chrome="static" id="authored"><div class="sf-code-surface__scroll"><pre><code data-highlighted="yes"><span class="sf-code-lines sf-code-lines--diff" role="presentation">${[
  row('', 1, sign, 'a()'),
  row('sf-code-line--removed', 2, sign + state('removed'), 'b()', ' data-copy="false"'),
  row('sf-code-line--added', 3, sign + state('added'), 'c()'),
  row('sf-code-line--highlight', 4, sign, 'd()'),
  row('sf-code-line--focus', 5, sign, 'e()'),
].join('')}</span></code></pre></div></div>
<div class="sf-highlight sf-code-surface" data-sf-highlight-chrome="static" id="authored-terminal"><div class="sf-code-surface__scroll"><pre><code data-highlighted="yes"><span class="sf-code-lines" role="presentation">${[
  row('sf-code-line--prompt', 1, '<span class="sf-code-line__prompt" aria-hidden="true"></span>', 'npm i'),
  row('sf-code-line--output', 2, '', 'added 1 package', ' data-copy="false"'),
].join('')}</span></code></pre></div></div>`;
const runtime = `<pre><code id="runtime" data-lang="js" data-lines data-mark="4" data-focus="5">a()
b() // [!code --]
c() // [!code ++]
d()
e()</code></pre><script>window.__raw = document.getElementById('runtime').textContent;</script>
<pre><code id="runtime-terminal" data-lang="bash" data-lines data-frame="terminal">$ npm i
added 1 package</code></pre>
<pre><code id="from-40" data-lang="js" data-lines="40">x
y</code></pre>
<pre data-lines="40"><code id="start-wins" data-lang="js" data-start="7">x</code></pre>
<pre><code id="wide" data-lang="js" data-lines data-start="998">a
b
c
d
e
f</code></pre>
<pre><code id="ten" data-lang="js" data-lines>${Array.from({length: 10}, (_, i) => `l${i + 1}`).join('\n')}</code></pre>
<pre><code id="titled" data-lang="php" data-title="config/app.php">return [];</code></pre>`;
const page = (theme) => `<!doctype html><html lang="en" class="theme-${theme}"><head>
<meta charset="utf-8"><title>highlight rows ${theme}</title>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<script src="/distr/core/js/core.js"></script></head><body class="p-2">${runtime}${authored}</body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'};
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  const theme = /^\/(light|dark)$/u.exec(path);
  if (theme) {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(theme[1]));
  }
  for (const [prefix, dir] of mounts) {
    if (!path.startsWith(prefix)) continue;
    const file = resolve(dir, path.slice(prefix.length));
    if (!file.startsWith(dir + sep)) break;
    try {
      const body = await readFile(file);
      const ext = file.slice(file.lastIndexOf('.'));
      response.writeHead(200, {'content-type': `${types[ext] ?? 'application/octet-stream'}${ext === '.js' || ext === '.css' ? '; charset=utf-8' : ''}`});
      return response.end(body);
    } catch { break; }
  }
  response.writeHead(404);
  response.end();
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

const measure = () => {
  const rowsOf = (id) => [...document.querySelectorAll(`#${id} .sf-code-line`)];
  const look = (line) => {
    const style = getComputedStyle(line);
    const sign = line.querySelector('.sf-code-line__sign');
    const prompt = line.querySelector('.sf-code-line__prompt');
    const content = line.querySelector('.sf-code-line__content');
    return {
      classes: line.className,
      background: style.backgroundImage + ' | ' + style.backgroundColor,
      sign: sign ? getComputedStyle(sign, '::before').content + ' ' + getComputedStyle(sign, '::before').color : null,
      prompt: prompt ? getComputedStyle(prompt, '::before').content + ' ' + getComputedStyle(prompt, '::before').color : null,
      ink: getComputedStyle(content).color,
      indent: getComputedStyle(content).paddingInlineStart,
      height: Math.round(line.getBoundingClientRect().height),
    };
  };
  const numbers = (id) => rowsOf(id).map((line) => line.querySelector('.sf-code-line__number')?.textContent);
  const starts = (id) => rowsOf(id).map((line) => Math.round(line.querySelector('.sf-code-line__content').getBoundingClientRect().left * 10) / 10);
  return {
    runtime: rowsOf('runtime').map(look),
    authored: rowsOf('authored').map(look),
    runtimeTerminal: rowsOf('runtime-terminal').map(look),
    authoredTerminal: rowsOf('authored-terminal').map(look),
    from40: numbers('from-40'),
    startWins: numbers('start-wins'),
    wide: numbers('wide'),
    wideStarts: starts('wide'),
    tenStarts: starts('ten'),
    raw: window.__raw ?? null,
    title: document.querySelector('#titled')?.closest('.sf-highlight')?.querySelector('.sf-highlight__language')?.textContent ?? null,
    authoredHeight: Math.round(document.querySelector('#authored code').getBoundingClientRect().height),
  };
};

const failures = [];
const report = {};
const browser = await chromium.launch({headless: true, channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars']});
try {
  for (const width of [1440, 390]) {
    for (const theme of ['light', 'dark']) {
      // The boot script sets the theme class from the system preference.
      const context = await browser.newContext({viewport: {width, height: 900}, colorScheme: theme});
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', (error) => errors.push(error.message));
      tab.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/u.test(message.text())) errors.push(message.text()); });
      tab.on('response', (response) => { if (response.status() >= 400 && !/favicon/u.test(response.url())) errors.push(`${response.status()} ${response.url()}`); });
      await tab.goto(`http://127.0.0.1:${server.address().port}/${theme}`);
      await tab.waitForFunction(() => ['runtime', 'runtime-terminal', 'wide', 'from-40', 'start-wins'].every((id) => document.querySelector(`#${id} .sf-code-line`))
        && document.querySelector('#titled')?.closest('.sf-highlight')?.querySelector('.sf-highlight__language'), null, {timeout: 15000}).catch(() => {});
      await tab.waitForTimeout(300);
      const seen = await tab.evaluate(measure);
      const key = `${width}-${theme}`;
      report[key] = {...seen, errors};
      const fail = (text) => failures.push(`${key}: ${text}`);
      if (errors.length) fail(`console: ${errors.join(' | ')}`);
      const want = ['', 'sf-code-line--removed', 'sf-code-line--added', 'sf-code-line--highlight', 'sf-code-line--focus'];
      seen.runtime.forEach((line, index) => {
        if (!line.classes.split(' ').includes(want[index] || 'sf-code-line')) fail(`runtime row ${index + 1} classes ${line.classes}`);
      });
      if (seen.runtime.length !== 5 || seen.authored.length !== 5) fail(`rows ${seen.runtime.length}/${seen.authored.length}`);
      for (let index = 0; index < 5; index++) {
        const [a, b] = [seen.runtime[index], seen.authored[index]];
        if (!a || !b) continue;
        for (const prop of ['background', 'sign', 'height']) if (a[prop] !== b[prop]) fail(`row ${index + 1} ${prop}: runtime ${a[prop]} / authored ${b[prop]}`);
      }
      if (seen.authored[1]?.background === seen.authored[0]?.background) fail('removed row has no tint');
      if (seen.authored[2]?.background === seen.authored[0]?.background) fail('added row has no tint');
      if (seen.authored[3]?.background === seen.authored[0]?.background) fail('highlight row has no fill');
      if (seen.authored[4]?.background !== seen.authored[3]?.background) fail('focus row is not drawn as highlight');
      if (!/\+/u.test(seen.authored[2]?.sign ?? '') || !/−/u.test(seen.authored[1]?.sign ?? '')) fail(`signs ${seen.authored[2]?.sign} / ${seen.authored[1]?.sign}`);
      const [rp, ro] = seen.runtimeTerminal;
      const [ap, ao] = seen.authoredTerminal;
      if (!rp?.classes.includes('sf-code-line--prompt') || !ro?.classes.includes('sf-code-line--output')) fail(`terminal classes ${rp?.classes} / ${ro?.classes}`);
      if (rp?.prompt !== ap?.prompt || !/\$/u.test(ap?.prompt ?? '')) fail(`prompt ${rp?.prompt} / ${ap?.prompt}`);
      if (ro?.ink !== ao?.ink || ro?.indent !== ao?.indent) fail(`output ink/indent ${ro?.ink} ${ro?.indent} / ${ao?.ink} ${ao?.indent}`);
      if (ao?.ink === ap?.ink) fail('output has the command ink');
      if (seen.from40.join() !== '40,41') fail(`data-lines="40" -> ${seen.from40}`);
      if (seen.startWins.join() !== '7') fail(`data-start over data-lines -> ${seen.startWins}`);
      if (seen.wide.join() !== '998,999,1000,1001,1002,1003') fail(`wide -> ${seen.wide}`);
      if (new Set(seen.wideStarts).size !== 1) fail(`wide rows start at ${seen.wideStarts}`);
      if (new Set(seen.tenStarts).size !== 1) fail(`rows 1-10 start at ${seen.tenStarts}`);
      // The boot script leaves a code block's markers to the highlighter.
      if (!/\[!code --\]/u.test(seen.raw ?? '')) fail(`markers hidden before the highlighter: ${JSON.stringify(seen.raw)}`);
      report[key].dark = await tab.evaluate(() => document.documentElement.classList.contains('theme-dark'));
      if (report[key].dark !== (theme === 'dark')) fail(`theme ${theme} not applied`);
      if (seen.title !== 'config/app.php') fail(`title ${seen.title}`);
      if (seen.authoredHeight !== seen.authored.reduce((sum, line) => sum + line.height, 0)) fail(`authored code ${seen.authoredHeight} vs rows`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(report));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('HIGHLIGHT_LINE_CLASSES_OK');
