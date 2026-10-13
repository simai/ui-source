async(page)=>{
  const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  const check=(ok,label)=>{if(!ok)throw new Error(label);results.push(label);};
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:1000});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html');
    await page.waitForFunction(()=>document.querySelector('#smart-tag .sf-dropdown-hidden-input'));
    for(const id of ['base','smart']){
      const host=page.locator(`#${id}`),field=host.locator('.sf-dropdown-field'),search=host.locator('.sf-list .sf-input input');
      await field.click();
      for(const [query,expected] of [['КАЗ',1],['нет такого города',0],['',3]]){
        await search.fill(query);
        await page.evaluate(()=>new Promise(requestAnimationFrame));
        const status=await host.evaluate(e=>{
          const root=e.matches('.sf-dropdown')?e:e.querySelector('.sf-dropdown');
          return {open:root.classList.contains('sf-dropdown--open'),disabled:root.querySelector('.sf-list input').disabled,
            query:root.querySelector('.sf-list input').value,count:[...root.querySelectorAll('.sf-list-item')].filter(i=>!i.hidden).length};
        });
        check(status.open&&!status.disabled&&status.query===query&&status.count===expected,`${id}/${width}: search ${query}`);
      }
      await host.locator('[data-value="kazan"]').click();
      await page.evaluate(()=>new Promise(requestAnimationFrame));
      check(await field.locator('input:not([type="hidden"])').inputValue()==='Казань',`${id}/${width}: human label`);
      check(await field.locator('input[type="hidden"]').inputValue()==='kazan',`${id}/${width}: machine value`);
      await field.click();
      await host.evaluate(e=>{e.setAttribute('disabled','');});
      await page.evaluate(()=>new Promise(requestAnimationFrame));
      check(await field.locator('input:not([type="hidden"])').isDisabled(),`${id}/${width}: disabled control`);
      check(await host.locator('.sf-list').isHidden(),`${id}/${width}: disabled closes popup`);
      const disabled=await host.evaluate(e=>{
        if(e.tagName==='SF-DROPDOWN'){e.selectValue('moscow');e.removeSelectedValue('kazan');}
        else e.querySelector('[data-value="moscow"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
        return e.querySelector('input[type="hidden"]').value;
      });
      check(disabled==='kazan',`${id}/${width}: disabled selection guard`);
      await host.evaluate(e=>e.removeAttribute('disabled'));
      await page.evaluate(()=>new Promise(requestAnimationFrame));
      check(await field.locator('input:not([type="hidden"])').isEnabled(),`${id}/${width}: reenable`);
      await field.click();
      await host.locator('[data-value="ufa"]').dispatchEvent('click');
      check(await field.locator('input[type="hidden"]').inputValue()==='kazan',`${id}/${width}: disabled option`);
      await host.locator('[data-value="moscow"]').click();
      check(await field.locator('input[type="hidden"]').inputValue()==='moscow',`${id}/${width}: choose after reenable`);
    }
    await page.locator('#one .sf-dropdown-field').click();
    await page.locator('#one [data-value="kazan"]').click();
    check(await page.locator('#one input[type="hidden"]').inputValue()==='kazan',`one/${width}: only option is selectable`);
    const cleared=await page.locator('#smart-tag').evaluate(async e=>{
      const settle=()=>new Promise(requestAnimationFrame);
      e.setAttribute('value','');await settle();const empty=e.hiddenValue;
      e.setAttribute('value','kazan,moscow');await settle();const restored=e.hiddenValue;
      e.value={value:''};await settle();const objectClear=e.hiddenValue;
      return {empty,restored,objectClear,tags:e.querySelectorAll('.sf-dropdown-tag-container .sf-tag').length};
    });
    check(cleared.empty===''&&cleared.objectClear===''&&cleared.tags===0&&cleared.restored==='kazan,moscow',`smart-tag/${width}: clear and restore`);
    const form=await page.locator('#smart-form').evaluate(e=>[...new FormData(e)]);
    check(JSON.stringify(form)===JSON.stringify([['smart-city','moscow'],['smart-cities','']]),`smart/${width}: clean form data`);
    const payload=await page.locator('#base-form').evaluate(e=>[...new FormData(e)]);
    check(JSON.stringify(payload)===JSON.stringify([['base-city','moscow'],['one-city','kazan']]),`base/${width}: clean form data`);
  }
  if(errors.length)throw new Error(errors.join('; '));
  await page.screenshot({path:'output/playwright/dropdown-state.png'});
  return {status:'passed',checks:results.length,results,errors};
}
