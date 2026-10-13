async(page)=>{
  const results=[],failures=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  const check=(ok,label,actual)=>{results.push(label);if(!ok)failures.push({label,actual});};
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  for(const width of [390,1280])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:1500});
  for(const type of ['text','icon','checkbox','avatar','color']){
    await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?reset&preset&multiple-text&option-type=${type}`);
    await page.waitForFunction(()=>document.querySelector('#smart-tag .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(theme=>document.documentElement.className=`theme-${theme}`,theme);
    for(const id of ['base','base-tag','smart','smart-tag']){
      const host=page.locator(`#${id}`),prefix=`${width}/${theme}/${type}/${id}`;
      const snapshot=()=>host.evaluate(e=>{
        const label=item=>(item.querySelector('.sf-list-item-container')||item.querySelector('.sf-avatar-label-group-title')||item.querySelector('.sf-tag-container'))?.textContent.trim();
        const map=Object.fromEntries([...e.querySelectorAll('.sf-list-item')].map(item=>[item.dataset.value,label(item)]));
        const payload=e.querySelector('input[type="hidden"]').value;
        return {payload,labels:payload.split(',').filter(Boolean).map(v=>map[v]),summary:e.querySelector('.sf-dropdown-value')?.textContent,display:e.querySelector('.sf-dropdown-field input:not([type="hidden"])')?.value,tags:[...e.querySelectorAll('.sf-dropdown-tag-container .sf-tag-container')].map(t=>t.textContent.trim()),icons:[...e.querySelectorAll('.sf-dropdown-tag-container .sf-tag-icon')].map(t=>t.textContent.trim()),value:e.tagName==='SF-DROPDOWN'?e.value.value:e.dataset.selectedValue};
      });
      const initial=await snapshot();
      if(id.endsWith('tag')){
        check(JSON.stringify(initial.tags)===JSON.stringify(initial.labels),`${prefix}: tag labels/order follow payload`,initial);
        check(type==='icon'?initial.icons.every(i=>i==='location_on')&&initial.icons.length===2:initial.icons.length===0,`${prefix}: no invented tag icon`,initial.icons);
      }else check(initial.display===initial.labels.join(', '),`${prefix}: display all selected labels`,initial);
      check(initial.value===initial.payload,`${prefix}: public and submitted value agree`,initial);
      check(initial.summary===initial.labels.join(', '),`${prefix}: accessible summary follows visible values`,initial);
      await host.locator('.sf-dropdown-field > button').click();
      await host.locator('.sf-list-item[data-value="moscow"]').click();
      await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
      const changed=await snapshot();
      check(changed.payload==='kazan',`${prefix}: toggle one selection`,changed);
      if(!id.endsWith('tag'))check(changed.display===changed.labels.join(', '),`${prefix}: changed display`,changed);
      await page.keyboard.press('Escape');
      await host.evaluate(e=>e.closest('form').reset());await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
      check(JSON.stringify(await snapshot())===JSON.stringify(initial),`${prefix}: reset presentation`,await snapshot());
    }
  }
  }
  return {status:failures.length||errors.length?'failed':'passed',checks:results.length,failures,errors};
}
