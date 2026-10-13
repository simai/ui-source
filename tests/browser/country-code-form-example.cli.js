async page=>{
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const mode of ['base','smart'])for(const width of [390,1280])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:850});await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const c of ['buttons','country-code'])await page.addStyleTag({url:`${base}/component/${c}/css/${c}.css`});
    await page.addScriptTag({url:`${base}/component/country-code/js/country-code.js`});
    await page.addScriptTag({url:`${base}/smart/country-code/js/country-code.js`});
    await page.evaluate(async({base,theme,mode})=>{document.documentElement.className=`theme-${theme}`;const r=await fetch(`${base}/examples/country-code-form-${mode}.html`);if(!r.ok)throw Error('Missing example');const main=document.querySelector('main');main.innerHTML=await r.text();for(const script of [...main.querySelectorAll('script')]){const live=document.createElement('script');live.textContent=script.textContent;script.replaceWith(live);}}, {base,theme,mode});
    await page.locator('input[name="phone"]').fill('+7 1234567890');
    await page.getByRole('button',{name:'Проверить значение',exact:true}).click();
    const submitted=await page.locator('form').evaluate(f=>f.querySelector('output').textContent===f.querySelector('input').value);
    await page.locator('.sf-country-code').evaluate(e=>SF.CountryCode.setState(e,{iso2:'DE'}));
    await page.getByRole('button',{name:'Сбросить',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.sf-country-code').dataset.iso2==='RU');
    const row=await page.locator('form').evaluate(f=>({value:f.querySelector('input').value,iso2:f.querySelector('.sf-country-code').dataset.iso2,output:f.querySelector('output').value,buttonPaint:getComputedStyle(f.querySelector('button')).backgroundColor!=='rgba(0, 0, 0, 0)',overflow:document.documentElement.scrollWidth>innerWidth}));
    if(!submitted||row.value!=='+7 9991234567'||row.iso2!=='RU'||row.output!==''||!row.buttonPaint||row.overflow)failures.push({mode,width,theme,submitted,...row});
    results.push({mode,width,theme,submitted,...row});await page.screenshot({path:`output/playwright/country-code-form-${mode}-${width}-${theme}.png`,fullPage:true});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
