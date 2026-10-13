async(page)=>{
  const results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  for(const width of [390,1280])for(const search of [true,false])for(const forcedColors of ['none','active']){
    await page.setViewportSize({width,height:1100});
    await page.emulateMedia({forcedColors,reducedMotion:'reduce'});
    await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?${search?'':'nosearch'}`);
    await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown-field > button[aria-controls]'));
    await page.locator('#before').focus();await page.keyboard.press('Tab');
    check(await page.locator('#base .sf-dropdown-field > button').evaluate(e=>e===document.activeElement),'One primary Tab owner');
    for(const id of ['base','smart','smart-tag']){
      const host=page.locator(`#${id}`),button=host.locator('.sf-dropdown-field > button'),field=host.locator('.sf-dropdown-field');
      await page.locator('#before').focus();
      for(let stop=0;stop<12;stop++){
        await page.keyboard.press('Tab');
        if(await button.evaluate(e=>e===document.activeElement))break;
      }
      check(await button.evaluate(e=>e===document.activeElement),`${id}: reachable by Tab`);
      const name=await button.ariaSnapshot();check(name.includes('Город'),`${id}: missing accessible name ${name}`);
      const binding=await button.evaluate(e=>({popup:e.getAttribute('aria-haspopup'),role:document.getElementById(e.getAttribute('aria-controls'))?.getAttribute('role'),expanded:e.getAttribute('aria-expanded'),description:e.getAttribute('aria-describedby')?.split(/\s+/).every(id=>document.getElementById(id))}));
      check(binding.popup==='listbox'&&binding.role==='listbox'&&binding.expanded==='false'&&binding.description,`${id}: role/name binding`);
      await field.evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{})));});
      const focus=await field.evaluate(e=>{const s=getComputedStyle(e);return {shadow:s.boxShadow,outline:s.outlineStyle,width:s.outlineWidth};});
      check(forcedColors==='active'?focus.outline==='solid'&&parseFloat(focus.width)>0:focus.shadow.includes('inset')&&!focus.shadow.includes('rgba(0, 0, 0, 0)'),`${id}: invisible field focus ${JSON.stringify(focus)}`);
      const innerFocus=await button.evaluate(e=>({shadow:getComputedStyle(e).boxShadow,outline:getComputedStyle(e).outlineStyle}));
      check(innerFocus.shadow==='none'&&innerFocus.outline==='none',`${id}: duplicate inner focus ${JSON.stringify(innerFocus)}`);
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(id=>document.querySelector(`#${id} .sf-dropdown-field > button`).getAttribute('aria-expanded')==='true',id);
      if(search){
        check(await host.locator('.sf-list input').evaluate(e=>e===document.activeElement),`${id}: search focus`);
        check(await host.locator('.sf-list input').getAttribute('role')==='searchbox',`${id}: search semantics`);
        await page.keyboard.press('ArrowDown');
      }
      check(await page.locator(':focus').getAttribute('data-value')==='kazan',`${id}: first option`);
      check(await page.locator(':focus').getAttribute('role')==='option',`${id}: option role`);
      await page.keyboard.press('End');
      check(await page.locator(':focus').getAttribute('data-value')==='moscow',`${id}: skips disabled End`);
      await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');
      check(await page.locator(':focus').getAttribute('data-value')==='moscow',`${id}: arrow navigation`);
      await page.locator(':focus').evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{})));});
      const optionFocus=await page.locator(':focus').evaluate(e=>({shadow:getComputedStyle(e).boxShadow,outline:getComputedStyle(e).outlineStyle}));
      check(forcedColors==='active'?optionFocus.outline==='solid':optionFocus.shadow.includes('inset')&&!optionFocus.shadow.includes('rgba(0, 0, 0, 0)'),`${id}: option focus`);
      const before=await host.locator('input[type="hidden"]').inputValue();
      await page.keyboard.press('Escape');
      await page.waitForFunction(id=>document.querySelector(`#${id} .sf-dropdown-field > button`).getAttribute('aria-expanded')==='false',id);
      check(await button.evaluate(e=>e===document.activeElement),`${id}: Escape restores trigger`);
      check(await host.locator('input[type="hidden"]').inputValue()===before,`${id}: Escape changed selection`);
      await page.keyboard.press('ArrowUp');
      await page.waitForFunction(()=>document.activeElement?.dataset.value==='moscow');
      await page.keyboard.press('Enter');
      await page.evaluate(()=>new Promise(requestAnimationFrame));
      check(await host.locator('input[type="hidden"]').inputValue()===(id==='smart-tag'?'kazan,moscow':'moscow'),`${id}: commit value`);
      if(id!=='smart-tag'){
        check(await button.evaluate(e=>e===document.activeElement),`${id}: selection restores trigger`);
        await page.keyboard.press(' ');
      }
      await page.keyboard.press('Tab');
      await page.waitForFunction(id=>document.querySelector(`#${id} .sf-dropdown-field > button`).getAttribute('aria-expanded')==='false',id);
      check(await host.locator('.sf-list').evaluate(e=>!e.contains(document.activeElement)),`${id}: Tab leaves popup`);
      await page.locator('#before').click();await button.click();await page.mouse.move(1,1);
      const pointer=await field.evaluate(e=>({focus:e.querySelector(':scope > button').matches(':focus-visible'),shadow:getComputedStyle(e).boxShadow,outline:getComputedStyle(e).outlineStyle}));
      check(!pointer.focus&&pointer.shadow==='none'&&pointer.outline==='none',`${id}: pointer ring ${JSON.stringify(pointer)}`);
      await page.locator('#before').click();
      results.push({width,search,forcedColors,id,name,focus,innerFocus,optionFocus,pointer});
    }
  }
  if(errors.length)throw new Error(errors.join('; '));
  await page.screenshot({path:'output/playwright/dropdown-keyboard.png'});
  return {status:'passed',cases:results.length,results,errors};
}
