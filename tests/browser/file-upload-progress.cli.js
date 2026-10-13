async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const mode of ['ordinary','smart'])for(const order of ['progress-first','upload-first'])for(const dir of ['ltr','rtl']){
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.emulateMedia({reducedMotion:'reduce'});
    for(const name of ['file-upload','progress-bar'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    const progress=()=>page.addScriptTag({url:`${base}/smart/progress-bar/js/progress-bar.js`});
    if(order==='progress-first')await progress();
    for(const layer of ['component','smart'])await page.addScriptTag({url:`${base}/${layer}/file-upload/js/file-upload.js`});
    await page.evaluate(({mode,dir})=>{
      document.documentElement.dir=dir;
      document.querySelector('main').innerHTML=mode==='smart'?'<sf-file-upload id="upload"></sf-file-upload>':'<div id="upload"><div class="sf-file-upload sf-file-upload--size-1 flex flex-col" aria-label="Файлы">Выбрать файлы</div><div class="sf-file-upload-files"></div></div>';
    },{mode,dir});
    await page.waitForFunction(()=>document.querySelector('.sf-file-upload-input'));
    await page.evaluate(mode=>{
      window.progressEvents=[];document.querySelector('#upload').addEventListener('sf-file-upload:file-error',()=>progressEvents.push('error'));document.querySelector('#upload').addEventListener('sf-file-upload:file-complete',()=>progressEvents.push('file-complete'));document.querySelector('#upload').addEventListener('sf-file-upload:complete',()=>progressEvents.push('complete'));
      window.updateUpload=item=>mode==='smart'?document.querySelector('#upload').setItems([{id:'file',name:'example.txt',...item}]):SF.FileUpload.setItems(document.querySelector('.sf-file-upload'),[{id:'file',name:'example.txt',...item}]);
      updateUpload({state:'process',progress:30});
    },mode);
    if(order==='upload-first')await progress();
    await page.waitForFunction(()=>document.querySelector('.sf-progress-bar')?.dataset.sfProgressBarBound==='1');
    const measure=()=>page.evaluate(()=>{const p=document.querySelector('.sf-progress-bar');return p?{value:Number(p.dataset.value),text:p.querySelector('.sf-progress-bar-text')?.textContent,width:p.querySelector('.sf-progress-bar-progress').style.width,position:p.dataset.textPosition}:null;});
    const initial=await measure(),steps=[];
    for(const value of [0,37.5,100,-10,150]){
      await page.evaluate(value=>updateUpload({state:'process',progress:value}),value);
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      steps.push({requested:value,...await measure()});
    }
    await page.evaluate(()=>updateUpload({state:'error',progress:37.5,errorMessage:'Повторить'}));
    await page.locator('[data-action=retry]').click();
    await page.waitForFunction(()=>document.querySelector('.sf-progress-bar'));
    const retried=await measure();
    await page.evaluate(()=>updateUpload({state:'done',progress:100}));
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const done=await measure();
    await page.evaluate(mode=>{if(mode==='smart')document.querySelector('#upload').style.padding='var(--sf-space-2)';else updateUpload({state:'done',progress:100});},mode);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const events=await page.evaluate(()=>progressEvents);
    const valid=(r,value)=>r&&r.value===value&&r.text===`${value}%`&&r.width===`${value}%`&&r.position==='inline-end';
    const row={mode,order,dir,initial,steps,retried,done,events};results.push(row);
    if(!valid(initial,30)||steps.some(s=>!valid(s,Math.max(0,Math.min(100,s.requested))))||!valid(retried,0)||!valid(done,100)||JSON.stringify(events)!==JSON.stringify(['error','file-complete','complete']))failures.push(row);
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
