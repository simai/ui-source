async(page)=>{
  const results=[],failures=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  const check=(ok,context,actual)=>{if(!ok)failures.push({context,actual});};
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  for(const width of [390,1280])for(const fallback of [false,true])for(const [id,parameter] of [['base','data-portal'],['base','portal'],['smart','portal']]){
    const prefix=`${width}/${id}/${parameter}/${fallback}`;
    await page.setViewportSize({width,height:800});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html');
    await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(({id,fallback})=>{
      if(fallback)HTMLElement.prototype.showPopover=undefined;
      const host=document.getElementById(id);document.querySelector('main').replaceChildren(host);
      host.__changes=[];host.addEventListener('sf-dropdown:change',e=>host.__changes.push(e.detail.value));
    },{id,fallback});
    const host=page.locator(`#${id}`),button=host.locator('.sf-dropdown-field > button'),panel=page.locator('.sf-list');
    const set=async enabled=>{await host.evaluate((e,{enabled,parameter})=>e.setAttribute(parameter,String(enabled)),{enabled,parameter});await page.waitForTimeout(80);};
    const state=()=>host.evaluate(e=>{
      const root=e.matches('.sf-dropdown')?e:e.querySelector('.sf-dropdown'),list=root.__sfDropdownPortalList||e.querySelector('.sf-list');
      return {projected:!!root.__sfDropdownPortalList,inside:e.contains(list),hidden:list.hidden,active:list.contains(document.activeElement),value:e.querySelector('input[type="hidden"]').value,events:e.__changes,contexts:document.querySelectorAll('body > .sf-dropdown').length};
    });
    await set(true);await button.click();await page.waitForTimeout(80);
    check((await state()).projected,`${prefix}: late enable`,await state());
    await panel.locator('.sf-list-item[data-value="moscow"]').click();await page.waitForTimeout(80);
    check((await state()).value==='moscow',`${prefix}: late-enable pointer selection`,await state());
    if(await button.getAttribute('aria-expanded')==='true')await page.keyboard.press('Escape');
    await set(false);await button.click();await panel.locator('.sf-input input').fill('М');
    await set(true);let s=await state();
    check(s.projected&&s.active&&!s.hidden,`${prefix}: enable while searching`,s);
    await set(false);s=await state();
    check(!s.projected&&s.inside&&s.active&&!s.hidden&&!s.contexts,`${prefix}: disable while searching`,s);
    if(await button.getAttribute('aria-expanded')!=='true')await button.click();
    await panel.locator('.sf-input input').fill('');
    await panel.locator('.sf-list-item[data-value="kazan"]').click();await page.waitForTimeout(80);
    s=await state();check(s.value==='kazan'&&JSON.stringify(s.events)==='["moscow","kazan"]',`${prefix}: normal selection after projection`,s);
    results.push({width,id,parameter,fallback});
  }
  return {status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,results,errors};
}
