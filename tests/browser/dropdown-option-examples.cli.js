async(page)=>{
  const results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  for(const width of [390,1280])for(const theme of ['light','dark'])for(const kind of ['base','smart'])for(const type of ['icon','avatar','color','multiple-text']){
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html');
    await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(async({kind,type,theme})=>{
      document.documentElement.className=`theme-${theme}`;
      const response=await fetch(`../../source/output/action-focus-browser/examples/dropdown-${type}-${kind}.html`);
      if(!response.ok)throw new Error('Missing actual option example');
      document.querySelector('main').innerHTML=(await response.text()).replaceAll('assets/color-study.jpg','../../source/output/action-focus-browser/examples/assets/color-study.jpg');
    },{kind,type,theme});
    await page.waitForFunction(()=>document.querySelector('.sf-dropdown-field > button[aria-controls]'));
    const button=page.locator('.sf-dropdown-field > button');
    const state=()=>page.locator('form').evaluate(e=>({
      payload:[...new FormData(e)],
      labels:[...e.querySelectorAll('.sf-dropdown-tag-container .sf-tag-container')].map(n=>n.textContent.trim()),
      input:e.querySelector('.sf-dropdown-field input:not([type="hidden"])')?.value,
      summary:e.querySelector('.sf-dropdown-value')?.textContent,
    }));
    const initial=await state(),multiple=kind==='smart'||type==='multiple-text';
    if(type==='avatar'){
      const images=await page.locator('.sf-avatar').evaluateAll(async nodes=>Promise.all(nodes.map(async n=>{
        const url=getComputedStyle(n).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
        if(!url)return false;const image=new Image();image.src=url;await image.decode();return image.naturalWidth>0;
      })));
      if(images.length<(kind==='smart'?4:2)||images.some(ok=>!ok))throw new Error('Avatar source/tag images absent');
    }
    const initialValues=kind==='smart'?'moscow,kazan':multiple?'kazan,moscow':'kazan';
    if(initial.payload[0]?.[1]!==initialValues)throw new Error(`Initial ${kind}/${type}: ${JSON.stringify(initial)}`);
    await button.click();await page.locator('.sf-list-item[data-value="moscow"]').click();
    await page.waitForFunction(({multiple})=>document.querySelector('input[type="hidden"]').value===(multiple?'kazan':'moscow'),{multiple});
    const changed=await state(),label=`${type==='avatar'?'Отдел — ':''}${multiple?'Казань':'Москва'}`;
    if((changed.input??changed.labels.join(', '))!==label||changed.summary!==label)throw new Error(`Selection ${kind}/${type}: ${JSON.stringify(changed)}`);
    await page.keyboard.press('Escape');await page.locator('button[type="reset"]').click();
    await page.waitForFunction(value=>document.querySelector('input[type="hidden"]').value===value,initialValues);
    if(JSON.stringify(await state())!==JSON.stringify(initial))throw new Error(`Reset ${kind}/${type}`);
    await button.click();
    const overflow=await page.locator('.sf-dropdown').evaluate(e=>{const field=e.querySelector('.sf-dropdown-field'),list=e.querySelector('.sf-list');return [field,list].some(n=>n.scrollWidth>n.clientWidth+1);});
    if(overflow)throw new Error(`Overflow ${kind}/${type}/${width}`);
    if(width===390&&theme==='dark'&&type==='avatar')await page.screenshot({path:`output/playwright/dropdown-avatar-example-${kind}.png`});
    results.push({kind,type,width,theme});
  }
  return {status:errors.length?'failed':'passed',cases:results.length,results,errors};
}
