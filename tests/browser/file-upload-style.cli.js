async page => {
  await page.route('**/*', route => route.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser';
  const results=[],failures=[],errors=[]; page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,1280])for(const theme of ['light','dark'])for(const dir of ['ltr','rtl']){
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['file-upload','featured-icon','progress-bar'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const layer of (dir==='rtl'?['smart','component']:['component','smart']))await page.addScriptTag({url:`${base}/${layer}/file-upload/js/file-upload.js`});
    await page.evaluate(({theme,dir})=>{
      document.documentElement.className=`theme-${theme}`; document.documentElement.dir=dir;
      document.querySelector('main').innerHTML='<sf-file-upload id="upload" multiple accept=".txt" link-text="Выбрать файлы" text="или перетащите их сюда" aria-label="Приложения"></sf-file-upload><sf-file-upload id="other" aria-label="Другая загрузка"></sf-file-upload>';
      const host=document.querySelector('#upload'); window.uploadEvents=[];
      for(const name of ['select','file-add','remove','retry','file-error','file-complete','complete'])host.addEventListener(`sf-file-upload:${name}`,e=>uploadEvents.push({name,source:e.detail.source}));
    },{theme,dir});
    await page.waitForFunction(()=>document.querySelector('#upload input[type=file]'));
    await page.locator('#upload input[type=file]').setInputFiles(['tests/fixtures/file-upload/example.txt','tests/fixtures/file-upload/second.txt']);
    await page.waitForFunction(()=>document.querySelectorAll('#upload .sf-upload-progress').length===2);
    const row=await page.locator('#upload').evaluate(async host=>{
      const root=host.querySelector('.sf-file-upload'),input=root.querySelector('input'),file=host.items[0].file,items=host.items;
      const update=async action=>{const done=new Promise(resolve=>host.addEventListener('sf-after-render',resolve,{once:true}));action();await done;};
      const counts=()=>Object.fromEntries(['select','file-add','remove','retry','file-error','file-complete','complete'].map(name=>[name,uploadEvents.filter(e=>e.name===name).length]));
      const initial=counts(); const beforeEvents=uploadEvents.length;
      root.focus();
      await update(()=>{host.style.padding='var(--sf-space-2)';host.setAttribute('root-class','bg-surface-container');});
      const style=getComputedStyle(root),probe=document.createElement('span');probe.style.padding='var(--sf-space-2)';root.append(probe);const expected=getComputedStyle(probe).paddingTop;probe.remove();
      const styled=style.paddingTop===expected&&root.classList.contains('bg-surface-container');
      const preserved=root===host.querySelector('.sf-file-upload')&&input===root.querySelector('input')&&host.items===items&&host.items[0].file===file&&document.activeElement===root&&(await file.text()).trim()==='SF5 retained file';
      await update(()=>host.setAttribute('root-style','padding:var(--sf-space-3)'));
      probe.style.padding='var(--sf-space-3)';root.append(probe);const override=getComputedStyle(root).paddingTop===getComputedStyle(probe).paddingTop;probe.remove();
      let calls=0;const listener=root.__sfFileUploadOnClick;await host.afterRender(()=>{calls++;});
      const callback=calls===1&&listener===root.__sfFileUploadOnClick;
      const cosmeticSilent=uploadEvents.length===beforeEvents;
      await update(()=>host.setAttribute('disabled','true'));const disabled=input.disabled;
      await update(()=>host.setAttribute('disabled','false'));const enabled=!input.disabled;
      await update(()=>host.setItems([{...host.items[0],state:'error',errorMessage:'Повторить'},{...host.items[1],state:'done',progress:100}]));
      const afterStates=counts();
      await update(()=>host.setAttribute('supporting-text','Только текстовые файлы'));
      const noStateReplay=JSON.stringify(afterStates)===JSON.stringify(counts());
      return{styled,preserved,override,callback,cosmeticSilent,disabled,enabled,noStateReplay,initial,afterStates,inputEmpty:input.value==='',otherEmpty:document.querySelector('#other').items.length===0};
    });
    await page.locator('#upload [data-action=retry]').click();
    await page.waitForFunction(()=>document.querySelector('#upload').items[0].state==='process');
    await page.locator('#upload [data-action=remove]').click();
    await page.waitForFunction(()=>document.querySelector('#upload').items.length===1);
    const finish=await page.locator('#upload').evaluate(async host=>{
      const items=host.items,file=items[0].file;host.remove();document.querySelector('main').prepend(host);await host.whenRendered();
      return{retained:host.items[0].file===file&&(await file.text()).trim()==='Second file',names:host.items.map(i=>i.name),retry:uploadEvents.filter(e=>e.name==='retry').length,remove:uploadEvents.filter(e=>e.name==='remove').length,adds:uploadEvents.filter(e=>e.name==='file-add').length,selected:uploadEvents.filter(e=>e.name==='select').length};
    });
    const result={width,theme,dir,...row,finish};results.push(result);
    if(['styled','preserved','override','callback','cosmeticSilent','disabled','enabled','noStateReplay','inputEmpty','otherEmpty'].some(k=>!row[k])||row.initial.select!==1||row.initial['file-add']!==2||row.afterStates['file-error']!==1||row.afterStates['file-complete']!==1||!finish.retained||finish.retry!==1||finish.remove!==1||finish.adds!==2||finish.selected!==1)failures.push(result);
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
