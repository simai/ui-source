// A build output served the way a site serves the distribution (/distr/<part>/...),
// with one page the probe writes, in UTF-8, and the browser every release probe
// uses: headless Chrome that draws scroll bars as a person's does. For the
// probes of the view set orders (FO-1..FO-5), which load each page at 1440 and
// 390, light and dark, several times over.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {extname, join} from 'node:path';

const TYPES = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html', '.png': 'image/png'};

/** Serves a build root: {base, page(html) -> url, close()}. */
export async function serveBuild(out) {
  const parts = {
    core: join(out, 'core', 'core'),
    rule: join(out, 'core', 'rule'),
    component: join(out, 'component', 'component'),
    smart: join(out, 'smart', 'smart'),
    utility: join(out, 'utility', 'utility'),
  };
  const pages = new Map();
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
    if (path === '/favicon.ico') {
      response.writeHead(204);
      return response.end();
    }
    if (pages.has(path)) {
      response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
      return response.end(pages.get(path));
    }
    const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
    const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
    if (!file || !existsSync(file) || statSync(file).isDirectory()) {
      response.writeHead(404);
      return response.end();
    }
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    response.writeHead(200, {
      'content-type': /^(text|application\/json|image\/svg)/u.test(type) ? `${type}; charset=utf-8` : type,
      'access-control-allow-origin': '*',
    });
    return response.end(readFileSync(file));
  }).listen(0, '127.0.0.1');
  await new Promise((settle) => server.once('listening', settle));
  const base = `http://127.0.0.1:${server.address().port}`;
  let counter = 0;
  return {
    base,
    page(html) {
      counter += 1;
      const path = `/page-${counter}`;
      pages.set(path, html);
      return `${base}${path}`;
    },
    close: () => new Promise((settle) => server.close(settle)),
  };
}

/** A page in Russian on the distribution: the language file before core, core.css, the Loader. */
export function russianPage({theme = 'light', head = '', body = ''} = {}) {
  return `<!doctype html><html lang="ru" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';window.SF_BOOT_CONFIG={preloader:{enabled:false}};</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/lang/ru.js"></script>
<script src="/distr/core/js/core.js"></script>
<style>body{margin:0;background:var(--sf-surface-0);color:var(--sf-on-surface)}main{box-sizing:border-box;padding:16px;max-inline-size:100%}</style>
${head}</head><body>${body}</body></html>`;
}

/** Headless Chrome, scroll bars drawn as a person sees them. */
export function launchBrowser(chromium) {
  return chromium.launch({headless: true, channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars']});
}

/** The page's errors, warnings, failed requests and uncaught exceptions, as they come. */
export function watchConsole(tab) {
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`);
  });
  tab.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  return errors;
}

/** Every case of a probe: 1440 and 390, light and dark. */
export const CASES = [1440, 390].flatMap((width) => ['light', 'dark'].map((theme) => ({width, theme})));

/** A results list that prints PASS / FAIL lines and sets the exit code. */
export function results() {
  const list = [];
  return {
    ok(name, pass, detail = '') {
      list.push({name, pass: Boolean(pass), detail: typeof detail === 'string' ? detail : JSON.stringify(detail)});
    },
    report() {
      for (const one of list) console.log(`${one.pass ? 'PASS' : 'FAIL'} ${one.name}${one.pass ? '' : `  ${one.detail}`}`);
      console.log(`${list.filter((one) => one.pass).length}/${list.length} passed`);
      if (list.some((one) => !one.pass)) process.exitCode = 1;
    },
  };
}
