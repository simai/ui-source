#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// Reads the built CSS, not the sources: the keyboard ring must come from our
// tokens, a mouse click must leave none, and a layer must not open and close
// on the same curve.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const css = [
  join(out, 'core/core/css/core.css'),
  join(out, 'component/component/alerts/css/alerts.css'),
  join(out, 'component/component/toast/css/toast.css'),
  join(out, 'smart/smart/drawer/css/drawer.css'),
];
const failures = [];
const browser = await chromium.launch();
try {
  // The focus page carries nothing that could cover the link: an open drawer
  // would swallow the click.
  const focusPage = await browser.newPage();
  await focusPage.setContent('<!doctype html><html class="theme-light"><body><a href="#" id="link">link</a></body></html>');
  for (const path of css) await focusPage.addStyleTag({path});

  const page = await browser.newPage();
  await page.goto('about:blank');
  for (const path of css) await page.addStyleTag({path});
  await page.setContent(`<!doctype html><html class="theme-light"><body>
    <div class="sf-alert" id="alert">alert</div>
    <div class="sf-alert closing" id="alert-closing">alert</div>
    <div class="sf-toast" id="toast">toast</div>
    <div class="sf-toast closing" id="toast-closing">toast</div>
    <div class="sf-drawer" id="drawer"><div class="sf-drawer-panel" id="panel"></div></div>
    <div class="sf-drawer is-open" id="drawer-open"><div class="sf-drawer-panel" id="panel-open"></div></div>
  </body></html>`);
  for (const path of css) await page.addStyleTag({path});

  // The ring is ours and only for the keyboard: a click on the link itself
  // focuses it without making the ring visible.
  await focusPage.click('#link');
  const afterClick = await focusPage.evaluate(() => {
    const link = document.getElementById('link');
    const style = getComputedStyle(link);
    return {
      focused: document.activeElement === link,
      matches: link.matches(':focus-visible'),
      style: style.outlineStyle,
    };
  });
  // Release the click focus first, so Tab lands on the link instead of leaving
  // the document.
  await focusPage.evaluate(() => document.activeElement?.blur());
  await focusPage.keyboard.press('Tab');
  const afterTab = await focusPage.evaluate(() => {
    const active = document.activeElement;
    const style = getComputedStyle(active);
    return {
      id: active.id,
      matches: active.matches(':focus-visible'),
      width: style.outlineWidth,
      color: style.outlineColor,
      style: style.outlineStyle,
    };
  });
  // The expected ring is read from the focus tokens, not written as a number:
  // it is 2px solid since 6f0f8af8, and a literal 4px reported that decision
  // as a failure for three revisions.
  const token = await focusPage.evaluate(() => {
    const probe = document.createElement('i');
    probe.style.cssText = 'outline: var(--sf-focus--width) var(--sf-focus--style) var(--sf-focus--color);';
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const ring = {width: style.outlineWidth, style: style.outlineStyle};
    probe.remove();
    return ring;
  });
  if (afterTab.width !== token.width || afterTab.style !== token.style) {
    failures.push({keyboardRing: afterTab, expected: token});
  }
  if (!/rgba?\(/.test(afterTab.color) || afterTab.color === 'rgb(0, 0, 0)') {
    failures.push({ringColour: afterTab.color, expected: 'the theme focus colour'});
  }
  if (afterClick.matches || afterClick.style !== 'none') {
    failures.push({mouseFocus: afterClick, expected: 'a click focuses the link and draws no ring'});
  }

  // Arrival and departure read different curves.
  const curves = await page.evaluate(() => {
    const read = (id) => getComputedStyle(document.getElementById(id)).transitionTimingFunction;
    return {
      alert: read('alert'), alertClosing: read('alert-closing'),
      toast: read('toast'), toastClosing: read('toast-closing'),
      panel: read('panel'), panelOpen: read('panel-open'),
    };
  });
  for (const [resting, leaving, name] of [
    ['alert', 'alertClosing', 'alert'],
    ['toast', 'toastClosing', 'toast'],
    ['panelOpen', 'panel', 'drawer panel'],
  ]) {
    if (curves[resting] === curves[leaving]) {
      failures.push({layer: name, curve: curves[resting], expected: 'two different curves'});
    }
    if (!/cubic-bezier/.test(curves[resting])) failures.push({layer: name, curve: curves[resting], expected: 'a token curve'});
  }
  await page.close();
  await focusPage.close();
} finally {
  await browser.close();
}
if (failures.length) throw new Error(JSON.stringify(failures, null, 2));
process.stdout.write('Motion and focus: PASS — our ring on the keyboard only, two curves per layer\n');
