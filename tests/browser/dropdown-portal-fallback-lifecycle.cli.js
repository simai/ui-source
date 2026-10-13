async(page)=>{
  const results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  const check=(value,label)=>{if(!value)throw new Error(label);};
  for(const width of [390,1280])for(const id of ['base','smart'])for(const search of [false,true]){
    await page.setViewportSize({width,height:600});
    await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?portal${search?'':'&nosearch'}`);
    await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(id=>{
      HTMLElement.prototype.showPopover=undefined;
      const host=document.getElementById(id),main=document.querySelector('main'),wrap=document.createElement('section');
      wrap.className='theme-dark';wrap.style.cssText='transform:translateZ(0);overflow:hidden;height:100px;margin-top:100px';
      host.parentNode.insertBefore(wrap,host);wrap.append(host);main.replaceChildren(wrap);
      const panel=host.querySelector('.sf-list');panel.style.setProperty('margin','var(--sf-space-1)','important');
      panel.style.maxHeight='90px';
      host.__changes=[];host.addEventListener('sf-dropdown:change',event=>host.__changes.push(event.detail.value));
    },id);
    const host=page.locator(`#${id}`),button=host.locator('.sf-dropdown-field > button'),panel=page.locator('.sf-list');
    await button.focus();await page.keyboard.press('ArrowDown');
    await page.waitForFunction(id=>document.querySelector('.sf-list').parentElement.parentElement===document.body,id);
    check(await panel.evaluate(e=>e.parentElement.parentElement===document.body),`${id}: fallback context projects the panel`);
    check(await panel.evaluate(e=>e.getBoundingClientRect().height<=90),`${id}: author height cap respected`);
    if(search){
      const input=panel.locator('.sf-input input');await input.fill('Мос');
      await page.waitForTimeout(60);
      check(await input.evaluate(e=>e===document.activeElement),`${id}: typing retains focus`);
      await input.fill('');
    }
    await panel.locator('.sf-list-item[data-value="moscow"]').click();
    await page.waitForFunction(id=>document.querySelector(`#${id} input[type="hidden"]`).value==='moscow',id);
    check(JSON.stringify(await host.evaluate(e=>e.__changes))==='["moscow"]',`${id}: one event per physical click`);
    await page.waitForFunction(id=>document.getElementById(id).contains(document.querySelector('.sf-list')),id);
    check(await panel.evaluate(e=>e.style.getPropertyValue('margin')==='var(--sf-space-1)'&&e.style.getPropertyPriority('margin')==='important'),`${id}: restore author style`);
    check(await panel.evaluate(e=>e.style.maxHeight==='90px'),`${id}: restore author height cap`);
    for(let n=0;n<3;n++){
      await button.click();await page.waitForFunction(id=>document.querySelector('.sf-list').parentElement.parentElement===document.body,id);
      await page.keyboard.press('Escape');await page.waitForFunction(id=>document.getElementById(id).contains(document.querySelector('.sf-list')),id);
      check(await button.evaluate(e=>e===document.activeElement),`${id}: Escape focus`);
    }
    await button.click();
    await host.evaluate(e=>e.tagName==='SF-DROPDOWN'?e.setAttribute('disabled',''):e.classList.add('disabled'));
    await page.waitForFunction(id=>document.getElementById(id).contains(document.querySelector('.sf-list')),id);
    check(await host.locator('input[type="hidden"]').inputValue()==='moscow',`${id}: disable preserves value`);
    await host.evaluate(e=>e.tagName==='SF-DROPDOWN'?e.removeAttribute('disabled'):e.classList.remove('disabled'));
    await button.click();await host.evaluate(e=>e.remove());
    check(await page.locator('body > .sf-dropdown').count()===0,`${id}: detach leaves no top-layer panel`);
    results.push({id,width,search});
  }
  return {status:errors.length?'failed':'passed',cases:results.length,results,errors};
}
