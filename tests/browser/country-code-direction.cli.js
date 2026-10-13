async page => {
  await page.route('**/*', route=>route.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const mode of ['base','smart'])for(const dir of ['ltr','rtl'])for(const mask of [false,true]){
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.addStyleTag({url:`${base}/component/country-code/css/country-code.css`});
    await page.addScriptTag({url:'http://127.0.0.1:8765/ui-source/node_modules/imask/dist/imask.min.js'});
    await page.evaluate(()=>{window.SF={Mask:{create:async(e,o)=>IMask(e,o),destroy:m=>m?.destroy()}};});
    for(const layer of ['component','smart'])await page.addScriptTag({url:`${base}/${layer}/country-code/js/country-code.js`});
    await page.evaluate(({mode,dir,mask})=>{
      document.documentElement.dir=dir;const main=document.querySelector('main');main.replaceChildren();
      if(mode==='smart'){const host=document.createElement('sf-country-code');for(const [k,v] of Object.entries({iso2:'RU',value:'+7 9991234567','use-mask':String(mask)}))host.setAttribute(k,v);main.append(host);}
      else{const C=window.__sfComponentClasses.CountryCode||new Map(window.SF_PENDING_COMPONENTS||[]).get('CountryCode');main.append(new C({param:{iso2:'RU',value:'+7 9991234567',useMask:mask}}).render());}
    },{mode,dir,mask});
    await page.waitForFunction(mask=>{const r=document.querySelector('.sf-country-code');return r?.__sfCountryCodeInput&&(!mask||r.__sfCountryMask);},mask);
    const input=page.locator('.sf-country-code input');await input.focus();const initial=await input.inputValue();
    await page.keyboard.press('Home');await page.keyboard.press('Backspace');
    const prefixProtected=await input.inputValue()===initial;
    await page.keyboard.press('End');await page.keyboard.press('Backspace');await page.keyboard.type('8');
    const row=await input.evaluate(e=>({value:e.value,direction:getComputedStyle(e).direction,position:e.selectionStart,end:e.value.length}));
    if(!prefixProtected||row.direction!=='ltr'||row.position!==row.end||row.value.replace(/\D/g,'')!=='79991234568')failures.push({mode,dir,mask,initial,prefixProtected,...row});
    results.push({mode,dir,mask,initial,prefixProtected,...row});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
