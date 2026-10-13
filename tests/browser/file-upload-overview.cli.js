async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,1280])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['file-upload','progress-bar','featured-icon'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const name of ['progress-bar','file-upload'])await page.addScriptTag({url:`${base}/component/${name}/js/${name}.js`});
    await page.evaluate(async({base,theme})=>{
      document.documentElement.className=`theme-${theme}`;
      const response=await fetch(`${base}/examples/file-upload-overview.html`);if(!response.ok)throw Error('Missing source example');
      document.querySelector('main').innerHTML=await response.text();
    },{base,theme});
    await page.locator('input[type=file]').setInputFiles(['tests/fixtures/file-upload/example.txt','tests/fixtures/file-upload/second.txt']);
    await page.waitForFunction(()=>document.querySelectorAll('.sf-upload-progress').length===2);
    const row=await page.evaluate(()=>({accept:document.querySelector('input[type=file]').accept,multiple:document.querySelector('input[type=file]').multiple,names:[...document.querySelectorAll('.sf-upload-progress-name')].map(e=>e.textContent),overflow:document.documentElement.scrollWidth>innerWidth}));
    await page.evaluate(async()=>{await document.fonts.load('24px "Material Symbols Outlined"');document.querySelectorAll('.sf-icon').forEach(e=>e.classList.add('sf-icon-loaded'));});
    await page.screenshot({path:`output/playwright/file-upload-overview-${width}-${theme}.png`,fullPage:true});
    await page.getByRole('button',{name:'Удалить example.txt',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.sf-upload-progress').length===1);
    const remaining=await page.locator('.sf-upload-progress-name').textContent();
    results.push({width,theme,...row,remaining});
    if(!row.multiple||row.accept!=='image/png,image/jpeg'||row.names.join(',')!=='example.txt,second.txt'||row.overflow||remaining!=='second.txt')failures.push(results.at(-1));
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
