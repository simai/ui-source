#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
// sf-badge's run state on the built bytes, in light and dark:
//   - each state draws its mark (a spinner or an icon whose ligature the icon
//     font really holds: the drawn glyph is one em wide, the name would be many),
//     its word in the page's language (lang/en.json, lang/ru.json) and its role;
//   - AA: the ink against the fill the badge really shows, in every appearance;
//     the ratios are printed;
//   - compact: the icon or spinner alone is seen, the box is square, the word is
//     the accessible name (the accessibility tree says it), and an aria-label
//     takes its place;
//   - activity wins over status and scheme for icon, text and colour, and both
//     stay readable; text and icon override; the spinner's box is the icon's,
//     before the lazily fetched spinner sheet and after it;
//   - no live region and no aria-busy;
//   - the spinner turns, and under prefers-reduced-motion it stands still.
import {createServer} from 'node:http';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);
const parts = {core: join(out, 'core', 'core'), rule: join(out, 'core', 'rule'), component: join(out, 'component', 'component'), smart: join(out, 'smart', 'smart'), utility: join(out, 'utility', 'utility')};
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const words = (lang) => JSON.parse(readFileSync(join(repo, `src/smart/badge/lang/${lang}.json`), 'utf8')).runtime;

const STATES = {
  running: {role: 'neutral', icon: null},
  waiting: {role: 'warning', icon: 'pending_actions'},
  done: {role: 'success', icon: 'check_circle'},
  stopped: {role: 'neutral', icon: 'stop_circle'},
  failed: {role: 'error', icon: 'error'},
};
const APPEARANCES = ['main', 'tonal', 'outline'];
const SIZES = ['1/3', '1/2', '1'];

const badges = [];
for (const state of Object.keys(STATES)) {
  badges.push(`<sf-badge id="plain-${state}" activity="${state}"></sf-badge>`);
  badges.push(`<sf-badge id="compact-${state}" activity="${state}" compact></sf-badge>`);
  for (const appearance of APPEARANCES) badges.push(`<sf-badge id="ink-${state}-${appearance}" activity="${state}" appearance="${appearance}"></sf-badge>`);
  for (const size of SIZES) badges.push(`<sf-badge id="size-${state}-${size.replace('/', '-')}" activity="${state}" size="${size}" text="Word"></sf-badge>`);
}
const page = (lang, theme) => `<!doctype html><html lang="${lang}" class="${theme}"><head><meta charset="utf-8">
<script>window.sfPath='/distr/';window.sfSmartPath='/distr/';</script>
<link rel="stylesheet" href="/distr/core/css/core.css">
<script src="/distr/core/js/core.js"></script>
<style>body{background:var(--sf-surface-0)}main{display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px;padding:16px}</style></head><body><main>
${badges.join('\n')}
<sf-badge id="over" activity="failed" status="success" scheme="primary"></sf-badge>
<sf-badge id="plain-failed-twin" status="error" text="Word"></sf-badge>
<sf-badge id="neutral-twin" scheme="neutral" text="Word"></sf-badge>
<sf-badge id="own-text" activity="done" text="Published"></sf-badge>
<sf-badge id="own-icon" activity="running" icon="sync"></sf-badge>
<sf-badge id="emptied" activity="done" icon-start=""></sf-badge>
<sf-badge id="end" activity="running" icon-position="end"></sf-badge>
<sf-badge id="unknown" activity="nonsense" text="Word"></sf-badge>
<sf-badge id="none" text="Word"></sf-badge>
<sf-badge id="labelled" activity="failed" compact aria-label="Build 12 failed"></sf-badge>
<sf-badge id="bare" text="Word" compact></sf-badge>
<sf-badge id="live" text="Word"></sf-badge>
</main></body></html>`;

const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2'};
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://probe');
  const path = decodeURIComponent(url.pathname);
  if (path === '/page') {
    response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return response.end(page(url.searchParams.get('lang'), url.searchParams.get('theme')));
  }
  const match = path.match(/^\/distr\/([^/]+)\/(.+)$/u);
  const file = match && parts[match[1]] ? join(parts[match[1]], match[2]) : '';
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, {'content-type': types[extname(file)] ?? 'application/octet-stream'});
  return response.end(readFileSync(file));
}).listen(0, '127.0.0.1');
await new Promise((settle) => server.once('listening', settle));
const url = (lang, theme) => `http://127.0.0.1:${server.address().port}/page?lang=${lang}&theme=${theme}`;

const SPINNER_SHEET = /\/spinner\/css\/spinner(\.min)?\.css/u;
const settled = async (tab, failures, label) => {
  await tab.waitForFunction(() => customElements.get('sf-badge') && document.querySelector('#plain-done .sf-icon'), null, {timeout: 20000})
    .catch(() => failures.push(`${label}: the badges never drew`));
  await tab.waitForFunction((pattern) => Array.from(document.styleSheets).some((sheet) => new RegExp(pattern, 'u').test(sheet.href || '')), SPINNER_SHEET.source, {timeout: 15000})
    .catch(() => failures.push(`${label}: the spinner sheet (a lazy relation) never arrived`));
  await tab.waitForFunction(() => !document.documentElement.hasAttribute('data-sf-icons'), null, {timeout: 15000})
    .catch(() => failures.push(`${label}: the icon font never settled`));
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(200);
};

// WCAG 2 contrast of the colours the badge really shows. Canvas reads any colour
// syntax a theme writes (oklch, color-mix) and composes alpha over the page.
const inkOf = (id) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  const pixel = () => [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
  const paint = (colour) => {
    context.fillStyle = colour;
    context.fillRect(0, 0, 1, 1);
    return pixel();
  };
  const luminance = (rgb) => {
    const [r, g, b] = rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (one, two) => {
    const [high, low] = [luminance(one), luminance(two)].sort((a, b) => b - a);
    return Math.round(((high + 0.05) / (low + 0.05)) * 100) / 100;
  };
  const badge = document.querySelector(`#${id} .sf-badge`);
  paint(getComputedStyle(document.body).backgroundColor);
  const fill = paint(getComputedStyle(badge).backgroundColor);
  const text = paint(getComputedStyle(badge.querySelector('.sf-badge-text')).color);
  paint(`rgb(${fill.join(' ')})`);
  const mark = paint(getComputedStyle(badge.querySelector('.sf-icon, .sf-badge-spinner')).color);
  return {text: ratio(text, fill), mark: ratio(mark, fill)};
};

const failures = [];
const seen = {contrast: {}};
const browser = await chromium.launch();
try {
  for (const theme of ['theme-light', 'theme-dark']) {
    for (const lang of ['ru', 'en']) {
      const label = `${theme} ${lang}`;
      // The Loader writes the theme class from the system's preference.
      const tab = await browser.newPage({viewport: {width: 1280, height: 900}, colorScheme: theme === 'theme-dark' ? 'dark' : 'light'});
      await tab.goto(url(lang, theme));
      await settled(tab, failures, label);
      if (!await tab.evaluate((name) => document.documentElement.classList.contains(name), theme)) failures.push(`${label}: the page is not in that theme`);
      const said = words(lang);

      const drawn = await tab.evaluate((states) => Object.fromEntries(Object.keys(states).map((state) => {
        const badge = document.querySelector(`#plain-${state} .sf-badge`);
        const icon = badge.querySelector('.sf-icon');
        const range = document.createRange();
        if (icon) range.selectNodeContents(icon);
        const svg = badge.querySelector('.sf-badge-spinner svg');
        return [state, {
          classes: [...badge.classList],
          icon: icon?.textContent.trim() ?? null,
          glyph: icon ? range.getBoundingClientRect().width : null,
          em: icon ? parseFloat(getComputedStyle(icon).fontSize) : null,
          spinner: svg ? svg.getBoundingClientRect().width : null,
          text: badge.querySelector('.sf-badge-text')?.textContent ?? null,
          shown: badge.querySelector('.sf-badge-text').getBoundingClientRect().width,
        }];
      })), STATES);
      for (const [state, {role, icon}] of Object.entries(STATES)) {
        const one = drawn[state];
        if (one.text !== said[`activity-${state}`]) failures.push(`${label} ${state}: the word is ${one.text}`);
        if (!one.classes.includes(`sf-badge--${role}`)) failures.push(`${label} ${state}: not the ${role} role: ${one.classes}`);
        if (!(one.shown > 8)) failures.push(`${label} ${state}: the word is not seen (${one.shown})`);
        if (icon) {
          if (one.icon !== icon) failures.push(`${label} ${state}: the icon is ${one.icon}`);
          if (!(one.glyph > 0 && one.glyph <= one.em * 1.2)) failures.push(`${label} ${state}: ${icon} is no glyph of the font: ${one.glyph} wide at ${one.em}`);
        } else {
          if (one.icon !== null) failures.push(`${label} ${state}: an icon beside the spinner`);
          if (!(one.spinner > 0)) failures.push(`${label} ${state}: no spinner drawn`);
        }
      }

      // AA, measured, in every appearance.
      if (lang === 'ru') {
        const contrast = await tab.evaluate(({states, appearances, measure}) => {
          const inkOfBadge = new Function(`return (${measure})`)();
          const result = {};
          for (const state of Object.keys(states)) for (const appearance of appearances) result[`${state}/${appearance}`] = inkOfBadge(`ink-${state}-${appearance}`);
          return result;
        }, {states: STATES, appearances: APPEARANCES, measure: inkOf.toString()});
        seen.contrast[theme] = contrast;
        for (const [name, {text, mark}] of Object.entries(contrast)) {
          if (text < 4.5) failures.push(`${theme} ${name}: text contrast ${text} is under AA 4.5`);
          if (mark < 3) failures.push(`${theme} ${name}: mark contrast ${mark} is under 3`);
        }
      }

      // Compact: the mark seen alone, a square box, the word as the name.
      const compact = await tab.evaluate((states) => Object.fromEntries(Object.keys(states).map((state) => {
        const badge = document.querySelector(`#compact-${state} .sf-badge`);
        const box = badge.getBoundingClientRect();
        const text = badge.querySelector('.sf-badge-text-container').getBoundingClientRect();
        const mark = badge.querySelector('.sf-icon, .sf-badge-spinner').getBoundingClientRect();
        return [state, {
          appearance: badge.classList.contains('sf-badge--main'),
          box: [box.width, box.height],
          text: [text.width, text.height],
          mark: [mark.width, mark.height],
          icon: badge.querySelector('.sf-icon')?.textContent.trim() ?? null,
          ariaHidden: badge.getAttribute('aria-hidden'),
        }];
      })), STATES);
      for (const [state, {icon}] of Object.entries(STATES)) {
        const one = compact[state];
        if (one.icon !== icon) failures.push(`${label} compact ${state}: the shape is ${one.icon}`);
        if (!one.appearance) failures.push(`${label} compact ${state}: the appearance moved`);
        if (!(one.mark[0] > 0)) failures.push(`${label} compact ${state}: no mark seen`);
        if (one.text[0] > 1 || one.text[1] > 1) failures.push(`${label} compact ${state}: the text is seen (${one.text})`);
        if (Math.abs(one.box[0] - one.box[1]) > 0.5) failures.push(`${label} compact ${state}: the box is not square (${one.box})`);
        const name = (await tab.locator(`#compact-${state}`).ariaSnapshot()).trim();
        seen[`name ${lang} ${state}`] = name;
        if (!name.includes(said[`activity-${state}`])) failures.push(`${label} compact ${state}: the accessible name is ${name}`);
      }
      const labelled = (await tab.locator('#labelled').ariaSnapshot()).trim();
      if (!labelled.includes('Build 12 failed') || labelled.includes(said['activity-failed'])) failures.push(`${label}: compact with aria-label says ${labelled}`);

      // Everything that is one question per page.
      const rest = await tab.evaluate(() => {
        const part = (id) => document.querySelector(`#${id} .sf-badge`);
        const colours = (id) => {
          const style = getComputedStyle(part(id));
          return [style.backgroundColor, style.color];
        };
        return {
          over: {
            classes: [...part('over').classList],
            icon: part('over').querySelector('.sf-icon')?.textContent.trim(),
            text: part('over').querySelector('.sf-badge-text').textContent,
            colours: colours('over'),
            twin: colours('plain-failed-twin'),
            status: document.querySelector('#over').status,
            scheme: document.querySelector('#over').scheme,
          },
          runningColours: colours('plain-running'),
          stoppedColours: colours('plain-stopped'),
          neutralColours: colours('neutral-twin'),
          ownText: part('own-text').querySelector('.sf-badge-text').textContent,
          ownTextIcon: part('own-text').querySelector('.sf-icon')?.textContent.trim(),
          ownIcon: part('own-icon').querySelector('.sf-icon')?.textContent.trim(),
          ownIconSpinner: Boolean(part('own-icon').querySelector('.sf-badge-spinner')),
          emptied: part('emptied').querySelector('.sf-icon')?.textContent.trim(),
          endLast: part('end').lastElementChild?.classList.contains('sf-badge-spinner'),
          unknown: {icon: part('unknown').querySelector('.sf-icon, .sf-badge-spinner') === null, value: document.querySelector('#unknown').activity},
          none: part('none').querySelector('.sf-icon, .sf-badge-spinner') === null,
          bare: {compact: part('bare').classList.contains('sf-badge--compact'), width: part('bare').querySelector('.sf-badge-text').getBoundingClientRect().width},
          live: document.querySelectorAll('[aria-live], [role=status], [role=alert], [aria-busy]').length,
          sameBox: ['running', 'waiting', 'done', 'stopped', 'failed'].flatMap((state) => ['1-3', '1-2', '1'].map((size) => {
            const box = part(`size-${state}-${size}`).getBoundingClientRect();
            const mark = part(`size-${state}-${size}`).querySelector('.sf-icon, .sf-badge-spinner').getBoundingClientRect();
            return {state, size, box: [box.width, box.height], mark: [mark.width, mark.height]};
          })),
        };
      });
      seen[`rest ${label}`] = {spinnerBox: rest.sameBox.filter(({state}) => state === 'running' || state === 'done')};
      if (!rest.over.classes.includes('sf-badge--error') || rest.over.classes.includes('sf-badge--success') || rest.over.classes.includes('sf-badge--primary')) failures.push(`${label}: activity did not win the colour: ${rest.over.classes}`);
      if (rest.over.icon !== 'error' || rest.over.text !== said['activity-failed']) failures.push(`${label}: activity did not win the icon or the text: ${rest.over.icon} ${rest.over.text}`);
      if (rest.over.colours.join() !== rest.over.twin.join()) failures.push(`${label}: failed is not painted as status error: ${rest.over.colours} / ${rest.over.twin}`);
      if (rest.over.status !== 'success' || rest.over.scheme !== 'primary') failures.push(`${label}: status and scheme did not stay readable: ${rest.over.status} ${rest.over.scheme}`);
      if (rest.runningColours.join() !== rest.neutralColours.join() || rest.stoppedColours.join() !== rest.neutralColours.join()) failures.push(`${label}: running or stopped is not neutral`);
      if (rest.ownText !== 'Published' || rest.ownTextIcon !== 'check_circle') failures.push(`${label}: text did not override the word alone: ${rest.ownText} ${rest.ownTextIcon}`);
      if (rest.ownIcon !== 'sync' || rest.ownIconSpinner) failures.push(`${label}: icon did not override the spinner: ${rest.ownIcon}`);
      if (rest.emptied !== 'check_circle') failures.push(`${label}: an emptied icon-start took the mark away: ${rest.emptied}`);
      if (!rest.endLast) failures.push(`${label}: icon-position end did not move the spinner`);
      if (!rest.unknown.icon || rest.unknown.value !== '') failures.push(`${label}: an unknown activity draws a mark or reads ${rest.unknown.value}`);
      if (!rest.none) failures.push(`${label}: no activity, yet a mark`);
      if (rest.bare.compact || !(rest.bare.width > 0)) failures.push(`${label}: compact with nothing to show hid the text`);
      if (rest.live !== 0) failures.push(`${label}: a live region or aria-busy on the page (${rest.live})`);
      const reference = Object.fromEntries(rest.sameBox.filter(({state}) => state === 'done').map(({size, box, mark}) => [size, {box, mark}]));
      for (const {state, size, box, mark} of rest.sameBox) {
        if (JSON.stringify(mark) !== JSON.stringify(reference[size].mark)) failures.push(`${label} ${state} size ${size}: the mark's box ${mark} differs from the icon's ${reference[size].mark}`);
        if (JSON.stringify(box) !== JSON.stringify(reference[size].box)) failures.push(`${label} ${state} size ${size}: the badge ${box} differs from ${reference[size].box}`);
      }

      // The state follows the setting, both ways, as attribute and property.
      const changed = await tab.evaluate(async () => {
        const host = document.querySelector('#live');
        const read = async () => {
          await new Promise((settle) => setTimeout(settle, 60));
          const badge = host.querySelector('.sf-badge');
          return {icon: badge.querySelector('.sf-icon')?.textContent.trim() ?? null, spinner: Boolean(badge.querySelector('.sf-badge-spinner')), error: badge.classList.contains('sf-badge--error'), compact: badge.classList.contains('sf-badge--compact')};
        };
        const steps = [];
        host.activity = 'failed';
        steps.push(await read());
        host.setAttribute('activity', 'running');
        host.setAttribute('compact', '');
        steps.push(await read());
        host.removeAttribute('activity');
        host.removeAttribute('compact');
        steps.push(await read());
        return steps;
      });
      const expected = [
        {icon: 'error', spinner: false, error: true, compact: false},
        {icon: null, spinner: true, error: false, compact: true},
        {icon: null, spinner: false, error: false, compact: false},
      ];
      if (JSON.stringify(changed) !== JSON.stringify(expected)) failures.push(`${label}: the state did not follow the setting: ${JSON.stringify(changed)}`);

      // The spinner turns; its look is the page's.
      const turning = await tab.evaluate(() => {
        const svg = document.querySelector('#plain-running .sf-badge-spinner svg');
        return {name: getComputedStyle(svg).animationName, running: svg.getAnimations().some((animation) => animation.playState === 'running')};
      });
      if (turning.name === 'none' || !turning.running) failures.push(`${label}: the spinner does not turn: ${JSON.stringify(turning)}`);
      await tab.close();
    }
  }

  // The box does not move when the lazily fetched spinner sheet arrives.
  const held = await browser.newPage({viewport: {width: 1280, height: 900}});
  let release = () => {};
  const gate = new Promise((settle) => { release = settle; });
  await held.route(SPINNER_SHEET, async (route) => {
    await gate;
    await route.continue();
  });
  await held.goto(url('ru', 'theme-light'));
  await held.waitForFunction(() => document.querySelector('#plain-running .sf-badge-spinner svg'), null, {timeout: 20000})
    .catch(() => failures.push('held: the spinner never drew'));
  await held.waitForTimeout(300);
  const box = () => held.evaluate(() => ['plain-running', 'compact-running'].map((id) => {
    const badge = document.querySelector(`#${id} .sf-badge`);
    const rect = badge.getBoundingClientRect();
    const mark = badge.querySelector('.sf-badge-spinner').getBoundingClientRect();
    // Beside the word: the text font arriving may move the word by a fraction.
    const word = badge.querySelector('.sf-badge-text').getBoundingClientRect();
    return [rect.width - word.width, rect.height, mark.width, mark.height];
  }));
  const before = await box();
  const sheetEarly = await held.evaluate((pattern) => Array.from(document.styleSheets).some((sheet) => new RegExp(pattern, 'u').test(sheet.href || '')), SPINNER_SHEET.source);
  if (sheetEarly) failures.push('held: the spinner sheet was not held back');
  release();
  await held.waitForFunction((pattern) => Array.from(document.styleSheets).some((sheet) => new RegExp(pattern, 'u').test(sheet.href || '')), SPINNER_SHEET.source, {timeout: 15000})
    .catch(() => failures.push('held: the spinner sheet never arrived'));
  await held.waitForTimeout(100);
  const after = await box();
  seen.spinnerSheet = {before, after};
  if (JSON.stringify(before) !== JSON.stringify(after)) failures.push(`the running badge moved when the spinner sheet arrived: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  await held.close();

  // Reduced motion: the spinner stands still, its arc still seen.
  const calm = await browser.newContext({reducedMotion: 'reduce', viewport: {width: 1280, height: 900}});
  const still = await calm.newPage();
  await still.goto(url('ru', 'theme-light'));
  await settled(still, failures, 'reduced motion');
  const stillness = await still.evaluate(() => {
    const svg = document.querySelector('#plain-running .sf-badge-spinner svg');
    const accent = svg.querySelector('.sf-loader-ring-accent');
    return {
      name: getComputedStyle(svg).animationName,
      animations: svg.getAnimations({subtree: true}).length,
      accent: getComputedStyle(accent).display,
      accentOpacity: getComputedStyle(accent).opacity,
      width: svg.getBoundingClientRect().width,
    };
  });
  seen.reducedMotion = stillness;
  if (stillness.name !== 'none' || stillness.animations !== 0) failures.push(`reduced motion: the spinner still turns: ${JSON.stringify(stillness)}`);
  if (stillness.accent === 'none' || stillness.accentOpacity === '0' || !(stillness.width > 0)) failures.push(`reduced motion: no still frame: ${JSON.stringify(stillness)}`);
  await calm.close();
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({seen, failures}, null, 1));
process.exitCode = failures.length ? 1 : 0;
