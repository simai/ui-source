async(page)=>{
  const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html');
  await page.waitForFunction(()=>document.querySelector('#smart-tag .sf-dropdown-field > button[aria-controls]'));
  const state=async id=>page.locator(`#${id}`).evaluate(e=>({
    display:e.querySelector('.sf-dropdown-field input:not([type="hidden"])')?.value,
    hidden:e.querySelector('input[type="hidden"]').value,
    selected:[...e.querySelectorAll('.sf-list-item.selected')].map(i=>i.dataset.value),
    tags:[...e.querySelectorAll('.sf-dropdown-tag-container .sf-tag')].map(i=>i.dataset.value)
  }));
  for(const id of ['base','smart','smart-tag']){
    const initial=await state(id);
    await page.locator(`#${id} .sf-dropdown-field > button`).click();
    await page.locator(`#${id} .sf-list [data-value="moscow"]`).click();
    await page.evaluate(()=>new Promise(requestAnimationFrame));
    const selected=await state(id);
    await page.locator(`#${id}`).evaluate(e=>e.closest('form').reset());
    await page.evaluate(()=>new Promise(requestAnimationFrame));
    const reset=await state(id);
    results.push({id,initial,selected,reset,restored:JSON.stringify(initial)===JSON.stringify(reset)});
    await page.locator('#before').click();
  }
  return {results,errors};
}
