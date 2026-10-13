async page => {
  const base = 'http://127.0.0.1:8766/ui-source/source/output/action-focus-browser';
  const errors = [], failures = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.route('**/favicon.ico', r => r.fulfill({status:204, body:''}));
  for (const width of [390, 1280]) for (const theme of ['light', 'dark']) for (const dir of ['ltr', 'rtl']) {
    await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
    await page.setViewportSize({width, height:800});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for (const name of ['buttons', 'context-menu']) await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for (const name of ['buttons', 'context-menu']) await page.addScriptTag({url:`${base}/smart/${name}/js/${name}.js`});
    await page.evaluate(({theme,dir}) => {
      document.documentElement.className = `theme-${theme}`; document.documentElement.dir = dir;
      const main = document.querySelector('main');
      main.innerHTML = '<button id="before">Перед меню</button><sf-context-menu aria-label="Действия"></sf-context-menu><button id="after">После меню</button>';
      window.actions = 0;
      main.querySelector('sf-context-menu').items = ['Открыть','Недоступно','Сохранить'].map((text,i) => ({component:'sf-button',props:{text,disabled:i===1,'@click':()=>window.actions++}}));
    }, {theme,dir});
    await page.waitForSelector('sf-context-menu sf-button button');
    await page.waitForFunction(() => document.querySelectorAll('sf-context-menu sf-button button').length === 3);
    const buttons = page.locator('sf-context-menu sf-button button');
    await buttons.first().focus();
    await page.keyboard.press('ArrowDown');
    const down = await buttons.nth(2).evaluate(e=>e===document.activeElement);
    await page.keyboard.press('Home');
    const home = await buttons.first().evaluate(e=>e===document.activeElement);
    await page.keyboard.press('End');
    const end = await buttons.nth(2).evaluate(e=>e===document.activeElement);
    await page.keyboard.press('ArrowDown');
    const wraps = await buttons.first().evaluate(e=>e===document.activeElement);
    const noArrowActivation = await page.evaluate(()=>window.actions===0);
    await page.keyboard.press('Enter'); await page.keyboard.press('Space');
    const nativeActions = await page.evaluate(()=>window.actions===2);
    await page.keyboard.press('Tab');
    const tabLeaves = await page.locator('#after').evaluate(e=>e===document.activeElement);
    const semantics = await buttons.evaluateAll(all=>all.every(e=>e.getAttribute('role')==='menuitem')&&all.filter(e=>e.tabIndex===0).length===1);
    const hostPassive = await page.locator('sf-context-menu sf-button').evaluateAll(all=>all.every(e=>!e.hasAttribute('role')&&!e.hasAttribute('tabindex')));
    const dynamic = await page.evaluate(async () => {
      const host = document.querySelector('sf-context-menu'), content = host.querySelector('.sf-context-menu-content');
      const tick = () => new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const item = document.createElement('button'); item.textContent = 'Дополнительное действие';
      const input = document.createElement('input'); input.setAttribute('aria-label','Поле приложения');
      content.append(item, input); await tick();
      const projected = item.getAttribute('role')==='menuitem';
      const inputUntouched = !input.hasAttribute('role')&&!input.hasAttribute('tabindex');
      item.focus(); item.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
      const addedToOrder = document.activeElement===host.querySelectorAll('sf-button button')[2];
      input.focus(); input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
      const inputKeysUntouched = document.activeElement===input;
      item.setAttribute('tabindex','3'); item.remove(); await tick();
      const authorOverride = item.getAttribute('tabindex')==='3'&&!item.hasAttribute('role');
      const retained = host.querySelector('sf-button button');
      host.remove(); await tick();
      const cleanup = !retained.hasAttribute('role')&&!retained.hasAttribute('tabindex');
      return {projected,inputUntouched,addedToOrder,inputKeysUntouched,authorOverride,cleanup};
    });
    await page.evaluate(async base => {document.querySelector('main').innerHTML = await (await fetch(`${base}/examples/context-menu-keyboard/index.html`)).text();}, base);
    await page.waitForSelector('sf-context-menu .sf-context-menu-content button');
    const sample = page.locator('sf-context-menu .sf-context-menu-content button');
    await sample.first().focus(); await page.keyboard.press('ArrowDown');
    const exampleKeyboard = await sample.nth(2).evaluate(e=>e===document.activeElement);
    const exampleName = await page.getByRole('menu',{name:'Действия с документом',exact:true}).count()===1;
    const sampleState = await page.evaluate(()=>{
      const root=document.querySelector('.sf-context-menu'), r=root.getBoundingClientRect();
      const focused=document.activeElement, css=getComputedStyle(focused);
      return {exampleLabels:['Переименовать','Создать копию','Удалить'].every(t=>root.textContent.includes(t)),
        exampleFits:r.left>=0&&r.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth,
        exampleFocus:focused.matches(':focus-visible')&&css.boxShadow.includes('inset')};
    });
    await page.waitForTimeout(400);
    if(dir==='ltr') await page.screenshot({path:`output/playwright/context-menu-${width}-${theme}.png`,fullPage:true});
    await page.emulateMedia({forcedColors:'active'});
    await page.waitForFunction(()=>{
      const css=getComputedStyle(document.activeElement);
      return matchMedia('(forced-colors: active)').matches&&css.outlineStyle==='solid'&&parseFloat(css.outlineOffset)<0;
    });
    const forcedFocus = await sample.nth(2).evaluate(e=>getComputedStyle(e).outlineStyle==='solid'&&parseFloat(getComputedStyle(e).outlineOffset)<0);
    await page.emulateMedia({forcedColors:'none'});
    const roleOptOut = await page.evaluate(async()=>{
      const host=document.querySelector('sf-context-menu');host.setAttribute('role','group');
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const buttons=[...host.querySelectorAll('.sf-context-menu-content button')];
      buttons[0].focus();const e=new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true});buttons[0].dispatchEvent(e);
      return buttons.every(b=>!b.hasAttribute('role')&&!b.hasAttribute('tabindex'))&&!e.defaultPrevented&&document.activeElement===buttons[0];
    });
    const row = {width,theme,dir,down,home,end,wraps,noArrowActivation,nativeActions,tabLeaves,semantics,hostPassive,...dynamic,exampleKeyboard,exampleName,...sampleState,forcedFocus,roleOptOut};
    if (Object.entries(row).some(([k,v])=>!['width','theme','dir'].includes(k)&&!v)) failures.push(row);
    results.push(row);
  }
  return {status:errors.length||failures.length?'failed':'passed',cases:results.length,errors,failures,results};
}
