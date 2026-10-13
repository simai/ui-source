async(page)=>{
  const results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  const check=(ok,context,actual)=>{if(!ok)failures.push({context,actual});};
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  for(const width of [390,1280])for(const fallback of [false,true])for(const id of ['base','smart'])for(const mode of ['hidden','inert','display','visibility'])for(const focusInList of [false,true]){
    const prefix=`${width}/${fallback}/${id}/${mode}/${focusInList}`;
    await page.setViewportSize({width,height:800});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?portal');
    await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(({id,fallback})=>{
      if(fallback)HTMLElement.prototype.showPopover=undefined;
      const host=document.getElementById(id),wrap=document.createElement('section');wrap.id='owner-surface';
      wrap.append(host);document.querySelector('main').replaceChildren(wrap);
      host.__changes=[];host.addEventListener('sf-dropdown:change',e=>host.__changes.push(e.detail.value));
    },{id,fallback});
    const host=page.locator(`#${id}`),button=host.locator('.sf-dropdown-field > button');
    await button.click();await page.waitForTimeout(70);
    if(focusInList){await button.focus();await page.keyboard.press('ArrowDown');await page.waitForTimeout(60);}
    const state=()=>host.evaluate(host=>{
      const root=host.matches('.sf-dropdown')?host:host.querySelector('.sf-dropdown');
      const list=root.__sfDropdownPortalList||host.querySelector('.sf-list');
      return {projected:!!root.__sfDropdownPortalList,hidden:list.hidden,expanded:root.querySelector('.sf-dropdown-field > button').getAttribute('aria-expanded'),events:host.__changes};
    });
    await page.evaluate(mode=>{
      const wrap=document.getElementById('owner-surface');
      if(mode==='hidden')wrap.hidden=true;
      if(mode==='inert')wrap.inert=true;
      if(mode==='display')wrap.style.display='none';
      if(mode==='visibility')wrap.style.visibility='hidden';
    },mode);await page.waitForTimeout(150);
    let s=await state();check(!s.projected&&s.hidden&&s.expanded==='false',`${prefix}: owner unavailable closes panel`,s);
    await page.evaluate(()=>{const wrap=document.getElementById('owner-surface');wrap.hidden=false;wrap.inert=false;wrap.removeAttribute('style');});
    await page.waitForTimeout(100);s=await state();
    check(!s.projected&&s.hidden&&s.expanded==='false'&&!s.events.length,`${prefix}: restoring owner does not reopen or emit choice`,s);
    results.push({width,fallback,id,mode,focusInList});
  }
  return {status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
