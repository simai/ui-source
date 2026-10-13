async(page)=>{
  const failures=[],errors=[],results=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
  for(const width of [390,1280])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:640});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/field-controls-lab.html');
    await page.addStyleTag({url:'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser/component/buttons/css/buttons.css'});
    await page.waitForFunction(()=>document.querySelector('sf-input .sf-input-field'));
    await page.evaluate(async theme=>{
      document.documentElement.className=`theme-${theme}`;
      const response=await fetch('../../source/output/action-focus-browser/examples/smart-customization.html');
      if(!response.ok)throw new Error('Missing customization example');
      document.querySelector('main').innerHTML=await response.text();
    },theme);
    await page.addScriptTag({url:'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser/examples/smart-customization.js'});
    await page.waitForFunction(()=>document.querySelector('#customized-field .sf-input-field'));
    const field=page.locator('#customized-field .sf-input-field');
    const read=()=>field.evaluate(e=>{const c=getComputedStyle(e);return {radius:c.borderTopLeftRadius,padding:c.paddingInlineStart};});
    const before=await read();await page.locator('#apply-field-style').click();await page.waitForTimeout(120);
    const after=await read();
    if(before.radius===after.radius||before.padding===after.padding)failures.push({width,theme,step:'both settings applied',before,after});
    await page.screenshot({path:`output/playwright/smart-style-example-${width}-${theme}.png`});
    await page.locator('#reset-field-style').click();await page.waitForTimeout(120);
    const restored=await read();
    if(JSON.stringify(before)!==JSON.stringify(restored))failures.push({width,theme,step:'reset',before,restored});
    results.push({width,theme,before,after,restored});
  }
  return {status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
