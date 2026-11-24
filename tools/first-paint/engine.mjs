// The first-paint engine as tools/first-paint/render.mjs sees it in a
// ui-source checkout: the snapshot machinery of scripts/first-paint-lib.mjs,
// the page script of scripts/first-paint-page.js, and the playwright this
// repository declares (scripts/playwright-local.mjs).
//
// The pair ships the same render.mjs under core/js/composition/first-paint/
// with an engine of its own beside it (tools/first-paint/kit-engine.mjs): the
// same library and page script, copied by scripts/build-first-paint-kit.mjs,
// and the caller's playwright. render.mjs imports this file only, so one
// render.mjs runs in both places.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ensureLocalPlaywright} from '../../scripts/playwright-local.mjs';

export * from '../../scripts/first-paint-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/** Where this engine is: a ui-source checkout ('source') or a pair ('pair'). */
export const ENGINE = 'source';

/** The page script of every first-paint page (scripts/first-paint-page.js). */
export const PAGE_SCRIPT = readFileSync(join(here, '..', '..', 'scripts', 'first-paint-page.js'), 'utf8');

/** A headless Chromium from the playwright this repository declares. */
export async function launchChromium() {
  ensureLocalPlaywright(join(here, '..', '..'));
  const {chromium} = await import('playwright');
  return chromium.launch();
}
