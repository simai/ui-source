async page => {
  const base = 'http://127.0.0.1:8766/ui-source/source/output/action-focus-browser';
  const failures = [], errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await page.route('**/favicon.ico', r => r.fulfill({status: 204, body: ''}));
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) for (const dir of ['ltr', 'rtl']) {
    await page.setViewportSize({width, height: 800});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    await page.addStyleTag({url: `${base}/component/tooltip/css/tooltip.css`});
    await page.addScriptTag({url: `${base}/smart/tooltip/js/tooltip.js`});
    await page.evaluate(({theme, dir}) => {document.documentElement.className = `theme-${theme}`; document.documentElement.dir = dir;}, {theme, dir});
    for (const owner of ['ordinary', 'smart']) for (const skin of ['light', 'dark']) for (const size of ['1/3', '1/2', '1', '2', '3']) for (const arrow of ['none', 'top-center', 'bottom-center', 'inline-start', 'inline-end', 'bottom-inline-start', 'bottom-inline-end']) {
      const row = await page.evaluate(async ({owner, skin, size, arrow}) => {
        const main = document.querySelector('main'); main.replaceChildren();
        const title = 'Длинное пояснение к настройке, которое должно помещаться в доступную область';
        const detail = 'Идентификатор: ' + 'abc123'.repeat(30);
        let host;
        if (owner === 'smart') {
          host = document.createElement('sf-tooltip');
          for (const [k, v] of Object.entries({type: skin, size, arrow, text: title, 'supporting-text': detail})) host.setAttribute(k, v);
        } else {
          host = document.createElement('div');
          host.className = `sf-tooltip sf-tooltip--${skin} sf-tooltip--size-${size} sf-tooltip--arrow-${arrow}`;
          host.innerHTML = '<div class="sf-tooltip-content"><div class="sf-tooltip-wrap flex flex-col"><span class="sf-tooltip-text"></span><span class="sf-tooltip-supporting-text"></span></div><span class="sf-tooltip-tail" aria-hidden="true"></span></div>';
          host.querySelector('.sf-tooltip-text').textContent = title;
          host.querySelector('.sf-tooltip-supporting-text').textContent = detail;
        }
        main.append(host);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const root = owner === 'smart' ? host.querySelector('.sf-tooltip') : host;
        const content = root.querySelector('.sf-tooltip-content'), tail = root.querySelector('.sf-tooltip-tail');
        const rect = e => {const r = e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
        const c = rect(content), t = rect(tail), m = rect(main), r = rect(root);
        const css = getComputedStyle(tail), isRtl = getComputedStyle(root).direction === 'rtl';
        let attached = true;
        if (arrow === 'top-center') attached = Math.abs((t.top+t.bottom)/2-c.top)<1 && Math.abs((t.left+t.right-c.left-c.right)/2)<1;
        if (arrow === 'bottom-center') attached = Math.abs((t.top+t.bottom)/2-c.bottom)<1 && Math.abs((t.left+t.right-c.left-c.right)/2)<1;
        if (arrow.startsWith('bottom-inline')) attached = Math.abs((t.top+t.bottom)/2-c.bottom)<1 && t.left>=c.left && t.right<=c.right;
        if (arrow === 'inline-start' || arrow === 'inline-end') {
          const left = (arrow === 'inline-start') !== isRtl;
          attached = Math.abs((t.left+t.right)/2-(left?c.left:c.right))<1 && Math.abs((t.top+t.bottom-c.top-c.bottom)/2)<1;
        }
        return {root:r, content:c, tail:t, main:m, attached, hidden:css.display==='none',
          inside:r.left>=m.left-1&&r.right<=m.right+1&&c.left>=m.left-1&&c.right<=m.right+1,
          textFits:[...root.querySelectorAll('.sf-tooltip-text,.sf-tooltip-supporting-text')].every(e=>e.scrollWidth<=e.clientWidth+1),
          pageFits:document.documentElement.scrollWidth<=innerWidth,
          painted:css.backgroundColor===getComputedStyle(content).backgroundColor,
          textPreserved:root.textContent.includes(title)&&root.textContent.includes(detail)};
      }, {owner, skin, size, arrow});
      const ok = row.inside && row.textFits && row.pageFits && row.textPreserved && (arrow==='none' ? row.hidden : row.attached && row.painted);
      if (!ok) failures.push({width, theme, dir, owner, skin, size, arrow, ...row});
      results.push({width, theme, dir, owner, skin, size, arrow, ok});
    }
  }
  return {status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors};
}
