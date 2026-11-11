import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import test from 'node:test';
import {nothing} from 'lit';
import {renderToastTemplate, toastActions} from '../src/smart/toast/js/templates/default.js';

// Owner decision C50 (2026-11-10): one light navigation action is a link at the
// end of the text; undo, retry, extend and two actions are buttons under the
// text (C35, C46); a toast never shows both. sf-toast 1.3.0 takes the model of
// SF.Toast.create (component.toast 1.3.0) with action-href and
// secondary-action-text / secondary-action.

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

test('the manifest declares the action model (sf-toast 1.3.0)', () => {
  const manifest = json('src/smart/toast/component.json');
  assert.equal(manifest.version, '1.3.0');
  assert.deepEqual(manifest.settings['action-href'], {...manifest.settings['action-href'], type: 'string', default: ''});
  assert.equal(manifest.settings['secondary-action-text'].default, '');
  assert.equal(manifest.settings['secondary-action'].default, 'secondary');
  assert.ok(manifest['x-words'].includes('secondary-action-text'), 'the second label is a word of the page language');
  // The generated registry part carries the same names.
  const generated = json('src/smart/toast/smart.manifest.json');
  for (const name of ['action-href', 'secondary-action-text', 'secondary-action']) assert.ok(generated.inputs.properties[name], name);
});

test('one light navigation action is a link at the end of the text, with no buttons', () => {
  const html = draw({supportingText: 'Выгрузка собрана.', actionText: 'Открыть', actionHref: '/reports/11', action: 'open'});
  assert.equal(links(html), 1);
  assert.equal(buttons(html), 0);
  assert.doesNotMatch(html, /sf-toast-bottom/);
  assert.match(html, /<div class="sf-toast-supporting-text">Выгрузка собрана\. <a\s+class="sf-toast-link"\s+href=\/reports\/11\s+data-action=open\s+data-toast-action=open\s*>Открыть<\/a><\/div>/);
  // Without supporting text the link ends the heading.
  assert.match(draw({actionText: 'Открыть', actionHref: '#r'}), /<div class="sf-toast-text">Отчёт готов <a\s+class="sf-toast-link"/);
});

test('undo, retry, extend and two actions are buttons; a toast never mixes the two', () => {
  const one = draw({actionText: 'Отменить', action: 'undo'});
  assert.equal(buttons(one), 1);
  assert.equal(links(one), 0);
  const two = draw({actionText: 'Отменить', action: 'undo', actionHref: '#ignored', secondaryActionText: 'Корзина', secondaryAction: 'trash'});
  assert.equal(buttons(two), 2);
  assert.equal(links(two), 0, 'with a second action action-href does not apply');
  assert.match(two, /data-action=undo[\s\S]*data-action=trash/);
  assert.deepEqual(toastActions({secondaryActionText: 'Корзина'}).buttons, [{text: 'Корзина', action: 'secondary'}]);
  assert.deepEqual(toastActions({actionText: '  ', actionHref: '#x'}), {link: null, buttons: []});
});

test('the class toast draws the same link and buttons (component.toast 1.3.0)', () => {
  const source = readFileSync(new URL('../src/component/toast/js/_toast.js', import.meta.url), 'utf8');
  assert.match(source, /anchor\.className = 'sf-toast-link'/);
  assert.match(source, /const buttons = linkText\s*\? \[\]/);
  const css = readFileSync(new URL('../src/component/toast/scss/_css__toast.scss', import.meta.url), 'utf8');
  assert.match(css, /\.sf-toast \.sf-toast-link \{\s*color: inherit;/);
});

test('the first paint holds the link and the two buttons', () => {
  const folder = new URL('../src/smart/toast/static/default/', import.meta.url);
  assert.ok(existsSync(new URL('link.html', folder)), 'scripts/snapshot-first-paint.mjs --write makes the static markup');
  const link = readFileSync(new URL('link.html', folder), 'utf8');
  assert.match(link, /<a class="sf-toast-link" href="#report" data-action="open" data-toast-action="open">Открыть<\/a>/);
  assert.doesNotMatch(link, /sf-toast-bottom/);
  const two = readFileSync(new URL('two-actions.html', folder), 'utf8');
  assert.equal((two.match(/<button type="button" class="sf-button/g) ?? []).length, 2);
  assert.doesNotMatch(two, /sf-toast-link/);
});
