async(page)=>{
  const results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html');
    await page.waitForFunction(()=>document.querySelector('#smart .sf-dropdown-field > button[aria-controls]'));
    await page.evaluate(async()=>{
      const response=await fetch('../../source/output/action-focus-browser/examples/dropdown-sizes.html');
      if(!response.ok)throw new Error('Missing sizes example');
      document.querySelector('main').innerHTML=await response.text();
    });
    await page.waitForFunction(()=>document.querySelectorAll('.sf-dropdown-field > button[aria-controls]').length===5);
    for(const root of await page.locator('.sf-dropdown').all()){
      const button=root.locator('.sf-dropdown-field > button');
      const name=await button.getAttribute('aria-labelledby');
      if(!name)throw new Error('Missing size control name');
      await button.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
      if(await root.locator('.sf-dropdown-field input').inputValue()!=='Значение')throw new Error('Size example keyboard selection failed');
      const rect=await root.boundingBox();
      if(rect.x<0||rect.x+rect.width>width)throw new Error('Size example outside viewport');
      results.push({width,size:await root.getAttribute('class')});
    }
    await page.screenshot({path:`output/playwright/dropdown-sizes-example-${width}.png`});
  }
  if(errors.length)throw new Error(errors.join('; '));
  return {status:'passed',checks:results.length,results,errors};
}
