async page => {
  const failures = [], results = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = 'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  await page.emulateMedia({forcedColors: 'none', reducedMotion: 'reduce'});
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for (const name of ['alerts', 'buttons', 'icon-buttons', 'close']) await page.addStyleTag({url: `${base}/component/${name}/css/${name}.css`});
    for (const name of ['icons', 'close', 'icon-buttons', 'alert']) await page.addScriptTag({url: `${base}/smart/${name}/js/${name}.js`});
    await page.evaluate(theme => {document.documentElement.className = `theme-${theme}`; document.querySelector('main').replaceChildren();}, theme);
    await page.evaluate(async () => {
      const outer = document.createElement('sf-alert'); outer.id = 'outer-notice'; outer.setAttribute('title', 'Внешнее');
      document.querySelector('main').append(outer);
      const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await wait();
      const inner = document.createElement('sf-alert'); inner.id = 'inner-notice';
      inner.setAttribute('action-text', 'Вложенное действие'); inner.setAttribute('closable', '');
      const counts = {outerAction: 0, outerClose: 0, innerAction: 0, innerClose: 0, bubbledAction: 0, bubbledClose: 0};
      // Public callbacks follow normal DOM bubbling; filter the emitter when
      // application logic must handle only this particular notice.
      outer.onAction((action, detail) => {if (detail.alert === outer) counts.outerAction++;});
      outer.onClose(detail => {if (detail.alert === outer) counts.outerClose++;});
      inner.onAction(() => counts.innerAction++); inner.onClose(() => counts.innerClose++);
      outer.addEventListener('sf-alert-action', () => counts.bubbledAction++);
      outer.addEventListener('sf-alert-close', () => counts.bubbledClose++);
      outer.querySelector('.sf-alert-content').append(inner); await wait();
      window.__nestedAlertCounts = counts;
    });
    await page.locator('#inner-notice').getByRole('button', {name: 'Вложенное действие', exact: true}).click();
    const defaultLabel = await page.locator('#inner-notice sf-icon-button button').getAttribute('aria-label');
    if (defaultLabel !== 'Close alert') failures.push({width, theme, issue: 'default close name', defaultLabel});
    await page.locator('#inner-notice sf-icon-button button').click();
    const nested = await page.evaluate(() => ({...window.__nestedAlertCounts, outerConnected: !!document.querySelector('#outer-notice'), innerConnected: !!document.querySelector('#inner-notice')}));
    if (nested.outerAction || nested.outerClose || nested.innerAction !== 1 || nested.innerClose !== 1 || nested.bubbledAction !== 1 || nested.bubbledClose !== 1 || !nested.outerConnected || nested.innerConnected) failures.push({width, theme, issue: 'nested owner callbacks and DOM bubbling', nested});
    await page.evaluate(() => document.querySelector('#outer-notice').remove());
    for (const activation of ['pointer', 'Enter', 'Space']) {
      await page.evaluate(async () => {
        const el = document.createElement('sf-alert'); el.id = 'notice';
        for (const [key, value] of Object.entries({title: 'Сохранено', 'action-text': 'Открыть', action: 'open', 'secondary-action-text': 'Отменить', 'secondary-action': 'undo', closable: '', 'close-label': 'Закрыть уведомление'})) el.setAttribute(key, value);
        el.__events = {actions: [], closes: 0};
        el.onAction(action => el.__events.actions.push(action));
        el.onClose(() => el.__events.closes++);
        window.__alertProbe = el; document.querySelector('main').append(el);
        const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await wait();
        for (const token of ['max-w-sm', 'max-w-md', 'max-w-sm']) {el.setAttribute('root-class', token); await wait();}
        el.removeAttribute('closable'); await wait(); el.setAttribute('closable', ''); await wait();
      });
      const host = page.locator('#notice');
      await host.getByRole('button', {name: 'Открыть', exact: true}).click();
      await host.getByRole('button', {name: 'Отменить', exact: true}).click();
      const close = host.locator('sf-icon-button button');
      await close.waitFor();
      const name = await close.getAttribute('aria-label');
      if (name !== 'Закрыть уведомление') failures.push({width, theme, activation, issue: 'close has localized accessible name', name});
      if (activation === 'pointer') await close.click();
      else {await page.keyboard.press('Tab'); await page.keyboard.press(activation);}
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const state = await page.evaluate(() => ({connected: window.__alertProbe.isConnected, ...window.__alertProbe.__events}));
      if (state.connected || state.closes !== 1 || JSON.stringify(state.actions) !== '["open","undo"]') failures.push({width, theme, activation, issue: 'close once and preserve actions after renders', state});
      await page.evaluate(async () => {
        const el = window.__alertProbe;
        if (el.isConnected) el.remove();
        document.querySelector('main').append(el);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        el.style.setProperty('padding-inline', 'var(--sf-space-2)');
      });
      await page.locator('#notice sf-icon-button button').click();
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const reconnected = await page.evaluate(() => ({connected: window.__alertProbe.isConnected, closes: window.__alertProbe.__events.closes}));
      if (reconnected.connected || reconnected.closes !== 2) failures.push({width, theme, activation, issue: 'reconnect keeps one handler', reconnected});
      results.push({width, theme, activation, state, reconnected});
      await page.evaluate(() => window.__alertProbe.remove());
    }
  }
  return {status: failures.length || errors.length ? 'failed' : 'passed', cases: results.length, failures, errors};
}
