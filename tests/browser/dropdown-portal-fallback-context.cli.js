async(page)=>{
  const results=[],failures=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  for(const width of [390,1280])for(const id of ['base-tag','smart-tag'])for(const appearance of ['filled','outlined']){
    await page.setViewportSize({width,height:700});
    await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?portal&reset&preset&option-type=avatar&appearance=${appearance}`);
    await page.waitForFunction(()=>document.querySelector('#smart-tag .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(id=>{
      HTMLElement.prototype.showPopover=undefined;
      const host=document.getElementById(id),main=document.querySelector('main'),wrap=document.createElement('section');
      wrap.id='context';wrap.className='theme-light';wrap.style.cssText='transform:translateZ(0);overflow:hidden;--sf-radius--surface:var(--sf-radius-3);font-family:serif;font-size:19px;text-transform:uppercase;word-spacing:.25em';
      host.parentNode.insertBefore(wrap,host);wrap.append(host);main.replaceChildren(wrap);
    },id);
    const host=page.locator(`#${id}`);await host.locator('.sf-dropdown-field > button').click();
    for(const theme of ['light','dark','light']){
      await page.evaluate(theme=>{
        const wrap=document.getElementById('context');wrap.className=`theme-${theme}`;wrap.dir=theme==='dark'?'rtl':'ltr';
        wrap.style.setProperty('--sf-radius--surface',`var(--sf-radius-${theme==='dark'?'1':'3'})`);
      },theme);
      await page.waitForTimeout(80);
      const actual=await host.evaluate(e=>{
        const root=e.matches('.sf-dropdown')?e:e.querySelector('.sf-dropdown'),panel=root.__sfDropdownPortalList;
        const probe=document.createElement('span');probe.style.cssText='background:var(--sf-surface-0);border-radius:var(--sf-radius--surface)';root.append(probe);
        const a=getComputedStyle(panel),b=getComputedStyle(probe);
        const result={actual:[a.backgroundColor,a.borderRadius,a.fontFamily,a.fontSize,a.direction,a.textTransform,a.wordSpacing],expected:[b.backgroundColor,b.borderRadius,b.fontFamily,b.fontSize,b.direction,b.textTransform,b.wordSpacing],open:!panel.hidden};probe.remove();return result;
      });
      if(JSON.stringify(actual.actual)!==JSON.stringify(actual.expected)||!actual.open)failures.push({width,id,appearance,theme,actual});
    }
    await page.locator('.sf-list-item[data-value="moscow"]').click();
    await page.waitForFunction(id=>document.querySelector(`#${id} input[type="hidden"]`).value==='kazan',id);
    if(await page.locator('body > .sf-dropdown').count()!==1)failures.push({id,issue:'multiple selection lost projection or cloned context'});
    await page.locator('.sf-list-item[data-value="moscow"]').click();
    await page.waitForFunction(id=>document.querySelector(`#${id} input[type="hidden"]`).value.includes('moscow'),id);
    await page.keyboard.press('Escape');
    if(await page.locator('body > .sf-dropdown').count()!==0)failures.push({id,issue:'orphan context after close'});
    results.push({width,id,appearance});
  }
  return {status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,results,errors};
}
