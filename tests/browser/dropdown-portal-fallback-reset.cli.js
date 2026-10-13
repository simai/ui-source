async(page)=>{
  const results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  for(const width of [390,1280])for(const id of ['base','base-tag','smart','smart-tag']){
    await page.setViewportSize({width,height:700});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?reset&preset&portal');
    await page.waitForFunction(()=>document.querySelector('#smart-tag .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(id=>{
      HTMLElement.prototype.showPopover=undefined;
      const host=document.getElementById(id),form=host.closest('form');form.replaceChildren(host);
      document.querySelector('main').replaceChildren(form);
      form.style.cssText='overflow:hidden;transform:translateZ(0)';
    },id);
    const host=page.locator(`#${id}`),button=host.locator('.sf-dropdown-field > button');
    const snapshot=()=>host.evaluate(e=>({payload:[...new FormData(e.closest('form'))],summary:e.querySelector('.sf-dropdown-value')?.textContent}));
    const initial=await snapshot();
    await button.click();await page.locator('.sf-list-item[data-value="moscow"]').click();
    if(JSON.stringify(await snapshot())===JSON.stringify(initial))throw new Error('Selection did not change');
    if(!await page.locator('body > .sf-dropdown').count())await button.click();
    await host.evaluate(e=>e.closest('form').reset());
    await page.waitForFunction(()=>!document.querySelector('body > .sf-dropdown'));
    if(JSON.stringify(await snapshot())!==JSON.stringify(initial))throw new Error(`Reset mismatch ${id}`);
    const restored=await host.locator('.sf-list').count();if(restored!==1)throw new Error('Panel not returned to owner');
    results.push({id,width});
  }
  return {status:errors.length?'failed':'passed',cases:results.length,results,errors};
}
