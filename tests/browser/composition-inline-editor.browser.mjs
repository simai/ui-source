#!/usr/bin/env node
// Browser acceptance for the Composition inline editor.
// Usage: PLAYWRIGHT_MODULE=… node composition-inline-editor.browser.mjs <lab> <distr> <smart-root> <output-dir>
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [labUrl, assetsUrl, smartUrl, outputDir] = process.argv.slice(2);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
mkdirSync(outputDir, { recursive: true });
const failures = []; const errors = []; const observations = {};
const check = (value, name, details = null) => { if (!value) failures.push({ name, details }); };
const browser = await chromium.launch();
const page = await browser.newPage();
const cdp = await page.context().newCDPSession(page);
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
page.on('dialog', (dialog) => { errors.push(`dialog: ${dialog.message()}`); dialog.dismiss(); });

async function open({ width = 1280, theme = 'light', dir = 'ltr' } = {}) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(`${labUrl}?${new URLSearchParams({ assets: assetsUrl, smart: smartUrl, theme, dir })}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
}
const lab = () => page.evaluate(() => ({ inputs: window.lab.inputs, commits: window.lab.commits, cancels: window.lab.cancels, refused: window.lab.refused || false }));
const body = () => page.locator('#canvas [data-sf-composition-id="body"]');
const canvasHtml = () => page.evaluate(() => document.getElementById('canvas').innerHTML);
const editorValue = () => page.evaluate(() => window.lab.editor.value());
const shiftLeft = async (count) => { for (let index = 0; index < count; index += 1) await page.keyboard.press('Shift+ArrowLeft'); };

await open();
const renderedBefore = await canvasHtml();

// Open and cancel: the canvas returns to the exact rendered HTML.
await body().dblclick({ position: { x: 4, y: 4 } });
const opened = await page.evaluate(() => {
  const element = document.querySelector('[data-sf-composition-id="body"]');
  const toolbar = document.querySelector('.sf-inline-editor-toolbar').getBoundingClientRect();
  const box = element.getBoundingClientRect();
  return { editable: element.getAttribute('contenteditable'), role: element.getAttribute('role'), label: element.getAttribute('aria-label'), outline: getComputedStyle(element).outlineStyle, focused: document.activeElement === element, toolbarAbove: toolbar.bottom <= box.top };
});
observations.opened = opened;
check(opened.editable === 'true' && opened.role === 'textbox' && opened.label.startsWith('Абзац: редактирование') && opened.outline === 'solid' && opened.focused, 'double click opens an accessible, visibly editing textbox', opened);
check(opened.toolbarAbove, 'formatting toolbar sits above the text', opened);
await page.keyboard.press('Escape');
check(await canvasHtml() === renderedBefore && (await lab()).cancels === 1, 'Escape restores the exact rendered HTML', null);

// Typing, marks by keyboard and toolbar, and link with unsafe refusal.
await body().dblclick({ position: { x: 4, y: 4 } });
await page.keyboard.press('End');
await page.keyboard.type(' Новые слова');
await shiftLeft(5);
await page.keyboard.press('ControlOrMeta+b');
check(await page.locator('.sf-inline-editor-button--strong').getAttribute('aria-pressed') === 'true', 'bold state is reflected on the toolbar', null);
await page.keyboard.press('ControlOrMeta+i');
await page.keyboard.press('ArrowLeft');
await page.keyboard.press('Home');
await page.keyboard.press('Shift+ArrowRight');
await page.keyboard.press('Shift+ArrowRight');
await page.keyboard.press('Shift+ArrowRight');
await page.keyboard.press('ControlOrMeta+e');
let value = await editorValue();
observations.afterMarks = value;
check(JSON.stringify(value.at(-1)) === JSON.stringify({ type: 'text', value: 'слова', marks: ['strong', 'em'] }), 'keyboard applies bold and italic to the selection', value.at(-1));
check(JSON.stringify(value[0]) === JSON.stringify({ type: 'text', value: 'Пер', marks: ['code'] }), 'keyboard applies code', value[0]);
await page.keyboard.press('End');
await shiftLeft(5);
await page.keyboard.press('ControlOrMeta+k');
check(await page.evaluate(() => document.activeElement?.classList.contains('sf-inline-editor-url')), 'Ctrl+K opens the link address field', null);
await page.keyboard.type('javascript:alert(1)');
await page.keyboard.press('Enter');
const refusedLink = await page.evaluate(() => ({ error: document.querySelector('.sf-inline-editor-error').textContent, invalid: document.querySelector('.sf-inline-editor-url').getAttribute('aria-invalid') }));
check(refusedLink.error === 'Недопустимый адрес ссылки' && refusedLink.invalid === 'true', 'an unsafe link is refused with an accessible error', refusedLink);
await page.keyboard.press('ControlOrMeta+a');
await page.keyboard.type('https://simai.ru/');
await page.keyboard.press('Enter');
value = await editorValue();
check(value.at(-1).type === 'link' && value.at(-1).href === 'https://simai.ru/' && value.at(-1).children[0].value === 'слова', 'a safe link wraps the selection', value.at(-1));
check(await page.evaluate(() => document.activeElement?.getAttribute('data-sf-composition-id') === 'body'), 'focus returns to the text after the link', null);

// Undo and redo through the editor history.
await page.keyboard.press('ControlOrMeta+z');
value = await editorValue();
check(value.at(-1).type === 'text', 'undo removes the link', value.at(-1));
await page.keyboard.press('ControlOrMeta+Shift+z');
value = await editorValue();
check(value.at(-1).type === 'link', 'redo restores the link', value.at(-1));

// Paste from Word or a web page keeps only allowed marks and safe links.
await page.keyboard.press('End');
await page.evaluate(() => {
  const data = new DataTransfer();
  data.setData('text/html', '<html><head><style>p{color:red}</style></head><body><p class="MsoNormal"><b>Жирный</b> <span style="font-style:italic">курсив</span> <span style="color:red;font-size:40px">цвет</span><script>alert(1)</script><img src="x" onerror="alert(2)"> <a href="javascript:alert(3)">плохая</a> <a href="https://ok.test/">хорошая</a></p><p>Второй абзац</p></body></html>');
  data.setData('text/plain', 'plain');
  document.querySelector('[data-sf-composition-id="body"]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
});
value = await editorValue();
const pasted = JSON.stringify(value);
observations.pasted = value.slice(-8);
check(!/alert|MsoNormal|color|font-size|<|script|img/u.test(pasted), 'paste drops foreign HTML, styles and scripts', pasted);
check(pasted.includes('{"marks":["strong"],"type":"text","value":"Жирный"}') || pasted.includes('"value":"Жирный","marks":["strong"]'), 'paste keeps bold from Word markup', null);
check(pasted.includes('"курсив","marks":["em"]') && pasted.includes('"href":"https://ok.test/"') && !pasted.includes('"href":"javascript'), 'paste maps italic spans and keeps only safe links', null);
const pastedText = await page.evaluate((content) => window.SF.Composition.inlineText(content), value);
check(pastedText.endsWith('Жирный курсив цвет плохая хорошая Второй абзац'), 'pasted paragraphs become one line of plain text without script text', pastedText);

// IME composition inserts committed text once.
const inputsBeforeIme = (await lab()).inputs.length;
await cdp.send('Input.imeSetComposition', { text: 'に', selectionStart: 1, selectionEnd: 1 });
await cdp.send('Input.imeSetComposition', { text: 'にほ', selectionStart: 2, selectionEnd: 2 });
const duringIme = (await lab()).inputs.length;
await cdp.send('Input.insertText', { text: '日本' });
value = await editorValue();
check(duringIme === inputsBeforeIme, 'no value events while composing', { inputsBeforeIme, duringIme });
check(JSON.stringify(value).includes('日本') && !JSON.stringify(value).includes('にほ'), 'IME commits the composed text once', value.at(-1));

// Enter commits normalized content; the host re-renders and saves.
await page.keyboard.press('Enter');
const state = await lab();
const committed = state.commits.at(-1);
observations.committed = committed;
check(committed?.id === 'body' && !state.refused, 'commit event carries normalized content the Document accepts', committed);
const after = await page.evaluate(async () => ({ html: document.getElementById('canvas').innerHTML, rendered: (await window.SF.Composition.render(window.lab.model())).html }));
check(after.html === after.rendered && !after.html.includes('contenteditable') && !after.html.includes('data-sf-inline-editing'), 'after saving the canvas equals the published rendering', null);
check(JSON.stringify(await page.evaluate((content) => window.SF.Composition.normalizeInline(content), committed.content)) === JSON.stringify(committed.content), 'committed content is already normalized', null);
check(await page.locator('.sf-inline-editor-toolbar').count() === 0, 'toolbar is removed after commit', null);

// Clearing all text commits empty content, not a placeholder space.
await body().dblclick({ position: { x: 4, y: 4 } });
await page.keyboard.press('ControlOrMeta+a');
await page.keyboard.press('Delete');
check(JSON.stringify(await editorValue()) === '[]', 'an emptied editor has no content', await editorValue());
await page.keyboard.press('Escape');

// Blur commits too; heading editing works.
await page.locator('#canvas [data-sf-composition-id="title"]').dblclick();
await page.keyboard.press('End');
await page.keyboard.type('!');
await page.locator('#before').focus();
await page.waitForTimeout(50);
check((await lab()).commits.at(-1)?.id === 'title', 'moving focus away commits the edit', (await lab()).commits.at(-1));
await page.screenshot({ path: resolve(outputDir, 'inline-wide-light.png') });

// Inline atoms: drawn props stay text, one caret stop, removed whole, kept by copy and paste.
await open();
const atoms = () => page.locator('#canvas [data-sf-composition-id="atoms"]');
const KBD = { type: 'component', name: 'kbd', props: { text: '<script>window.lab.xss = 1</script>' } };
const BADGE = { type: 'component', name: 'badge', props: { text: '<img src=x onerror="window.lab.xss = 2">', status: 'success' } };
const escapedIn = () => page.evaluate(() => {
  const element = document.querySelector('[data-sf-composition-id="atoms"]');
  const kbd = element.querySelector('kbd');
  const badge = element.querySelector('sf-badge');
  return { xss: window.lab.xss ?? null, scripts: element.querySelectorAll('script, img').length, kbd: kbd?.textContent ?? null, badge: badge?.getAttribute('text') ?? null };
});
const published = await escapedIn();
observations.atomsPublished = published;
check(published.xss === null && published.scripts === 0 && published.kbd === '<script>window.lab.xss = 1</script>' && published.badge === '<img src=x onerror="window.lab.xss = 2">', 'the renderer draws atom props as text, never markup', published);
const caret = () => page.evaluate(() => {
  const element = document.querySelector('[data-sf-composition-id="atoms"]');
  const selection = document.getSelection();
  return [window.SF.InlineEditor.textOffset(element, selection.anchorNode, selection.anchorOffset), window.SF.InlineEditor.textOffset(element, selection.focusNode, selection.focusOffset)];
});
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
await atoms().dblclick({ position: { x: 4, y: 4 } });
const editing = await escapedIn();
check(editing.xss === null && editing.scripts === 0 && editing.kbd === KBD.props.text && editing.badge === BADGE.props.text, 'while editing, atom props stay text', editing);
check(await page.evaluate(() => [...document.querySelectorAll('[data-sf-composition-id="atoms"] [data-sf-inline-node]')].every((node) => node.getAttribute('contenteditable') === 'false')), 'atoms are not editable inside', null);
await page.keyboard.press('Home');
for (let index = 0; index < 8; index += 1) await page.keyboard.press('ArrowRight');
const beforeAtom = await caret();
await page.keyboard.press('ArrowRight');
const afterAtom = await caret();
await page.keyboard.press('ArrowLeft');
const backAtom = await caret();
observations.atomCaret = { beforeAtom, afterAtom, backAtom };
check(same(beforeAtom, [8, 8]) && same(afterAtom, [9, 9]), 'ArrowRight steps over the atom in one move', observations.atomCaret);
check(same(backAtom, [8, 8]), 'ArrowLeft steps back over the atom in one move', observations.atomCaret);
await page.keyboard.press('Shift+ArrowRight');
const selectedAtom = await caret();
await page.keyboard.press('Shift+ArrowRight');
const acrossAtom = await caret();
check(same(selectedAtom, [8, 9]) && same(acrossAtom, [8, 10]), 'a selection extends over the atom and across it', { selectedAtom, acrossAtom });
await page.keyboard.press('ControlOrMeta+b');
value = await editorValue();
check(same(value[1], KBD) && value.some((entry) => same(entry, { type: 'text', value: ' ', marks: ['strong'] })), 'a mark across the atom leaves the atom without marks', value);
await page.keyboard.press('ControlOrMeta+z');
check(same(await editorValue(), [{ type: 'text', value: 'Нажмите ' }, KBD, { type: 'text', value: ' и ' }, BADGE, { type: 'text', value: ' готово' }]), 'undo restores the content around the atom', await editorValue());
// Typing next to the atom keeps it.
await page.keyboard.press('Home');
for (let index = 0; index < 9; index += 1) await page.keyboard.press('ArrowRight');
await page.keyboard.type('X');
value = await editorValue();
check(same(value[1], KBD) && same(value[2], { type: 'text', value: 'X и ' }), 'typing after the atom keeps it', value);
await page.keyboard.press('Backspace');
check(same((await editorValue())[2], { type: 'text', value: ' и ' }), 'Backspace after typing removes the typed character only', await editorValue());
// Backspace and Delete remove the atom whole.
await page.keyboard.press('Backspace');
value = await editorValue();
check(same(value, [{ type: 'text', value: 'Нажмите  и ' }, BADGE, { type: 'text', value: ' готово' }]) && same(await caret(), [8, 8]), 'Backspace removes the atom whole', value);
await page.keyboard.press('ControlOrMeta+z');
check(same((await editorValue())[1], KBD), 'undo brings the atom back', await editorValue());
await page.keyboard.press('Home');
for (let index = 0; index < 8; index += 1) await page.keyboard.press('ArrowRight');
await page.keyboard.press('Delete');
value = await editorValue();
check(same(value, [{ type: 'text', value: 'Нажмите  и ' }, BADGE, { type: 'text', value: ' готово' }]), 'Delete removes the atom whole', value);
await page.keyboard.press('ControlOrMeta+z');
// Copy the atom and paste it at the end: the same atom comes back.
await page.keyboard.press('Home');
for (let index = 0; index < 8; index += 1) await page.keyboard.press('ArrowRight');
await page.keyboard.press('Shift+ArrowRight');
const copied = await page.evaluate(() => {
  const element = document.querySelector('[data-sf-composition-id="atoms"]');
  const data = new DataTransfer();
  element.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true }));
  return { html: data.getData('text/html'), plain: data.getData('text/plain') };
});
observations.atomCopied = copied;
check(copied.plain === KBD.props.text && copied.html.includes('data-sf-inline-node'), 'copy writes the atom with its entry', copied);
await page.keyboard.press('End');
await page.evaluate((html) => {
  const data = new DataTransfer();
  data.setData('text/html', html);
  data.setData('text/plain', 'plain');
  document.querySelector('[data-sf-composition-id="atoms"]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
}, copied.html);
value = await editorValue();
check(same(value.at(-1), KBD) && same(value[1], KBD) && same(value.at(-2), { type: 'text', value: ' готово' }), 'paste keeps the copied atom exactly', value);
const pastedEditing = await escapedIn();
check(pastedEditing.xss === null && pastedEditing.scripts === 0, 'a pasted atom draws its props as text', pastedEditing);
await page.keyboard.press('Enter');
const atomCommit = (await lab()).commits.at(-1);
check(atomCommit?.id === 'atoms' && !(await lab()).refused && same(atomCommit.content.at(-1), KBD), 'the content with atoms commits and validates', atomCommit);
const afterAtoms = await escapedIn();
check(afterAtoms.xss === null && afterAtoms.scripts === 0, 'the saved rendering draws atom props as text', afterAtoms);
// An entry the editor does not know comes back out unchanged.
const opaque = await page.evaluate(() => {
  const element = document.createElement('p');
  document.body.append(element);
  const entry = { type: 'mention', user: { id: 7, name: '<b>Rim</b>' } };
  const session = window.SF.Composition.startInlineEdit(element, { content: [{ type: 'text', value: 'Привет, ' }, entry, { type: 'text', value: '!' }], nodeId: 'opaque', label: 'Абзац' });
  const before = session.value();
  document.execCommand('insertText', false, ' Ура');
  const after = session.value();
  const html = element.innerHTML;
  session.cancel();
  element.remove();
  return { entry, before, after, html };
});
observations.opaque = opaque;
check(same(opaque.before[1], opaque.entry) && same(opaque.after[1], opaque.entry) && opaque.after.at(-1).value === '! Ура' && !opaque.html.includes('<b>'), 'an unknown inline node survives an edit unchanged', opaque);

// A mark the editor does not know (F1.2, 2026-11-10): the run keeps it through
// typing in the same paragraph, a mark toggled on a neighbour, and commit; it
// is drawn as a span that carries its name, never as an element of that name.
const unknownMark = await page.evaluate(() => {
  const element = document.createElement('p');
  document.body.append(element);
  // This paragraph is not the lab's: its commit stays here.
  for (const name of ['sf-editor-inline-change', 'sf-inline-editor-change', 'sf-inline-edit-commit']) element.addEventListener(name, (event) => event.stopPropagation());
  const marked = { type: 'text', value: 'зачёркнуто', marks: ['em', 'superscript'] };
  const content = [{ type: 'text', value: 'Начало ' }, marked, { type: 'text', value: ' конец' }];
  const session = window.SF.Composition.startInlineEdit(element, { content, nodeId: 'marks', label: 'Абзац' });
  const before = session.value();
  const wrappers = [...element.querySelectorAll('[data-sf-inline-mark]')].map((node) => `${node.tagName.toLowerCase()}:${node.getAttribute('data-sf-inline-mark')}`);
  const strangers = element.querySelectorAll('superscript').length;
  // Type at the end, then bold the first word through the toolbar.
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  document.getSelection().removeAllRanges();
  document.getSelection().addRange(range);
  document.execCommand('insertText', false, '!');
  const typed = session.value();
  const first = element.firstChild;
  document.getSelection().setBaseAndExtent(first, 0, first, 6);
  document.querySelector('.sf-inline-editor-button--strong').click();
  const toggled = session.value();
  const committed = session.commit();
  element.remove();
  return { marked, before, typed, toggled, committed, wrappers, strangers };
});
observations.unknownMark = unknownMark;
const holds = (content) => content.some((entry) => same(entry, unknownMark.marked));
check(holds(unknownMark.before) && holds(unknownMark.typed) && holds(unknownMark.toggled) && holds(unknownMark.committed), 'a run with an unknown mark is deep-equal after typing, a neighbour\'s mark and commit', unknownMark);
check(same(unknownMark.wrappers, ['span:superscript']) && unknownMark.strangers === 0, 'an unknown mark is drawn as a span carrying its name', unknownMark.wrappers);
check(unknownMark.toggled[0]?.marks?.includes('strong') && unknownMark.typed.at(-1).value === ' конец!', 'the neighbour edits took effect', unknownMark.toggled);

// Shift+Enter (inline model 1.2.0, F2.1): a soft line break in the same
// block, with the marks of the text before it; Enter still commits. A break
// at the end shows its empty line and is read back once.
await page.evaluate(() => {
  const element = document.createElement('p');
  element.id = 'breaks';
  document.body.append(element);
  for (const name of ['sf-editor-inline-change', 'sf-inline-editor-change', 'sf-inline-edit-commit']) element.addEventListener(name, (event) => event.stopPropagation());
  window.lab.breaks = window.SF.Composition.startInlineEdit(element, { content: [{ type: 'text', value: 'Первая' }, { type: 'text', value: 'вторая', marks: ['strong'] }], nodeId: 'breaks', label: 'Абзац' });
});
await page.keyboard.press('Home');
for (let index = 0; index < 6; index += 1) await page.keyboard.press('ArrowRight');
await page.keyboard.press('Shift+Enter');
const afterBreak = await page.evaluate(() => window.lab.breaks.value());
await page.keyboard.press('End');
await page.keyboard.press('Shift+Enter');
const endBreak = await page.evaluate(() => ({ value: window.lab.breaks.value(), brs: document.querySelectorAll('#breaks br').length, marked: document.querySelectorAll('#breaks br[data-sf-inline-break]').length }));
await page.keyboard.type('третья');
const typedAfter = await page.evaluate(() => window.lab.breaks.value());
await page.keyboard.press('ControlOrMeta+z');
const undone = await page.evaluate(() => window.lab.breaks.value());
await page.keyboard.press('Enter');
const breaksCommitted = await page.evaluate(() => { const element = document.getElementById('breaks'); const left = element.hasAttribute('data-sf-inline-editing'); element.remove(); return { left }; });
observations.breaks = { afterBreak, endBreak, typedAfter, undone, breaksCommitted };
check(same(afterBreak, [{ type: 'text', value: 'Первая' }, { type: 'break' }, { type: 'text', value: 'вторая', marks: ['strong'] }]), 'Shift+Enter inserts a break, not a new block and not a space', afterBreak);
check(same(endBreak.value.at(-1), { type: 'break', marks: ['strong'] }) && endBreak.brs === 3 && endBreak.marked === 2, 'a break at the end takes the marks before it and shows its empty line with one placeholder', endBreak);
check(same(typedAfter.slice(-2), [{ type: 'break', marks: ['strong'] }, { type: 'text', value: 'третья', marks: ['strong'] }]), 'text typed after a final break stands on the new line', typedAfter);
check(!breaksCommitted.left, 'Enter still commits', breaksCommitted);

// Dark, narrow, RTL.
await open({ theme: 'dark', width: 390, dir: 'rtl' });
await body().dblclick({ position: { x: 4, y: 4 } });
const narrow = await page.evaluate(() => {
  const toolbar = document.querySelector('.sf-inline-editor-toolbar').getBoundingClientRect();
  const element = document.querySelector('[data-sf-composition-id="body"]').getBoundingClientRect();
  return { left: Math.round(toolbar.left), right: Math.round(toolbar.right), elementRight: Math.round(element.right), viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, background: getComputedStyle(document.querySelector('.sf-inline-editor-toolbar')).backgroundColor };
});
observations.narrowDarkRtl = narrow;
check(narrow.left >= 0 && narrow.right <= narrow.viewport && narrow.scrollWidth <= narrow.viewport, 'toolbar fits a narrow viewport', narrow);
check(Math.abs(narrow.right - narrow.elementRight) <= 1 || narrow.left === 0, 'RTL toolbar aligns to the inline start', narrow);
await page.screenshot({ path: resolve(outputDir, 'inline-narrow-dark-rtl.png') });
await page.keyboard.press('Escape');

await browser.close();
const screenshots = Object.fromEntries(['inline-wide-light.png', 'inline-narrow-dark-rtl.png'].map((name) => [name, createHash('sha256').update(readFileSync(resolve(outputDir, name))).digest('hex')]));
const result = { status: failures.length || errors.length ? 'failed' : 'passed', failures, errors, observations, screenshots };
writeFileSync(resolve(outputDir, 'inline-editor-browser.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: result.status, failures, errors: errors.slice(0, 8) })}\n`);
if (result.status !== 'passed') process.exitCode = 1;
