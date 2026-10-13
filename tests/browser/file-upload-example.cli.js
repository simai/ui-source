async page => {
  await page.route('**/*',route=>route.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,1280])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['buttons','file-upload','featured-icon','progress-bar'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const name of ['progress-bar','file-upload'])await page.addScriptTag({url:`${base}/smart/${name}/js/${name}.js`});
    await page.evaluate(async({base,theme})=>{
      document.documentElement.className=`theme-${theme}`;
      const response=await fetch(`${base}/examples/file-upload-customization.html`);if(!response.ok)throw Error('Missing actual example');
      const main=document.querySelector('main');main.innerHTML=await response.text();
      for(const inert of [...main.querySelectorAll('script')]){const live=document.createElement('script');live.textContent=inert.textContent;inert.replaceWith(live);}
    },{base,theme});
    await page.locator('sf-file-upload input[type=file]').setInputFiles(['tests/fixtures/file-upload/example.txt']);
    await page.waitForFunction(()=>document.querySelector('output').value==='Выбрано файлов: 1');
    const before=await page.locator('sf-file-upload').evaluate(h=>{window.selectedFile=h.items[0].file;return getComputedStyle(h.querySelector('.sf-file-upload')).paddingTop;});
    await page.getByRole('button',{name:'Изменить отступ',exact:true}).click();
    await page.waitForFunction(p=>getComputedStyle(document.querySelector('.sf-file-upload')).paddingTop!==p,before);
    const row=await page.locator('sf-file-upload').evaluate(async h=>({retained:h.items[0].file===selectedFile&&(await h.items[0].file.text()).trim()==='SF5 retained file',output:document.querySelector('output').value,overflow:document.documentElement.scrollWidth>innerWidth}));
    await page.evaluate(async()=>{await document.fonts.load('24px "Material Symbols Outlined"');document.querySelectorAll('.sf-icon').forEach(e=>e.classList.add('sf-icon-loaded'));});
    await page.screenshot({path:`output/playwright/file-upload-customization-${width}-${theme}.png`,fullPage:true});
    await page.locator('[data-action=remove]').click();
    await page.waitForFunction(()=>document.querySelector('output').value==='Файлы не выбраны');
    results.push({width,theme,...row});if(!row.retained||row.overflow||row.output!=='Выбрано файлов: 1')failures.push(results.at(-1));
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
