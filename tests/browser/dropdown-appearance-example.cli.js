async(page)=>{
  const results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  for(const width of [390,1280])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html');
    await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(async theme=>{
      document.documentElement.className=`theme-${theme}`;
      const response=await fetch('../../source/output/action-focus-browser/examples/dropdown-appearance.html');
      if(!response.ok)throw new Error('Missing appearance example');
      document.querySelector('main').innerHTML=await response.text();
    },theme);
    await page.waitForFunction(()=>document.querySelector('sf-dropdown .sf-dropdown-field > button[aria-controls]'));
    const host=page.locator('sf-dropdown');
    if(!await host.locator('.sf-dropdown').evaluate(e=>e.classList.contains('max-w-sm')))throw new Error('Root class absent');
    await host.locator('.sf-dropdown-field > button').focus();await page.keyboard.press('ArrowDown');
    await host.locator('.sf-list-item[data-value="moscow"]').click();
    if(await host.locator('.sf-dropdown-field input:not([type="hidden"])').inputValue()!=='Москва')throw new Error('Styled example selection failed');
    await host.locator('.sf-dropdown-field > button').click();
    const actual=await host.evaluate(async e=>{
      const root=e.querySelector('.sf-dropdown'),field=e.querySelector('.sf-dropdown-field'),list=e.querySelector('.sf-list');
      for(const node of [field,list]){getComputedStyle(node).borderRadius;await Promise.all(node.getAnimations().map(a=>a.finished.catch(()=>{})));}
      const probe=document.createElement('span');root.append(probe);
      probe.style.borderRadius='var(--sf-radius-1)';const ui=getComputedStyle(probe).borderRadius;
      probe.style.borderRadius='var(--sf-radius-2)';const surface=getComputedStyle(probe).borderRadius;probe.remove();
      return {ui,surface,field:getComputedStyle(field).borderRadius,panel:getComputedStyle(list).borderRadius};
    });
    if(actual.ui!==actual.field||actual.surface!==actual.panel)throw new Error(JSON.stringify(actual));
    await page.screenshot({path:`output/playwright/dropdown-appearance-${width}-${theme}.png`});
    results.push({width,theme,...actual});
  }
  if(errors.length)throw new Error(errors.join('; '));
  return {status:'passed',cases:results.length,results,errors};
}
