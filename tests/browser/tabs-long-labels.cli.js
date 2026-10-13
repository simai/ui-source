async page => {
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 1000});
    await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const n of ['buttons', 'tabs']) await page.addStyleTag({url: `${base}/component/${n}/css/${n}.css`});
    for (const n of ['icons', 'close', 'buttons', 'icon-buttons', 'tabs']) await page.addScriptTag({url: `${base}/smart/${n}/js/${n}.js`});
    await page.addScriptTag({url: `${base}/component/tabs/js/tabs.js`});
    for (const smart of [false, true]) for (const type of ['', 'pills', 'underline', 'full', 'vertical']) for (const dir of ['ltr', 'rtl']) {
      const row = await page.evaluate(async ({theme, smart, type, dir}) => {
        document.documentElement.className = `theme-${theme}`; document.documentElement.dir = dir;
        const main = document.querySelector('main'); main.replaceChildren();
        const labels = ['История согласования договора', 'НастройкиПерсональногоПредставленияМатериаловПроекта', 'Доступ'];
        let root;
        if (smart) {
          const host = document.createElement('sf-tabs'); host.setAttribute('type', type); host.setAttribute('items', labels.join('|'));
          host.innerHTML = '<p slot="panel-0">Содержимое выбранной панели с описанием текущего проекта.</p>';
          main.append(host); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          root = host.querySelector('.sf-tabs');
        } else {
          root = document.createElement('div'); root.className = `sf-tabs ${type ? `sf-tabs--${type}` : ''} flex ${type === 'vertical' ? '' : 'flex-col'}`;
          root.innerHTML = `<div class="sf-tabs-top-container"><div class="sf-tabs-top flex ${type === 'vertical' ? 'flex-col' : ''}">${labels.map((s,i) => `<button class="sf-button sf-button--default sf-button--primary sf-button--size-1 ${i ? '' : 'selected'}"><span class="sf-button-text-container">${s}</span></button>`).join('')}</div></div><div class="sf-tabs-main-container"><div class="sf-tabs-main-tab selected">Содержимое выбранной панели с описанием текущего проекта.</div><div class="sf-tabs-main-tab" hidden>Настройки</div><div class="sf-tabs-main-tab" hidden>Доступ к проекту</div></div>`;
          main.append(root);
        }
        await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
        const texts = [...root.querySelectorAll('.sf-button-text-container')];
        return {overflow: document.documentElement.scrollWidth > innerWidth, controls: texts.map(e => {
          const b = e.closest('button'), r = e.getBoundingClientRect(), br = b.getBoundingClientRect(), s = getComputedStyle(e);
          return {text: e.textContent, client: e.clientWidth, scroll: e.scrollWidth, height: r.height, lineHeight: parseFloat(s.lineHeight), rect: {left: r.left, right: r.right}, button: {left: br.left, right: br.right}, clipped: ['hidden','clip'].includes(s.overflowX), ellipsis: s.textOverflow === 'ellipsis'};
        })};
      }, {theme, smart, type, dir});
      const context = {width, theme, smart, type, dir}; results.push({...context, ...row});
      if (row.overflow || row.controls.some(e => e.scroll > e.client + 1 || e.rect.left < e.button.left - 1 || e.rect.right > e.button.right + 1 || e.clipped || e.ellipsis || (e.text === 'Доступ' && e.height > e.lineHeight * 1.5))) failures.push({...context, ...row});
      if (width === 390 && smart && dir === 'ltr' && ['', 'vertical'].includes(type)) await page.screenshot({path: `output/playwright/tabs-long-${type || 'horizontal'}-${theme}.png`, fullPage: true});
      if (width === 390 && type === '') {
        await page.locator('main .sf-tabs-top button').first().focus();
        await page.keyboard.press('End');
        // Core may animate scrolling; wait for the observable target, not an
        // arbitrary delay or a DOMAnimation (native scrolling is not one).
        await page.waitForFunction(() => {
          const buttons = document.querySelectorAll('main .sf-tabs-top button');
          const last = buttons[buttons.length - 1];
          if (!last || document.activeElement !== last) return false;
          const r = last.getBoundingClientRect(), n = last.closest('.sf-tabs-top').getBoundingClientRect();
          return last.getAttribute('aria-selected') === 'true' && r.left >= n.left - 1 && r.right <= n.right + 1;
        }, null, {timeout: 2500}).catch(() => {});
        const visible = await page.locator('main .sf-tabs-top button').last().evaluate(async e => {
          await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
          const r = e.getBoundingClientRect(), n = e.closest('.sf-tabs-top').getBoundingClientRect();
          return {focused: document.activeElement === e, selected: e.getAttribute('aria-selected'), left: r.left, right: r.right, navLeft: n.left, navRight: n.right, scrollLeft: e.closest('.sf-tabs-top').scrollLeft};
        });
        if (!visible.focused || visible.selected !== 'true' || visible.left < visible.navLeft - 1 || visible.right > visible.navRight + 1) failures.push({...context, issue: 'keyboard did not reveal the selected tab in its local scroller', visible});
      }
    }
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors};
}
