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
