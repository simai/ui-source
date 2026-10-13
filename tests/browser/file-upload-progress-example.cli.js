async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
  for(const width of [390,1280])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['buttons','file-upload','progress-bar'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const name of ['progress-bar','file-upload'])await page.addScriptTag({url:`${base}/component/${name}/js/${name}.js`});
    await page.evaluate(async({base,theme})=>{
      document.documentElement.className=`theme-${theme}`;const response=await fetch(`${base}/examples/file-upload-controlled.html`);if(!response.ok)throw Error('Missing actual example');
      const main=document.querySelector('main');main.innerHTML=await response.text();for(const inert of [...main.querySelectorAll('script')]){const live=document.createElement('script');live.textContent=inert.textContent;inert.replaceWith(live);}
    },{base,theme});
    const initiallyDisabled=await page.locator('[data-state]').evaluateAll(buttons=>buttons.every(b=>b.disabled));
    await page.locator('input[type=file]').setInputFiles(['tests/fixtures/file-upload/example.txt']);
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-state]')].every(b=>!b.disabled));
    await page.evaluate(()=>window.chosenFile=SF.FileUpload.getItems(document.querySelector('.sf-file-upload'))[0].file);
    await page.getByRole('button',{name:'Показать 65%',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.sf-progress-bar-text')?.textContent==='65%');
    await page.getByRole('button',{name:'Ошибка',exact:true}).click();await page.getByRole('button',{name:'Повторить',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.sf-progress-bar-text')?.textContent==='0%');
    await page.getByRole('button',{name:'Завершить',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.sf-progress-bar-text')?.textContent==='100%');
    const row=await page.evaluate(async()=>{const root=document.querySelector('.sf-file-upload'),item=SF.FileUpload.getItems(root)[0];return{sameFile:item.file===chosenFile,content:(await item.file.text()).trim(),state:item.state,fill:document.querySelector('.sf-progress-bar-progress').style.width,overflow:document.documentElement.scrollWidth>innerWidth};});
    await page.evaluate(async()=>{await document.fonts.load('24px "Material Symbols Outlined"');document.querySelectorAll('.sf-icon').forEach(e=>e.classList.add('sf-icon-loaded'));});
    await page.screenshot({path:`output/playwright/file-upload-progress-${width}-${theme}.png`,fullPage:true});
    results.push({width,theme,initiallyDisabled,...row});if(!initiallyDisabled||!row.sameFile||row.content!=='SF5 retained file'||row.state!=='done'||row.fill!=='100%'||row.overflow)failures.push(results.at(-1));
  }
  return{status:failures.length||errors.length||writes.length?'failed':'passed',cases:results.length,failures,errors,writes,results};
}
