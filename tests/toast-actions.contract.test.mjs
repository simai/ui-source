import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import test from 'node:test';
import {nothing} from 'lit';
import {renderToastTemplate, toastActions} from '../src/smart/toast/js/templates/default.js';

// Owner decision C50 (2026-11-10): one light navigation action, undo, retry,
// extend and two actions (C35, C46); sf-toast 1.3.0 took the model of
// SF.Toast.create (component.toast 1.3.0) with action-href and
// secondary-action-text / secondary-action. Owner decision C126 (1)
// (2026-11-13): every action is a button, a link in the text is help only, so
// from 1.4.0 (group build 3) the light action is the action button drawn as a
// link, in the action's place, not a link at the end of the text.

const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

// The template's result as markup: the strings with every value in place.
function markup(value) {
  if (value === nothing || value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(markup).join('');
  if (value && typeof value === 'object' && Array.isArray(value.strings)) {
    return value.strings.reduce((out, part, at) => out + part + (at < value.values.length ? markup(value.values[at]) : ''), '');
  }
  return String(value);
}

const draw = (settings) => markup(renderToastTemplate({title: 'Отчёт готов', status: 'info', closable: true, ...settings}));
const links = (html) => (html.match(/<a\b/g) ?? []).length;
const buttons = (html) => (html.match(/data-toast-action=/g) ?? []).length - links(html);

test('the manifest declares the action model (sf-toast 1.4.0)', () => {
  const manifest = json('src/smart/toast/component.json');
  assert.equal(manifest.version, '1.4.0');
  assert.deepEqual(manifest.settings['action-href'], {...manifest.settings['action-href'], type: 'string', default: ''});
  assert.equal(manifest.settings['secondary-action-text'].default, '');
  assert.equal(manifest.settings['secondary-action'].default, 'secondary');
  assert.ok(manifest['x-words'].includes('secondary-action-text'), 'the second label is a word of the page language');
  // The generated registry part carries the same names.
  const generated = json('src/smart/toast/smart.manifest.json');
  for (const name of ['action-href', 'secondary-action-text', 'secondary-action', 'actions-layout']) assert.ok(generated.inputs.properties[name], name);
});

test('one light navigation action is the action button drawn as a link (C126 (1))', () => {
  const html = draw({supportingText: 'Выгрузка собрана.', actionText: 'Открыть', actionHref: '/reports/11', action: 'open'});
  assert.equal(links(html), 1);
  assert.equal(buttons(html), 0);
  assert.match(html, /<div class="sf-toast-supporting-text">Выгрузка собрана\.<\/div>/, 'no link in the text');
  assert.match(html, /<div class="sf-toast-bottom flex items-center">\s*<a\s+class=sf-button sf-button--tonal sf-button--on-surface sf-button--size-1 sf-button--height-low flex items-cross-center\s+href=\/reports\/11\s+data-action=open\s+data-toast-action=open\s*><span class="sf-button-text-container">Открыть<\/span><\/a>/);
  assert.doesNotMatch(html, /sf-toast-link|\u00a0/);
  assert.deepEqual(toastActions({actionText: 'Открыть', actionHref: '#r', action: 'open'}).buttons, [{text: 'Открыть', action: 'open', href: '#r'}]);
});

test('undo, retry, extend and two actions are buttons; with two actions action-href does not apply', () => {
  const one = draw({actionText: 'Отменить', action: 'undo'});
  assert.equal(buttons(one), 1);
  assert.equal(links(one), 0);
  const two = draw({actionText: 'Отменить', action: 'undo', actionHref: '#ignored', secondaryActionText: 'Корзина', secondaryAction: 'trash'});
  assert.equal(buttons(two), 2);
  assert.equal(links(two), 0, 'with a second action action-href does not apply');
  assert.match(two, /data-action=undo[\s\S]*data-action=trash/);
  assert.deepEqual(toastActions({secondaryActionText: 'Корзина'}).buttons, [{text: 'Корзина', action: 'secondary', href: ''}]);
  assert.deepEqual(toastActions({actionText: '  ', actionHref: '#x'}), {buttons: []});
});

test('the class toast draws the same button-link and buttons (component.toast 1.4.0)', () => {
  const source = readFileSync(new URL('../src/component/toast/js/_toast.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /sf-toast-link/);
  assert.match(source, /const buttons = linkText\s*\? \[\{ text: linkText, action: link\.action \|\| 'action', href: link\.href \|\| '#'/);
  assert.match(source, /document\.createElement\(one\.href \? 'a' : 'button'\)/);
  const css = readFileSync(new URL('../src/component/toast/scss/_css__toast.scss', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.sf-toast-link/);
  assert.match(css, /@include notice-link\.sf-notice-link\('\.sf-toast \.sf-toast-wrap'\);/);
});

test('the first paint holds the button-link and the two buttons', () => {
  const folder = new URL('../src/smart/toast/static/default/', import.meta.url);
  assert.ok(existsSync(new URL('link.html', folder)), 'scripts/snapshot-first-paint.mjs --write makes the static markup');
  const link = readFileSync(new URL('link.html', folder), 'utf8');
  assert.match(link, /<a class="sf-button sf-button--tonal[^"]*" href="#report" data-action="open" data-toast-action="open">/);
  assert.doesNotMatch(link, /sf-toast-link/);
  const two = readFileSync(new URL('two-actions.html', folder), 'utf8');
  assert.equal((two.match(/<button type="button" class="sf-button/g) ?? []).length, 2);
  assert.doesNotMatch(two, /sf-toast-link|<a /);
});
