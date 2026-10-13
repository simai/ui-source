async(page)=>{
  const results=[],failures=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  const check=(ok,label,data)=>{results.push(label);if(!ok)failures.push({label,data});};
  const radius=async locator=>{
    await locator.evaluate(async e=>{getComputedStyle(e).borderRadius;await Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{})));});
    return locator.evaluate(e=>{const s=getComputedStyle(e);return [s.borderStartStartRadius,s.borderStartEndRadius,s.borderEndStartRadius,s.borderEndEndRadius];});
  };
  for(const width of [390,1280])for(const theme of ['light','dark'])for(const direction of ['ltr','rtl']){
    await page.setViewportSize({width,height:1200});await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?reset&preset${direction==='rtl'?'&rtl':''}`);
    await page.waitForFunction(()=>document.querySelector('#smart-tag .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(theme=>{
      document.documentElement.className=`theme-${theme}`;
      document.documentElement.style.setProperty('--sf-radius--ui','8px');
      document.documentElement.style.setProperty('--sf-radius--surface','20px');
    },theme);
    for(const id of ['base','base-tag','smart','smart-tag']){
      const host=page.locator(`#${id}`),field=host.locator('.sf-dropdown-field'),button=field.locator(':scope > button');
      const prefix=`${width}/${theme}/${direction}/${id}`;
      let value=await radius(field);check(value.every(v=>v==='8px'),`${prefix}: UI field role`,value);
      value=await radius(button);check(value.every(v=>v==='8px'),`${prefix}: UI toggle role`,value);
      if(id.endsWith('tag')){
        value=await radius(host.locator('.sf-tag').first());check(value.every(v=>v==='8px'),`${prefix}: UI tag role`,value);
        value=await radius(host.locator('.sf-tag button').first());check(value.every(v=>v==='8px'),`${prefix}: UI remove role`,value);
      }
      await button.click();
      const list=host.locator('.sf-list');value=await radius(list);
      check(value.every(v=>v==='20px'),`${prefix}: surface panel role`,value);
      await host.evaluate(e=>e.setAttribute('style','--sf-dropdown--radius:12px;--sf-list--border-top-left-radius:16px;--sf-list--border-width:3px;--sf-list--border-bottom-width:5px'));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      value=await radius(field);check(value.every(v=>v==='12px'),`${prefix}: inherited field override`,value);
      value=await radius(list);check(value[0]==='16px'&&value[1]==='20px',`${prefix}: panel corner override`,value);
      const border=await list.evaluate(e=>{const s=getComputedStyle(e);return [s.borderTopWidth,s.borderBottomWidth];});
      check(border[0]==='3px'&&border[1]==='5px',`${prefix}: independent border override`,border);
      if(id.startsWith('smart')){
        await host.evaluate(e=>{e.setAttribute('root-class','max-w-sm');e.setAttribute('root-style','--sf-dropdown--radius:4px');});
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        value=await radius(field);check(value.every(v=>v==='4px'),`${prefix}: root-style precedence`,value);
        check(await host.locator('.sf-dropdown').evaluate(e=>e.classList.contains('max-w-sm')),`${prefix}: root-class consumed`);
        await host.evaluate(e=>{e.removeAttribute('root-class');e.removeAttribute('root-style');});
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        value=await radius(field);check(value.every(v=>v==='12px'),`${prefix}: root-style removal restores captured style`,value);
      }
      await page.keyboard.press('Escape');
    }
  }
  await page.screenshot({path:'output/playwright/dropdown-radius.png'});
  return {status:failures.length||errors.length?'failed':'passed',checks:results.length,failures,errors};
}
