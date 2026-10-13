async(page)=>{
  const results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  const check=(ok,label)=>{if(!ok)throw new Error(label);results.push(label);};
  const settle=()=>page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
  const selection=e=>({value:e.tagName==='SF-DROPDOWN'?e.hiddenValue:e.dataset.selectedValue||'',
    selected:[...e.querySelectorAll('.sf-list-item.selected')].map(item=>item.dataset.value),
    display:e.querySelector('.sf-dropdown-field input:not([type="hidden"])')?.value,
    tags:[...e.querySelectorAll('.sf-dropdown-tag-container .sf-tag')].map(item=>item.dataset.value)});
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});await page.setViewportSize({width:1280,height:1000});
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?reset&preset');
  await page.waitForFunction(()=>document.querySelector('#smart-tag .sf-dropdown-field > button[aria-controls]'));
  for(const id of ['base','base-tag','smart','smart-tag']){
    const host=page.locator(`#${id}`),initial=await host.evaluate(selection);
    await host.locator('.sf-dropdown-field > button').click();
    await host.locator('.sf-list [data-value="moscow"]').click();await settle();
    await page.locator('#before').click();
    const changed=await host.evaluate(selection),form=await host.evaluate(e=>e.closest('form').id);
    const handle=await host.elementHandle();
    await handle.evaluate(e=>e.remove());await settle();
    await page.locator(`#${form}`).evaluate(e=>e.reset());await settle();
    check(JSON.stringify(await handle.evaluate(selection))===JSON.stringify(changed),`${id}: detached root not reset`);
    await handle.evaluate(e=>document.getElementById('other-form').append(e));await settle();
    await page.locator('#reset-demo').evaluate(e=>e.setAttribute('form','other-form'));
    await page.locator('#reset-demo').click();await settle();
    check(JSON.stringify(await host.evaluate(selection))===JSON.stringify(initial),`${id}: reconnected root reset by real button`);
    check(await host.locator('.sf-dropdown-value').count()===1,`${id}: one accessible value summary after reconnect`);
    await host.locator('.sf-dropdown-field > button').focus();await page.keyboard.press('ArrowDown');
    check(await host.locator('.sf-dropdown-field > button').getAttribute('aria-expanded')==='true',`${id}: keyboard after reconnect`);
    await host.locator('.sf-list input').fill('КАЗ');await settle();
    await host.evaluate(e=>e.closest('form').reset());await settle();
    check(await host.locator('.sf-dropdown-field > button').evaluate(e=>e.getAttribute('aria-expanded')==='false'&&e===document.activeElement),`${id}: reset closes search and restores keyboard focus`);
    check(await host.locator('.sf-list input').inputValue()===''&&await host.locator('.sf-list-item:not([hidden])').count()===3,`${id}: reset clears filter and restores all options`);
  }
  await page.screenshot({path:'output/playwright/dropdown-reset.png'});
  if(errors.length)throw new Error(errors.join('; '));
  return {status:'passed',checks:results.length,results,errors};
}
