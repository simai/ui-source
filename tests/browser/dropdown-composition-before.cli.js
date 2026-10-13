async(page)=>{
  const results=[];await page.emulateMedia({forcedColors:'none'});
  for(const checkbox of [false,true]){
    await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?reset&preset&${checkbox?'checkbox':''}`);
    await page.waitForFunction(()=>document.querySelector('#smart-tag .sf-dropdown-field > button[aria-controls]'));
    for(const id of ['base','base-tag','smart','smart-tag']){
      const host=page.locator(`#${id}`);
      const state=await host.evaluate(e=>{
        const field=e.querySelector('.sf-dropdown-field'),s=getComputedStyle(field);
        return {border:s.borderTopColor,background:s.backgroundColor,disabled:e.querySelector('.sf-dropdown-field > button').disabled};
      });
      const events=await host.evaluate(async e=>{
        const events=[];const record=event=>events.push(event.type);
        e.addEventListener('change',record);e.addEventListener('input',record);
        e.closest('form').reset();await new Promise(resolve=>setTimeout(resolve,30));
        e.removeEventListener('change',record);e.removeEventListener('input',record);return events;
      });
      results.push({id,checkbox,state,events});
    }
  }
  return {results};
}
