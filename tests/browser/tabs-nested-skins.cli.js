async page => {
  const failures = [], errors = []; let cases = 0;
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  await page.setViewportSize({width: 1000, height: 900});
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
  for (const theme of ['light', 'dark']) {
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const n of ['buttons', 'tabs']) await page.addStyleTag({url: `${base}/component/${n}/css/${n}.css`});
    for (const n of ['icons', 'close', 'buttons', 'icon-buttons', 'tabs']) await page.addScriptTag({url: `${base}/smart/${n}/js/${n}.js`});
    const rows = await page.evaluate(async theme => {
      document.documentElement.className = `theme-${theme}`;
      const main = document.querySelector('main'); main.replaceChildren();
      const skins = ['', 'pills', 'underline', 'full', 'vertical'], pairs = [];
      const create = (type, smart, icons) => {
        if (smart) {
          const e = document.createElement('sf-tabs'); e.setAttribute('type', type);
          e.setAttribute('items', 'Обзор::icon=home|История::icon=history');
          e.setAttribute('variant', icons ? 'icons' : 'buttons'); return e;
        }
        const e = document.createElement('div'), cls = icons ? 'sf-icon-button' : 'sf-button';
        e.className = `sf-tabs ${type ? `sf-tabs--${type}` : ''} flex ${type === 'vertical' ? '' : 'flex-col'}`;
        e.innerHTML = `<div class="sf-tabs-top-container"><div class="sf-tabs-top flex ${type === 'vertical' ? 'flex-col' : ''}">${[0, 1].map(i => `<button class="${cls} ${cls}--default ${cls}--primary ${cls}--size-1 ${icons ? 'sf-icon-button--icon' : ''} ${i ? '' : 'selected'}">${icons ? '<i class="sf-icon">home</i>' : '<span class="sf-button-text-container">Обзор</span>'}</button>`).join('')}</div></div><div class="sf-tabs-main-container"><div class="sf-tabs-main-tab selected">Содержимое</div></div>`;
        return e;
      };
      for (const outerType of skins) for (const innerType of skins) for (const outerSmart of [false, true]) for (const smart of [false, true]) for (const icons of [false, true]) {
        const outer = create(outerType, outerSmart, false), reference = create(innerType, smart, icons);
        const nested = create(innerType, smart, icons); main.append(outer, reference);
        pairs.push({outerType, innerType, outerSmart, smart, icons, outer, reference, nested});
      }
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (const p of pairs) p.outer.querySelector('.sf-tabs-main-tab').append(p.nested);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
      const inspect = host => {
        const root = host.matches('.sf-tabs') ? host : host.querySelector('.sf-tabs');
        const header = root.querySelector('.sf-tabs-top-container'), nav = root.querySelector('.sf-tabs-top');
        const props = ['backgroundColor', 'borderTopWidth', 'borderBottomWidth', 'borderInlineStartWidth', 'borderInlineEndWidth', 'borderColor', 'borderStartStartRadius', 'borderStartEndRadius', 'borderEndStartRadius', 'borderEndEndRadius'];
        const paint = e => Object.fromEntries(props.map(p => [p, getComputedStyle(e)[p]]));
        return {header: paint(header), margin: getComputedStyle(nav).marginBottom, gap: getComputedStyle(nav).gap,
          controls: [...nav.querySelectorAll('button')].map(e => ({...paint(e), color: getComputedStyle(e.querySelector('.sf-icon, .sf-button-text-container')).color}))};
      };
      return pairs.map(({outerType, innerType, outerSmart, smart, icons, nested, reference}) => ({outerType, innerType, outerSmart, smart, icons, nested: inspect(nested), reference: inspect(reference)}));
    }, theme);
    for (const row of rows) {cases++; if (JSON.stringify(row.nested) !== JSON.stringify(row.reference)) failures.push({theme, ...row});}
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases, failures, errors};
}
