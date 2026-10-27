#!/usr/bin/env node
// Usage: node this-file /absolute/path/to/output
//
// The spinner's looks (simai/ui-source#11), measured on the built bytes: arc,
// breathing, comet and dots, all on the ring and the size ladder of #10.
//   - for every look, at every step 1/3 to 3 and on both sides of the 60rem
//     breakpoint (widths 1000 and 390), every kind of spinner -- sf-spinner,
//     the ordinary .sf-loader-container, a loading sf-button (icon, no icon,
//     icon-only), sf-icon-button, sf-button-group default and segmented --
//     shows that look; its box is the sf-icon box of an sf-button of that
//     size; a loading button is as wide as a resting one;
//   - the look is one page-wide setting: data-sf-spinner on html, changed while
//     the page runs, changes every kind of spinner (the modal's loading state
//     included); a block's own data-sf-spinner wins over html's, a spinner's
//     data-variant (kind on sf-spinner) over both; an unknown name is the arc,
//     an empty one inherits; SF_BOOT_CONFIG.spinner writes it on html unless
//     the page wrote its own;
//   - every look draws in the current ink, and --sf-loader--color replaces it;
//   - every look moves (arc, breathing and comet turn), and under reduced
//     motion every look is a still frame: two frames apart are the same pixels;
//   - the arc (simai/ui-source#13), at every step and in every kind of
//     spinner, is a fixed 30% of the ring with round caps: its dash is the same
//     in every frame while the drawing turns, linear, one turn a second, by as
//     much as the time between two frames says; breathing's length changes;
//     under reduced motion the arc is the same 30%, still.
import {resolve, join} from 'node:path';
import {chromium} from 'playwright';

if (!process.argv[2]) throw new Error('Build output root is required');
const out = resolve(process.argv[2]);

const SHEETS = ['core/core/css/core.css', 'component/component/icons/css/icons.css', 'component/component/buttons/css/buttons.css',
  'component/component/icon-buttons/css/icon-buttons.css', 'component/component/button-group/css/button-group.css',
  'component/component/modal/css/modal.css', 'component/component/spinner/css/spinner.css'];
const SCRIPTS = ['core/core/js/core.js', 'core/core/js/smart-base.js', 'smart/smart/icon/js/icon.js', 'smart/smart/button/js/button.js',
  'smart/smart/icon-buttons/js/icon-buttons.js', 'component/component/button-group/js/button-group.js', 'smart/smart/button-group/js/button-group.js',
  'component/component/spinner/js/spinner.js', 'smart/smart/spinner/js/spinner.js', 'smart/smart/modal/js/modal.js'];
const SIZES = ['1/3', '1/2', '1', '2', '3'];
const LOOKS = ['arc', 'breathing', 'comet', 'dots'];

const failures = [];
const evidence = {};
const check = (name, pass, detail = {}) => { if (!pass) failures.push({name, ...detail}); };
const near = (a, b, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

const browser = await chromium.launch();

async function open({width = 1000, body = '', reducedMotion = 'no-preference', html = ''} = {}) {
  const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion});
  // core.js added as an inline module cannot work out its own address; every
  // probe that adds it this way sees that one error, and it changes nothing here.
  page.on('pageerror', (error) => { if (!/publicPath/u.test(error.message)) failures.push({name: 'page error', said: error.message}); });
  // The modal's remote content never arrives, so it stays in its loading state.
  await page.route('http://spinner.probe/**', () => {});
  await page.setContent(`<!doctype html><html lang="ru" class="theme-light"${html}><head><meta charset="utf-8"></head><body style="margin:16px">${body}</body></html>`);
  for (const path of SHEETS) await page.addStyleTag({path: join(out, path)});
  for (const path of SCRIPTS) await page.addScriptTag({path: join(out, path), type: 'module'}).catch(() => {});
  await page.waitForFunction(() => ['sf-button', 'sf-icon-button', 'sf-button-group', 'sf-spinner'].every((tag) => customElements.get(tag)));
  await page.waitForFunction(() => [...document.querySelectorAll('.sf-loader-container')].every((node) => node.querySelector('.sf-loader-svg')));
  await page.waitForTimeout(500);
  return page;
}

const items = (list) => `items='${JSON.stringify(list)}'`;
const TEXT = [{value: 'a', label: 'Сохранить'}, {value: 'b', label: 'Отправить'}];
const WITH_ICON = [{value: 'a', label: 'Сохранить', icon: 'save'}, {value: 'b', label: 'Отправить', icon: 'send'}];
const ICON_ONLY = [{value: 'a', label: 'Сохранить', icon: 'save', 'icon-only': true}, {value: 'b', label: 'Отправить', icon: 'send', 'icon-only': true}];
const loadingFirst = (list) => list.map((item, index) => (index === 0 ? {...item, loading: true} : item));

// What a spinner shows: the look read from the layers the page paints (and,
// for the two arcs, the motion of the arc), its box, and the colour of the
// visible drawing beside the ink it should follow.
const LOOK = `(root) => {
  const style = (selector) => getComputedStyle(root.querySelector(selector));
  const shown = (selector) => style(selector).display !== 'none';
  const motion = getComputedStyle(root).getPropertyValue('--sf-loader--look-motion').trim() || 'none';
  const layers = {track: shown('.sf-loader-ring-filled'), arc: shown('.sf-loader-ring-accent'), comet: shown('.sf-loader-comet'), dots: shown('.sf-loader-dots')};
  const visible = Object.entries(layers).filter(([key, on]) => on && key !== 'track').map(([key]) => key);
  let look = visible.length === 1 ? visible[0] : 'mixed:' + visible.join('+');
  if (look === 'arc' && motion === 'sf-loader-breathing') look = 'breathing';
  const paint = look === 'dots' ? style('.sf-loader-dot').fill : look === 'comet' ? style('.sf-loader-comet-head').stroke : style('.sf-loader-ring-accent').stroke;
  const box = (root.querySelector(':scope > .sf-loader--loading-indicator') || root).getBoundingClientRect();
  return {
    look, layers, paint, ink: getComputedStyle(root).color,
    width: box.width, height: box.height,
    spin: getComputedStyle(root.querySelector('.sf-loader-svg')).animationName,
    arcMotion: style('.sf-loader-ring-accent').animationName,
    dotMotion: style('.sf-loader-dot').animationName,
  };
}`;

try {
  // 1. Every look x every step x both widths, the look switched on html while
  // the page runs: every kind of spinner follows, keeps the icon box, and no
  // loading button changes width.
  for (const width of [1000, 390]) {
    const body = SIZES.map((size) => `<div data-row="${size}" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;margin-block-end:8px">
      <sf-button size="${size}" icon="save" text="Сохранить" class="k-icon s-rest"></sf-button>
      <sf-button size="${size}" icon="save" text="Сохранить" loading class="k-icon s-load"></sf-button>
      <sf-button size="${size}" text="Сохранить" class="k-text s-rest"></sf-button>
      <sf-button size="${size}" text="Сохранить" loading class="k-text s-load"></sf-button>
      <sf-button size="${size}" icon="save" aria-label="Сохранить" class="k-only s-rest"></sf-button>
      <sf-button size="${size}" icon="save" aria-label="Сохранить" loading class="k-only s-load"></sf-button>
      <sf-icon-button size="${size}" icon="save" aria-label="Сохранить" class="k-iconbutton s-rest"></sf-icon-button>
      <sf-icon-button size="${size}" icon="save" aria-label="Сохранить" loading class="k-iconbutton s-load"></sf-icon-button>
      <sf-button-group size="${size}" aria-label="Действие" value="b" ${items(WITH_ICON)} class="k-group s-rest"></sf-button-group>
      <sf-button-group size="${size}" aria-label="Действие" value="b" ${items(loadingFirst(WITH_ICON))} class="k-group s-load"></sf-button-group>
      <sf-button-group appearance="segmented" size="${size}" aria-label="Действие" value="b" ${items(TEXT)} class="k-segtext s-rest"></sf-button-group>
      <sf-button-group appearance="segmented" size="${size}" aria-label="Действие" value="b" ${items(loadingFirst(TEXT))} class="k-segtext s-load"></sf-button-group>
      <sf-button-group appearance="segmented" size="${size}" aria-label="Действие" value="b" ${items(ICON_ONLY)} class="k-segonly s-rest"></sf-button-group>
      <sf-button-group appearance="segmented" size="${size}" aria-label="Действие" value="b" ${items(loadingFirst(ICON_ONLY))} class="k-segonly s-load"></sf-button-group>
      <sf-spinner size="${size}" infinite label="" class="k-smart"></sf-spinner>
      <div class="sf-loader-container sf-loader--size-${size} k-ordinary" data-infinite="true"></div>
    </div>`).join('') + `<sf-modal id="modal" display="inline" mode="ajax" src="http://spinner.probe/never" preload></sf-modal>`;
    const page = await open({width, body});
    await page.waitForFunction(() => document.querySelectorAll('sf-button-group button').length === 5 * 6 * 2);
    // Its content is asked for again and never arrives: the loading state stays.
    await page.evaluate(() => { document.getElementById('modal').reloadContent(); });
    await page.waitForFunction(() => document.querySelector('#modal .sf-modal-spinner .sf-loader-svg'), null, {timeout: 5000}).catch(() => {});
    const table = {};
    for (const look of LOOKS) {
      await page.evaluate((value) => document.documentElement.setAttribute('data-sf-spinner', value), look);
      await page.waitForTimeout(150);
      const rows = await page.evaluate(({sizes, source}) => {
        const read = eval(source);
        const of = (node) => node.getBoundingClientRect();
        const spinnerIn = (host) => host.querySelector('button > .sf-loader-container');
        return sizes.map((size) => {
          const row = document.querySelector(`[data-row="${size}"]`);
          const pick = (kind, state) => row.querySelector(`.k-${kind}.s-${state}`);
          const icon = of(row.querySelector('.k-icon.s-rest .sf-icon'));
          const iconButtonIcon = of(row.querySelector('.k-iconbutton.s-rest .sf-icon'));
          const kinds = {};
          for (const kind of ['icon', 'text', 'only', 'iconbutton', 'group', 'segtext', 'segonly']) {
            const rest = [...pick(kind, 'rest').querySelectorAll('button')].map((node) => of(node).width);
            const load = [...pick(kind, 'load').querySelectorAll('button')].map((node) => of(node).width);
            kinds[kind] = {rest, load, spinner: read(spinnerIn(pick(kind, 'load')))};
          }
          kinds.smart = {spinner: read(row.querySelector('.k-smart .sf-loader-container'))};
          kinds.ordinary = {spinner: read(row.querySelector('.k-ordinary'))};
          return {size, icon: {width: icon.width, height: icon.height}, iconButtonIcon: {width: iconButtonIcon.width, height: iconButtonIcon.height}, kinds};
        });
      }, {sizes: SIZES, source: LOOK});
      const modal = await page.evaluate((source) => {
        const node = document.querySelector('#modal .sf-modal-spinner');
        return node ? eval(source)(node) : null;
      }, LOOK);
      table[look] = Object.fromEntries(rows.map((row) => [row.size, Number(row.kinds.smart.spinner.width.toFixed(2))]));
      for (const row of rows) {
        const at = `${look}, size ${row.size} at ${width}px`;
        for (const [kind, {rest, load, spinner}] of Object.entries(row.kinds)) {
          const iconBox = kind === 'iconbutton' ? row.iconButtonIcon : row.icon;
          check(`${at} ${kind}: shows the page's look`, spinner.look === look, {spinner});
          check(`${at} ${kind}: the box is the button's icon box`, near(spinner.width, iconBox.width) && near(spinner.height, iconBox.height) && iconBox.width > 0, {icon: iconBox, spinner: {width: spinner.width, height: spinner.height}});
          check(`${at} ${kind}: the drawing is in the spinner's ink`, spinner.paint === spinner.ink, {paint: spinner.paint, ink: spinner.ink});
          check(`${at} ${kind}: the track only under the ring looks`, spinner.layers.track === (look !== 'dots'), spinner.layers);
          if (rest) check(`${at} ${kind}: loading keeps every width`, rest.length === load.length && rest.every((value, index) => near(value, load[index])), {rest, load});
        }
      }
      check(`${look} at ${width}px: the modal's loading spinner follows the page`, modal?.look === look, {modal});
      if (width === 1000) evidence[`modal@${look}`] = modal && {look: modal.look, width: modal.width};
    }
    evidence[`box@${width}`] = table;
    check(`no horizontal scroll at ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await page.close();
  }

  // 2. Precedence: a block over html, the spinner's own look over both; an
  // unknown name is the arc, an empty one inherits; a change on html reaches
  // every spinner that does not answer to something nearer.
  {
    const kinds = (prefix, extra = '') => `
      <sf-spinner infinite label="" id="${prefix}-smart" ${extra ? `kind="${extra}"` : ''}></sf-spinner>
      <div class="sf-loader-container" data-infinite="true" id="${prefix}-ordinary" ${extra ? `data-variant="${extra}"` : ''}></div>
      ${extra ? '' : `<sf-button id="${prefix}-button" text="Сохранить" loading></sf-button>
      <sf-icon-button id="${prefix}-iconbutton" icon="save" aria-label="Сохранить" loading></sf-icon-button>
      <sf-button-group id="${prefix}-group" appearance="segmented" aria-label="Действие" value="b" ${items(loadingFirst(TEXT))}></sf-button-group>`}`;
    const page = await open({html: ' data-sf-spinner="comet"', body: `
      <section id="page">${kinds('page')}</section>
      <section id="block" data-sf-spinner="dots">${kinds('block')}<div data-sf-spinner="">${kinds('empty')}</div>${kinds('own', 'breathing')}</section>
      <section id="unknown" data-sf-spinner="nonsense">${kinds('unknown')}</section>
      <section id="instance">${kinds('arc', 'arc')}</section>`});
    const read = () => page.evaluate((source) => {
      const look = eval(source);
      return Object.fromEntries([...document.querySelectorAll('[id$="-smart"], [id$="-ordinary"], [id$="-button"], [id$="-iconbutton"], [id$="-group"]')].map((node) => {
        const root = node.matches('.sf-loader-container') ? node : node.querySelector('.sf-loader-container');
        return [node.id, look(root).look];
      }));
    }, LOOK);
    const before = await read();
    await page.evaluate(() => document.documentElement.setAttribute('data-sf-spinner', 'breathing'));
    await page.waitForTimeout(150);
    const after = await read();
    evidence.precedence = {before, after};
    const expect = (looks, pageLook) => Object.entries(looks).every(([id, look]) => {
      const prefix = id.split('-')[0];
      const want = {page: pageLook, block: 'dots', empty: 'dots', own: 'breathing', unknown: 'arc', arc: 'arc'}[prefix];
      return look === want;
    });
    check('html names the look; a block wins over it; the spinner over both; unknown is arc; empty inherits', Object.keys(before).length === 24 && expect(before, 'comet'), {before});
    check('a change on html reaches every spinner that answers to it, and no other', expect(after, 'breathing'), {after});
    await page.close();
  }

  // 3. SF_BOOT_CONFIG.spinner writes the page's look, unless html has its own.
  // Served from an address, so core.js knows where it is and runs whole.
  for (const own of ['', ' data-sf-spinner="comet"']) {
    const page = await browser.newPage();
    await page.route('http://spinner.probe/**', async (route) => {
      const {pathname} = new URL(route.request().url());
      if (pathname === '/') {
        await route.fulfill({contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ru"${own}><head><meta charset="utf-8">
          <script>window.SF_BOOT_CONFIG = {spinner: 'dots', icons: {enabled: false}};</script>
          <script src="/distr/core/core/js/core.js"></script></head><body></body></html>`});
        return;
      }
      if (pathname.startsWith('/distr/')) {
        await route.fulfill({path: join(out, pathname.slice('/distr/'.length))}).catch(() => route.fulfill({status: 404, body: ''}));
        return;
      }
      await route.fulfill({status: 404, body: ''});
    });
    await page.goto('http://spinner.probe/');
    await page.waitForTimeout(300);
    const look = await page.evaluate(() => document.documentElement.getAttribute('data-sf-spinner'));
    evidence[own ? 'bootKept' : 'boot'] = look;
    check(own ? 'a page that names its own look keeps it over SF_BOOT_CONFIG' : 'SF_BOOT_CONFIG.spinner sets the look on html', look === (own ? 'comet' : 'dots'), {look});
    await page.close();
  }

  // 4. The ink, and --sf-loader--color over it, in every look.
  {
    const page = await open({body: `<div id="ink" style="color: rgb(10, 120, 30)">${LOOKS.map((look) => `<sf-spinner kind="${look}" infinite label=""></sf-spinner>`).join('')}</div>
      <div id="set" style="--sf-loader--color: rgb(200, 0, 0); color: rgb(10, 120, 30)">${LOOKS.map((look) => `<div class="sf-loader-container" data-variant="${look}" data-infinite="true"></div>`).join('')}</div>`});
    const colours = await page.evaluate((source) => {
      const look = eval(source);
      return {
        ink: [...document.querySelectorAll('#ink .sf-loader-container')].map((node) => look(node)).map(({look: name, paint}) => ({look: name, paint})),
        set: [...document.querySelectorAll('#set .sf-loader-container')].map((node) => look(node)).map(({look: name, paint}) => ({look: name, paint})),
      };
    }, LOOK);
    evidence.colour = colours;
    check('every look draws in the current ink', colours.ink.map((row) => row.look).join() === LOOKS.join() && colours.ink.every((row) => row.paint === 'rgb(10, 120, 30)'), colours);
    check('--sf-loader--color colours every look', colours.set.map((row) => row.look).join() === LOOKS.join() && colours.set.every((row) => row.paint === 'rgb(200, 0, 0)'), colours);
    await page.close();
  }

  // 5. Motion: every look moves without reduced motion (breathing and comet
  // turn); under reduced motion every look is a still frame.
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await open({reducedMotion, body: LOOKS.map((look) => `<div id="${look}" data-sf-spinner="${look}" style="display:flex;gap:8px;padding:4px;inline-size:max-content">
      <sf-spinner size="3" infinite label=""></sf-spinner>
      <sf-button size="3" icon="save" text="Сохранить" loading></sf-button>
      <sf-icon-button size="3" icon="save" aria-label="Сохранить" loading></sf-icon-button>
      <sf-button-group appearance="segmented" size="3" aria-label="Действие" value="b" ${items(loadingFirst(TEXT))}></sf-button-group></div>`).join('')});
    const motion = {};
    for (const look of LOOKS) {
      const block = page.locator(`#${look}`);
      const frames = [];
      for (let index = 0; index < 3; index += 1) {
        frames.push(await block.screenshot());
        await page.waitForTimeout(350);
      }
      const styles = await page.evaluate(({id, source}) => [...document.querySelectorAll(`#${id} .sf-loader-container`)].map((node) => eval(source)(node)), {id: look, source: LOOK});
      motion[look] = {
        moved: frames.some((frame, index) => index > 0 && !frame.equals(frames[index - 1])),
        still: frames.every((frame) => frame.equals(frames[0])),
        looks: [...new Set(styles.map((row) => row.look))],
        spin: [...new Set(styles.map((row) => row.spin))],
        arc: [...new Set(styles.map((row) => row.arcMotion))],
        dot: [...new Set(styles.map((row) => row.dotMotion))],
      };
    }
    evidence[`motion:${reducedMotion}`] = motion;
    for (const look of LOOKS) {
      const row = motion[look];
      check(`${look} (${reducedMotion}): every kind of spinner shows it`, row.looks.length === 1 && row.looks[0] === look, row);
      if (reducedMotion === 'reduce') {
        check(`${look}: a still frame under reduced motion`, row.still && row.spin.join() === 'none' && row.arc.join() === 'none' && row.dot.join() === 'none', row);
      } else {
        check(`${look}: it moves`, row.moved, row);
      }
    }
    check('arc, breathing and comet turn; dots do not; only breathing moves its arc', reducedMotion === 'reduce'
      || (motion.breathing.spin.join() === 'sf-loader-svg-rotate' && motion.comet.spin.join() === 'sf-loader-svg-rotate'
        && motion.arc.spin.join() === 'sf-loader-svg-rotate' && motion.dots.spin.join() === 'none'
        && motion.breathing.arc.join() === 'sf-loader-breathing' && motion.arc.arc.join() === 'none'
        && motion.dots.dot.join() === 'sf-loader-dot-wave'), motion);
    await page.close();
  }

  // 6. The arc (simai/ui-source#13): a fixed 30% of the ring that turns. At
  // every step, in sf-spinner, the ordinary spinner and a loading button, and
  // in breathing beside it: frames ~250 ms apart, each read with the time of
  // the turn, so a loaded machine that skips frames still measures the turn
  // the clock says.
  {
    const kinds = (size, look) => `<div data-look="${look}" data-sf-spinner="${look}" data-size="${size}" style="display:flex;gap:8px;padding:4px">
      <sf-spinner size="${size}" infinite label=""></sf-spinner>
      <div class="sf-loader-container sf-loader--size-${size}" data-infinite="true"></div>
      <sf-button size="${size}" icon="save" text="Сохранить" loading></sf-button></div>`;
    const ARC = `(root) => {
      const svg = root.querySelector('.sf-loader-svg');
      const accent = root.querySelector('.sf-loader-ring-accent');
      const style = getComputedStyle(accent);
      const turn = getComputedStyle(svg);
      const matrix = new DOMMatrixReadOnly(turn.transform === 'none' ? undefined : turn.transform);
      const animation = svg.getAnimations().find((item) => item.animationName === 'sf-loader-svg-rotate');
      const dash = style.strokeDasharray.split(/[ ,]+/u).map(parseFloat);
      return {
        dash, offset: parseFloat(style.strokeDashoffset) || 0, path: Number(accent.getAttribute('pathLength')),
        fraction: dash[0] / Number(accent.getAttribute('pathLength')),
        length: dash[0] / Number(accent.getAttribute('pathLength')) * accent.getTotalLength(),
        cap: style.strokeLinecap, display: style.display,
        angle: (Math.atan2(matrix.b, matrix.a) * 180 / Math.PI + 360) % 360,
        time: animation ? Number(animation.currentTime) : null,
        name: turn.animationName, duration: turn.animationDuration, easing: turn.animationTimingFunction,
      };
    }`;
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const page = await open({reducedMotion, body: SIZES.map((size) => kinds(size, 'arc') + kinds(size, 'breathing')).join('')});
      const sample = () => page.evaluate((source) => {
        const read = eval(source);
        return [...document.querySelectorAll('[data-look]')].map((block) => ({
          look: block.dataset.look, size: block.dataset.size,
          kinds: [...block.querySelectorAll('.sf-loader-container')].map((node) => read(node)),
        }));
      }, ARC);
      const frames = [];
      const shots = {};
      for (let index = 0; index < 4; index += 1) {
        frames.push(await sample());
        if (reducedMotion === 'reduce' && index < 2) {
          for (const size of SIZES) (shots[size] ||= []).push(await page.locator(`[data-look="arc"][data-size="${size}"]`).screenshot());
        }
        await page.waitForTimeout(reducedMotion === 'reduce' ? 350 : 250);
      }
      const measured = {};
      for (const size of SIZES) {
        for (const look of ['arc', 'breathing']) {
          const series = frames.map((frame) => frame.find((row) => row.look === look && row.size === size).kinds);
          const kindsCount = series[0].length;
          for (let kind = 0; kind < kindsCount; kind += 1) {
            const at = `${look} size ${size} kind ${['sf-spinner', 'ordinary', 'button'][kind]} (${reducedMotion})`;
            const rows = series.map((frame) => frame[kind]);
            if (look === 'breathing') {
              if (reducedMotion === 'no-preference') {
                const lengths = rows.map((row) => row.dash[0]);
                check(`${at}: breathing's arc changes length`, Math.max(...lengths) - Math.min(...lengths) > 5, {lengths});
                if (kind === 0) measured[`breathing@${size}`] = lengths.map((value) => Number(value.toFixed(1)));
              }
              continue;
            }
            check(`${at}: the arc is shown, round-capped`, rows.every((row) => row.display !== 'none' && row.cap === 'round'), rows[0]);
            check(`${at}: the arc is 30% of the ring in every frame`, rows.every((row) => row.path === 100 && Math.abs(row.fraction - 0.3) <= 0.02 && Math.abs(row.dash[0] + row.dash[1] - 100) <= 0.01), {dash: rows.map((row) => row.dash)});
            check(`${at}: the arc's length and offset never change`, rows.every((row) => row.dash.join() === rows[0].dash.join() && row.offset === rows[0].offset && Math.abs(row.length - rows[0].length) < 0.001), {rows});
            if (reducedMotion === 'reduce') {
              check(`${at}: still under reduced motion`, rows.every((row) => row.name === 'none' && row.angle === rows[0].angle && row.time === null), {rows});
              continue;
            }
            check(`${at}: one linear turn a second`, rows.every((row) => row.name === 'sf-loader-svg-rotate' && row.duration === '1s' && row.easing === 'linear'), rows[0]);
            const turns = rows.slice(1).map((row, index) => {
              const previous = rows[index];
              const moved = (row.angle - previous.angle + 360) % 360;
              const expected = (((row.time - previous.time) / 1000) * 360 % 360 + 360) % 360;
              return {moved: Number(moved.toFixed(1)), expected: Number(expected.toFixed(1)), ms: Math.round(row.time - previous.time)};
            });
            const agrees = (turn) => Math.min(Math.abs(turn.moved - turn.expected), 360 - Math.abs(turn.moved - turn.expected)) <= 3;
            check(`${at}: the arc turns between frames, as far as the clock says`, turns.every(agrees) && turns.some((turn) => turn.moved > 5 && turn.moved < 355), {turns});
            if (kind === 0) measured[`arc@${size}`] = {fraction: rows.map((row) => Number(row.fraction.toFixed(3))), dash: rows[0].dash.join(' '), cap: rows[0].cap, length: Number(rows[0].length.toFixed(2)), duration: rows[0].duration, easing: rows[0].easing, turns};
          }
        }
      }
      if (reducedMotion === 'reduce') {
        for (const size of SIZES) {
          check(`arc size ${size}: two frames 350 ms apart are the same pixels under reduced motion`, shots[size][0].equals(shots[size][1]));
          measured[`arc@${size}`] = {...measured[`arc@${size}`], fraction: frames.map((frame) => Number(frame.find((row) => row.look === 'arc' && row.size === size).kinds[0].fraction.toFixed(3))), samePixels: shots[size][0].equals(shots[size][1])};
        }
      }
      evidence[`arc:${reducedMotion}`] = measured;
      await page.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(evidence));
if (failures.length) { console.error(JSON.stringify({failures: failures.slice(0, 40), count: failures.length}, null, 1)); process.exit(1); }
console.log('SPINNER_LOOKS_OK');
