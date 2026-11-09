#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/build-output
// The object form of an action (standard simai.smart-component §4.4) on the
// built elements, beside the positional form and a call with no argument
// (action-call defects, 2026-11-09):
// - sf-tabs setData({data, reason}) merges the data, not the wrapper;
//   setPanels({panels}) replaces the panels instead of clearing them;
// - sf-menu-context openFor({anchor}) opens (it threw), chooseTab({index})
//   chooses (it did nothing); openFor and toggleFor answer an outcome;
// - sf-progress-run step(id, state) leaves the step's other fields as they were;
// - sf-editor-overlay setMessages({messages}) keeps the words, not the wrapper.
// Three fresh pages; the console stays clean.
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const styles = ['core/core/css/core.css'].map((p) => join(out, p));
const modules = [
  'core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/tabs/js/tabs.js', 'smart/smart/menu-context/js/menu-context.js',
  'smart/smart/progress-run/js/progress-run.js', 'smart/smart/editor-overlay/js/editor-overlay.js',
].map((p) => join(out, p));
const absent = [...styles, ...modules].filter((path) => !existsSync(path));
if (absent.length) {
  console.error(JSON.stringify({missingAssets: absent, root: out}, null, 2));
  throw new Error(`${absent.length} build asset(s) not found under ${out}`);
}

const HARNESS = /Automatic publicPath/u;
const browser = await chromium.launch();
const runs = [];
const failures = [];

for (let run = 1; run <= 3; run++) {
  const page = await browser.newPage({viewport: {width: 900, height: 700}});
  const errors = [];
  page.on('pageerror', (error) => { if (!HARNESS.test(String(error))) errors.push(String(error)); });
  page.on('console', (message) => { if (message.type() === 'error' && !HARNESS.test(message.text())) errors.push(message.text()); });
  await page.setContent('<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body style="margin:0;padding:40px">'
    + '<button id="trigger" type="button">Меню</button>'
    + '<sf-menu-context id="menu" popup aria-label="Меню"></sf-menu-context>'
    + '<sf-tabs id="tabs" aria-label="Вкладки"></sf-tabs>'
    + '<sf-progress-run id="run" aria-label="Задача"></sf-progress-run>'
    + '<sf-editor-overlay id="overlay"></sf-editor-overlay>'
    + '</body></html>');
  for (const path of styles) await page.addStyleTag({path});
  for (const path of modules) await page.addScriptTag({path, type: 'module'}).catch(() => {});
  await page.waitForFunction(() => ['sf-menu-context', 'sf-tabs', 'sf-progress-run', 'sf-editor-overlay'].every((tag) => customElements.get(tag)), null, {timeout: 15000});

  const facts = await page.evaluate(async () => {
    const wait = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const facts = {};
    // sf-tabs
    const tabs = document.getElementById('tabs');
    await tabs.whenRendered?.();
    const tabList = (n) => Array.from({length: n}, (_, i) => ({label: `T${i}`}));
    facts.tabsPositional = tabs.setData({tabs: tabList(2)}, 'host');
    facts.tabsAfterPositional = tabs.dataTabs.length;
    facts.tabsObject = tabs.setData({data: {tabs: tabList(3)}, reason: 'host'});
    facts.tabsAfterObject = tabs.dataTabs.length;
    facts.tabsWrapperKey = Object.prototype.hasOwnProperty.call(tabs.getData(), 'data');
    facts.panelsObject = tabs.setPanels({panels: [{content: 'P0'}, {content: 'P1'}]});
    facts.panelsAfterObject = tabs.dataPanels.length;
    tabs.setPanels([{content: 'Q0'}]);
    facts.panelsAfterPositional = tabs.dataPanels.length;
    facts.panelsNoArgs = tabs.setPanels();
    facts.panelsAfterNoArgs = tabs.dataPanels.length;
    // sf-menu-context
    const menu = document.getElementById('menu');
    const trigger = document.getElementById('trigger');
    menu.entries = [{id: 'a', text: 'Открыть'}, {id: 'b', text: 'Удалить'}];
    await wait();
    facts.openObject = await menu.openFor({anchor: trigger, options: {focus: 'none'}});
    facts.openAfterObject = menu.isOpen;
    facts.toggleObject = await menu.toggleFor({anchor: trigger});
    facts.openAfterToggle = menu.isOpen;
    facts.openPositional = await menu.openFor(trigger, {focus: 'none'});
    facts.togglePositional = await menu.toggleFor(trigger);
    facts.openInvalid = await menu.openFor('nowhere');
    const prevent = (event) => event.preventDefault();
    menu.addEventListener('sf-menu-context-open', prevent);
    facts.openPrevented = await menu.openFor(trigger);
    menu.removeEventListener('sf-menu-context-open', prevent);
    menu.tabs = ['Первая', 'Вторая', 'Третья'];
    await wait();
    menu.chooseTab({index: 1});
    facts.chooseObject = menu.activeTab?.id;
    menu.chooseTab(2);
    facts.choosePositional = menu.activeTab?.id;
    // sf-progress-run
    const run = document.getElementById('run');
    run.steps = [{id: 'a', title: 'Сборка', state: 'running', text: 'Пакет', started: '10:00', duration: 3}, {id: 'b', title: 'Проверка', state: 'waiting', text: 'Ждёт'}];
    facts.stepPositional = run.step('a', 'done');
    facts.stepAfterPositional = run.list.find((step) => String(step.id) === 'a');
    facts.stepObject = run.step({id: 'b', text: 'Проверка кода'});
    facts.stepAfterObject = run.list.find((step) => String(step.id) === 'b');
    facts.stepNoArgs = run.step();
    // sf-editor-overlay
    const overlay = document.getElementById('overlay');
    overlay.setMessages({messages: {select: 'Выбрать'}});
    facts.messagesObject = overlay.customMessages;
    overlay.setMessages({select: 'Выделить'});
    facts.messagesPositional = overlay.customMessages;
    overlay.setMessages();
    facts.messagesNoArgs = overlay.customMessages;
    return facts;
  });

  const expect = (name, ok, detail) => { if (!ok) failures.push({run, name, detail}); };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  expect('tabs setData positional', same(facts.tabsPositional, {outcome: 'applied'}) && facts.tabsAfterPositional === 2, facts);
  expect('tabs setData object', same(facts.tabsObject, {outcome: 'applied'}) && facts.tabsAfterObject === 3 && !facts.tabsWrapperKey, facts);
  expect('tabs setPanels object', facts.panelsAfterObject === 2, facts);
  expect('tabs setPanels positional', facts.panelsAfterPositional === 1, facts);
  expect('tabs setPanels no args', facts.panelsAfterNoArgs === 0 && same(facts.panelsNoArgs, {outcome: 'applied'}), facts);
  expect('menu openFor object', same(facts.openObject, {outcome: 'applied', value: true}) && facts.openAfterObject, facts);
  expect('menu toggleFor object closes', same(facts.toggleObject, {outcome: 'applied', value: false}) && !facts.openAfterToggle, facts);
  expect('menu openFor positional', same(facts.openPositional, {outcome: 'applied', value: true}), facts);
  expect('menu toggleFor positional', same(facts.togglePositional, {outcome: 'applied', value: false}), facts);
  expect('menu openFor invalid', same(facts.openInvalid, {outcome: 'refused', reason: 'invalid'}), facts);
  expect('menu openFor prevented', same(facts.openPrevented, {outcome: 'refused', reason: 'prevented'}), facts);
  expect('menu chooseTab object', facts.chooseObject === 'Вторая', facts);
  expect('menu chooseTab positional', facts.choosePositional === 'Третья', facts);
  const a = facts.stepAfterPositional ?? {};
  expect('progress-run step positional', same(facts.stepPositional, {outcome: 'applied'}) && a.state === 'done' && a.text === 'Пакет' && a.started === '10:00' && a.duration === 3, a);
  const b = facts.stepAfterObject ?? {};
  expect('progress-run step object', same(facts.stepObject, {outcome: 'applied'}) && b.state === 'waiting' && b.text === 'Проверка кода', b);
  expect('progress-run step no args', facts.stepNoArgs?.outcome === 'refused', facts.stepNoArgs);
  expect('overlay setMessages object', same(facts.messagesObject, {select: 'Выбрать'}), facts.messagesObject);
  expect('overlay setMessages positional', same(facts.messagesPositional, {select: 'Выделить'}), facts.messagesPositional);
  expect('overlay setMessages no args', facts.messagesNoArgs === null, facts.messagesNoArgs);
  expect('console clean', errors.length === 0, errors);
  runs.push({run, facts, errors});
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ok: failures.length === 0, failures, runs}, null, 2));
if (failures.length) process.exit(1);
