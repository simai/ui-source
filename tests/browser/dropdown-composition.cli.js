async(page)=>{
  const results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  const check=(ok,label)=>{if(!ok)throw new Error(label);};
  const settle=()=>page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
  const style=async host=>{
    const field=host.locator('.sf-dropdown-field');
    await field.evaluate(async e=>Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{}))));
    return field.evaluate(e=>{const s=getComputedStyle(e);return {border:s.borderTopColor,background:s.backgroundColor};});
  };
  for(const width of [390,1280])for(const theme of ['light','dark'])for(const appearance of ['filled','outlined']){
    await page.setViewportSize({width,height:1100});await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?reset&preset&checkbox');
    await page.waitForFunction(()=>document.querySelector('#smart-tag .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(({theme,appearance})=>{
      document.documentElement.className=`theme-${theme}`;
      for(const id of ['base','base-tag'])document.getElementById(id).classList.replace('sf-dropdown--outlined',`sf-dropdown--${appearance}`);
      for(const id of ['smart','smart-tag'])document.getElementById(id).setAttribute('type',appearance);
    },{theme,appearance});await settle();
    for(const id of ['base','base-tag','smart','smart-tag']){
      const host=page.locator(`#${id}`),button=host.locator('.sf-dropdown-field > button');
      const before=await style(host);
      await host.locator('.sf-list-item[data-value="ufa"] input').evaluate(e=>e.disabled=false);
      const withoutDisabledChild=await style(host);
      check(JSON.stringify(before)===JSON.stringify(withoutDisabledChild),`${id}/${appearance}: disabled option leaked into field ${JSON.stringify({before,withoutDisabledChild})}`);
      await host.locator('.sf-list-item[data-value="ufa"] input').evaluate(e=>e.disabled=true);
      await host.evaluate(e=>{e.__events=[];for(const type of ['input','change','sf-dropdown:change'])e.addEventListener(type,event=>e.__events.push(event.type));});
      await button.click();await settle();await page.mouse.move(1,1);
      const openStyle=await style(host);
      await host.locator('.sf-list .sf-input input').hover();
      check(JSON.stringify(await style(host))===JSON.stringify(openStyle),`${id}: hovering search changed field`);
      const option=host.locator('.sf-list-item[data-value="moscow"]');
      const wasSelected=await option.evaluate(e=>e.classList.contains('selected'));
      const mark=option.locator('.sf-checkbox-box');await mark.scrollIntoViewIfNeeded();const box=await mark.boundingBox();
      await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await settle();
      const selected=id.endsWith('tag')?!wasSelected:true;
      const indicator=await option.evaluate(e=>({selected:e.classList.contains('selected'),checked:e.querySelector('input').checked,icon:e.querySelector('.sf-checkbox-box .sf-icon').textContent,hidden:e.querySelector('.sf-checkbox').getAttribute('aria-hidden')}));
      check(indicator.selected===selected&&indicator.checked===selected&&indicator.icon===(selected?'check':'')&&indicator.hidden==='true',`${id}: checkbox pointer/state mismatch ${JSON.stringify(indicator)}`);
      const events=await host.evaluate(e=>e.__events);
      check(events.join(',')==='sf-dropdown:change,change',`${id}: selection event duplication ${events}`);
      await page.locator('#before').click();
      await host.evaluate(e=>{e.__events=[];e.closest('form').reset();});await settle();
      check((await host.evaluate(e=>e.__events)).length===0,`${id}: decorated reset emitted events`);
      const resetIndicators=await host.locator('.sf-list-item').evaluateAll(items=>items.every(e=>e.querySelector('input').checked===e.classList.contains('selected')&&e.querySelector('.sf-checkbox-box .sf-icon').textContent===(e.classList.contains('selected')?'check':'')));
      check(resetIndicators,`${id}: reset indicator mismatch`);
      await host.evaluate(e=>e.setAttribute('disabled',''));await settle();
      check(await button.isDisabled(),`${id}: whole control disabled`);
      await host.evaluate(e=>e.removeAttribute('disabled'));await settle();
      check(await button.isEnabled(),`${id}: whole control reenabled`);
      results.push({width,theme,appearance,id,before,indicator});
    }
  }
  if(errors.length)throw new Error(errors.join('; '));
  await page.screenshot({path:'output/playwright/dropdown-composition.png'});
  return {status:'passed',cases:results.length,results,errors};
}
