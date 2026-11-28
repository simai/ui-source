// The class window (new Modal) follows <sf-modal> (owner decision C224;
// ui-control prototypes/overlays-modal-study.html Ok1-Ok7, DEV letter
// msg-92e0e0fa items 17-23), and a class icon button shows its name as the
// Framework's tooltip (C248).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('class window: sizes by name, the Smart surface, the focus scrim, sf-button-close', async () => {
  const js = await read('src/component/modal/js/_modal.js');
  // C159 (1): question, form, wide, full; anything else is a form.
  assert.match(js, /const SIZES = \['question', 'form', 'wide', 'full'\];/u);
  assert.match(js, /`sf-modal sf-modal--size-\$\{this\.size\} sf-modal--position-/u);
  assert.match(js, /root\.setAttribute\('data-sf-modal-size', this\.size\);/u);
  // C16, C20: the modal surface, elevated over the page (popup place, modal
  // shadow), not the bg-surface utility.
  assert.match(js, /'sf-modal-surface flex flex-col min-w-0',\s*!isInline && 'sf-modal-surface--elevated'/u);
  assert.doesNotMatch(js, /'bg-surface border border-outline-variant/u);
  // C159 (7), C224: the scrim is the sheet's; blur is the focus preset.
  assert.doesNotMatch(js, /'bg-black opacity-6'|'bg-surface-overlay'/u);
  assert.match(js, /`sf-modal-overlay--\$\{this\.overlayPreset\}`/u);
  assert.match(js, /this\.overlayPreset === 'focus' \? getBlurClass\('small'\)/u);
  assert.match(js, /this\.template\.toggleAttribute\('data-sf-modal-stacked', windows\.indexOf\(this\) > 0\);/u);
  // C14, C15: the close is sf-button-close's class markup.
  assert.match(js, /'sf-icon-button sf-icon-button--size-1\/3 sf-icon-button--close sf-button-close sf-button-close--ghost sf-button-close--on-surface/u);
  assert.doesNotMatch(js, /sf-icon-button--close sf-icon-button--link/u);
  // C159 (2): a phone sheet below sm, the whole screen for wide and full.
  assert.match(js, /breakpointMedia\('sm', \{ below: true \}\)/u);
  assert.match(js, /if \(this\.position === 'center' && this\.onPhone && !this\.phoneFullScreen\) return 'bottom';/u);
  // C157 (1): side and bottom positions and the blur strengths are dated
  // old names, noted in SF.deprecations and recorded in the journal.
  assert.match(js, /const OLD_NAMES_UNTIL = '2027-01-01';/u);
  const journal = JSON.parse(await read('contracts/changes/journal.json'));
  const record = journal.records.find((entry) => entry.id === 'value-modal-class-window-old-names-c224');
  assert.equal(record?.remove_after, '2027-01-01');
});

test('modal sheet: a page width and a full-screen window are not overridden by the named width; top stands flush', async () => {
  const css = await read('src/component/modal/scss/_css__modal_custom.scss');
  for (const size of ['form', 'wide']) {
    const rule = css.match(new RegExp(`\\.sf-modal--size-${size}:not\\([^{]*\\{`, 'u'))?.[0] || '';
    assert.match(rule, /\[data-sf-modal-fullscreen='true'\]\) \[data-sf-modal-panel\]:not\(\[data-sf-modal-has-width\]\)/u, size);
  }
  const top = css.match(/\.sf-modal\[data-sf-modal-position='top'\] > \[data-sf-modal-panel\] > \[data-sf-modal-surface\] \{[^}]*\}/u)?.[0] || '';
  assert.match(top, /border-block-start-width: 0;/u);
  assert.match(top, /border-start-start-radius: 0;/u);
  assert.match(top, /border-start-end-radius: 0;/u);
});

test('class icon button: its aria-label is a Framework tooltip, data-tooltip="off" opts out (C248)', async () => {
  const [entry, tip] = await Promise.all([
    read('src/component/icon-buttons/js/index.js'),
    read('src/component/icon-buttons/js/_name-tooltip.js'),
  ]);
  assert.match(entry, /import '\.\/_name-tooltip';/u);
  // The page's own link or opt-out, a title, a close, a disabled button and
  // <sf-button-icon> (which shows its own) are left alone.
  assert.match(tip, /if \(button\.hasAttribute\('data-tooltip'\) \|\| hasTitle\(button\)\) return null;/u);
  assert.match(tip, /for \(let node = button; node && node\.nodeType === 1; node = node\.parentElement\)/u);
  assert.match(tip, /\.sf-button-close, \.sf-icon-button--close, :disabled/u);
  assert.match(tip, /const SKIP_HOSTS = 'sf-button-icon, /u);
  // Lazily: nothing before the first hover, focus or long press.
  assert.match(tip, /for \(const type of \['pointerover', 'focusin', 'pointerdown'\]\)/u);
  assert.match(tip, /loader\?\.ensurePlugin\?\.\('tooltip'\);/u);
  // GB21 A: a marked rail row (data-sf-name-tip="inline-end") gets the tooltip beside it.
  assert.match(tip, /tip\.className = `sf-tooltip sf-tooltip--dark\$\{beside \? ' sf-tooltip--arrow-inline-start' : ''\} \$\{NAME_TIP\}`;/u);
});
