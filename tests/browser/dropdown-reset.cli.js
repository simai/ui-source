async(page)=>{
  const results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  const check=(ok,label)=>{if(!ok)throw new Error(label);};
  const settle=()=>page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
  const state=id=>page.locator(`#${id}`).evaluate(e=>({
    display:e.querySelector('.sf-dropdown-field input:not([type="hidden"])')?.value,
    hidden:e.querySelector('input[type="hidden"]')?.value,
    selected:[...e.querySelectorAll('.sf-list-item.selected')].map(i=>i.dataset.value),
    aria:[...e.querySelectorAll('.sf-list-item[aria-selected="true"]')].map(i=>i.dataset.value),
    tags:[...e.querySelectorAll('.sf-dropdown-tag-container .sf-tag')].map(i=>i.dataset.value),
    value:e.tagName==='SF-DROPDOWN'?e.hiddenValue:e.dataset.selectedValue||'',
    publicValue:e.tagName==='SF-DROPDOWN'?e.value.value:undefined,
    summary:e.querySelector('.sf-dropdown-value')?.textContent
  }));
  const change=async id=>{
    await page.locator(`#${id}`).evaluate(e=>{
      e.querySelector('.sf-dropdown-field > button').click();
      e.querySelector('.sf-list .sf-list-item[data-value="moscow"]').click();
    });await settle();
  };
  const reset=async id=>{await page.locator(`#${id}`).evaluate(e=>e.closest('form').reset());await settle();};
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  for(const width of [390,1280])for(const initial of ['empty','preset','markup'])for(const unnamed of [false,true]){
    await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});await page.setViewportSize({width,height:1100});
    await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html?reset&${initial}&${unnamed?'unnamed':''}`);
    await page.waitForFunction(()=>document.querySelector('#smart-tag .sf-dropdown-field > button[aria-controls]'));
    for(const id of ['base','base-tag','smart','smart-tag']){
      const baseline=await state(id);
      if(id.startsWith('smart'))check(baseline.publicValue===baseline.value,`${id}: initial public value agrees with submitted value`);
      if(initial==='preset'&&id.endsWith('tag'))check(baseline.selected.join(',')==='kazan,moscow',`${id}: multiple preset admitted`);
      await change(id);const changed=await state(id);
      check(!equal(baseline,changed),`${id}: selection changes before reset`);
      await page.locator(`#${id}`).evaluate(e=>e.closest('form').addEventListener('reset',event=>event.preventDefault(),{once:true}));
      await reset(id);check(equal(await state(id),changed),`${id}/${initial}/${unnamed}: cancelled reset`);
      await page.locator(`#${id}`).evaluate(e=>{
        e.__resetEvents=[];
        for(const type of ['input','change','sf-dropdown:change'])e.addEventListener(type,event=>e.__resetEvents.push(event.type));
      });
      await reset(id);check(equal(await state(id),baseline),`${id}/${initial}/${unnamed}: restore all selection state ${JSON.stringify(await state(id))}`);
      check((await page.locator(`#${id}`).evaluate(e=>e.__resetEvents)).length===0,`${id}: silent reset`);
      await reset(id);check(equal(await state(id),baseline),`${id}: repeated reset with unchanged render value`);
      await change(id);await page.locator(`#${id}`).evaluate(e=>e.setAttribute('disabled',''));await settle();
      await reset(id);check(equal(await state(id),baseline),`${id}: disabled reset`);
      await page.locator(`#${id}`).evaluate(e=>e.removeAttribute('disabled'));await settle();
      await change(id);const beforeMove=await state(id);
      const oldForm=await page.locator(`#${id}`).evaluate(e=>e.closest('form').id);
      await page.locator(`#${id}`).evaluate(e=>document.getElementById('other-form').append(e));await settle();
      await page.locator(`#${oldForm}`).evaluate(e=>e.reset());await settle();
      check(equal(await state(id),beforeMove),`${id}: old form no longer resets moved control`);
      await reset(id);check(equal(await state(id),baseline),`${id}: new form resets moved control`);
      results.push({width,initial,unnamed,id,baseline});
    }
  }
  if(errors.length)throw new Error(errors.join('; '));
  return {status:'passed',cases:results.length,results,errors};
}
