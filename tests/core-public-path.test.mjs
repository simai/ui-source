import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Core resolves canonical chunks from its own module script', async () => {
  const source = await readFile(
    path.join(root, 'src/core/js/public-path.js'),
    'utf8',
  );

  assert.match(source, /window\.sfPath\s*=\s*cdnDefault/);
  const context = {
    URL,
    __webpack_public_path__: 'https://play.example/assets/',
    document: {
      baseURI: 'https://play.example/',
      scripts: [
        { src: 'https://play.example/simai/core/js/core.js?sf_v=exact' },
        { src: 'https://play.example/assets/main.js' },
      ],
    },
    window: {
      location: { href: 'https://play.example/' },
      sfPath: 'https://play.example/simai/',
    },
  };

  vm.runInNewContext(source, context);

  assert.equal(
    context.__webpack_public_path__,
    'https://play.example/simai/core/',
  );
  assert.equal(context.window.sfPath, 'https://play.example/simai/');
});

test('Core derives the canonical chunk root from the Framework fallback', async () => {
  const source = await readFile(
    path.join(root, 'src/core/js/public-path.js'),
    'utf8',
  );
  const context = {
    URL,
    __webpack_public_path__: 'https://play.example/assets/',
    document: {
      baseURI: 'https://play.example/',
      scripts: [],
    },
    window: {
      location: { href: 'https://play.example/' },
      sfPath: '/simai/',
    },
  };

  vm.runInNewContext(source, context);

  assert.equal(
    context.__webpack_public_path__,
    'https://play.example/simai/core/',
  );
});
