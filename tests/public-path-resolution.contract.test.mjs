import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// The runtime resolves where it lives before anything else runs. Documentation
// renders its live examples inside a srcdoc frame, where location.href is
// `about:srcdoc` — a base against which no relative path resolves. Resolving
// sfPath against it threw, and the throw happened early enough that not one
// component ever registered: every example with JS-driven state rendered in its
// resting state, whatever the markup said.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'src/core/js/public-path.js'), 'utf8');

const run = ({ sfPath, href, baseURI, scripts = [], currentScript = null }) => {
  const window = { sfPath, location: href === null ? undefined : { href } };
  const document = { baseURI, scripts, currentScript };
  const warnings = [];
  const console = { warn: (message) => warnings.push(String(message)) };
  const body = `
    let __webpack_public_path__ = '';
    const window = arguments[0], document = arguments[1], console = arguments[2];
    ${source}
    return __webpack_public_path__;
  `;
  // eslint-disable-next-line no-new-func
  const publicPath = new Function(body)(window, document, console);
  return { publicPath, warnings, sfPath: window.sfPath };
};

const SRCDOC_BASE = 'https://ui-doc.test/_docara/examples/components/switch/overview/';

test('a root-relative path resolves inside a srcdoc frame', () => {
  const { publicPath: resolved } = run({
    sfPath: '/_docara/vendor/simai-framework/runtime/abc/distr/',
    href: 'about:srcdoc',
    baseURI: SRCDOC_BASE,
  });
  assert.equal(
    resolved,
    'https://ui-doc.test/_docara/vendor/simai-framework/runtime/abc/distr/core/',
    'the document base carries the origin that about:srcdoc does not',
  );
});

test('a relative path follows the document base', () => {
  const { publicPath: resolved } = run({
    sfPath: 'assets/ui/distr/',
    href: 'https://example.test/docs/page/',
    baseURI: 'https://example.test/docs/page/',
  });
  assert.equal(resolved, 'https://example.test/docs/page/assets/ui/distr/core/');
});

test('an absolute path is taken as it stands', () => {
  const { publicPath: resolved } = run({
    sfPath: 'https://cdn.example.test/ui/distr/',
    href: 'about:srcdoc',
    baseURI: SRCDOC_BASE,
  });
  assert.equal(resolved, 'https://cdn.example.test/ui/distr/core/');
});

test('the core script on the page wins over the configured path', () => {
  const { publicPath: resolved } = run({
    sfPath: '/wrong/distr/',
    href: 'about:srcdoc',
    baseURI: SRCDOC_BASE,
    scripts: [{ src: 'https://ui-doc.test/runtime/distr/core/js/core.js?sf_v=1' }],
  });
  assert.equal(resolved, 'https://ui-doc.test/runtime/distr/core/');
});

test('an unusable base never takes the runtime down with it', () => {
  const { publicPath: resolved } = run({
    sfPath: '/relative/only/',
    href: 'about:srcdoc',
    baseURI: 'about:srcdoc',
  });
  assert.match(
    resolved,
    /^https:\/\//u,
    'with no base that can resolve a relative path, the published default stands in',
  );
});

test('falling back to the published branch is said out loud', () => {
  const { warnings, sfPath } = run({
    sfPath: undefined,
    href: 'https://example.test/page/',
    baseURI: 'https://example.test/page/',
  });
  assert.equal(warnings.length, 1, 'one warning, not a stream of them');
  assert.match(warnings[0], /sfPath/u, 'it names the thing that was not set');
  assert.match(warnings[0], /cdn\.jsdelivr\.net\/gh\/simai\/ui@main/u, 'and where it went instead');
  assert.match(warnings[0], /unpinned/u, 'and why that is worth knowing');
  assert.match(
    warnings[0],
    /https:\/\/cdn\.jsdelivr\.net\/npm\/@simai-studio\/ui@<version>\/distr\//u,
    'and it recommends the npm form, pinned to a version (simai/ui-source#8)',
  );
  assert.doesNotMatch(warnings[0], /gh\/simai\/ui@<commit>/u, 'not the gh form that trips the size limit');
  assert.equal(sfPath, 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/', 'the page still runs');
});

const NPM_DISTR = 'https://cdn.jsdelivr.net/npm/@simai-studio/ui@5.20261019.1559/distr/';

test('without sfPath, Core loads its siblings from the distr it came from (simai/ui-source#8)', () => {
  const { warnings, sfPath, publicPath } = run({
    sfPath: undefined,
    href: 'https://example.test/page/',
    baseURI: 'https://example.test/page/',
    scripts: [{ src: `${NPM_DISTR}core/js/core.js` }],
  });
  assert.equal(sfPath, NPM_DISTR, 'the npm package version Core came from');
  assert.equal(publicPath, `${NPM_DISTR}core/`);
  assert.deepEqual(warnings, [], 'nothing to warn about: the runtime is pinned by its own URL');
});

test('the running script names the distr root even among other Core scripts', () => {
  const { sfPath } = run({
    sfPath: undefined,
    href: 'https://example.test/page/',
    baseURI: 'https://example.test/page/',
    currentScript: { src: `${NPM_DISTR}core/js/core.min.js?sf_v=1` },
    scripts: [{ src: '/other/distr/core/js/core.js' }],
  });
  assert.equal(sfPath, NPM_DISTR);
});

test('a relative Core script resolves against the document base', () => {
  const { sfPath, warnings } = run({
    sfPath: undefined,
    href: 'about:srcdoc',
    baseURI: SRCDOC_BASE,
    scripts: [{ src: '/vendor/ui/distr/core/js/core.js' }],
  });
  assert.equal(sfPath, 'https://ui-doc.test/vendor/ui/distr/');
  assert.deepEqual(warnings, []);
});

test('a running script that is not Core is not taken for the distr root', () => {
  const { sfPath, warnings } = run({
    sfPath: undefined,
    href: 'https://example.test/page/',
    baseURI: 'https://example.test/page/',
    currentScript: { src: 'https://example.test/assets/app.bundle.js' },
  });
  assert.equal(sfPath, 'https://cdn.jsdelivr.net/gh/simai/ui@main/distr/');
  assert.equal(warnings.length, 1);
});

test('a configured path says nothing', () => {
  const { warnings } = run({
    sfPath: '/assets/simai-framework/distr/',
    href: 'https://example.test/page/',
    baseURI: 'https://example.test/page/',
  });
  assert.deepEqual(warnings, [], 'a project that configured itself is not lectured');
});
