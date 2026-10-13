async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const mode of ['sibling','nested','smart'])for(const order of ['component-first','smart-first']){
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['file-upload','featured-icon','progress-bar'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const layer of order==='component-first'?['component','smart']:['smart','component'])await page.addScriptTag({url:`${base}/${layer}/file-upload/js/file-upload.js`});
    await page.evaluate(mode=>{
      const picker='<div class="sf-file-upload" multiple aria-label="Files">Выбрать',list='<div class="sf-file-upload-files"></div>';
      document.querySelector('main').innerHTML=`<div id="destination"></div><section id="original">${mode==='smart'?'<sf-file-upload multiple></sf-file-upload>':mode==='nested'?picker+list+'</div>':picker+'</div>'+list}</section>`;
      window.events={original:0,copy:0};document.querySelector('#original').addEventListener('sf-file-upload:select',()=>events.original++);
    },mode);
    await page.waitForFunction(()=>typeof document.querySelector('#original .sf-file-upload')?.__sfFileUploadOnClick==='function');
    await page.locator('#original input[type=file]').setInputFiles(['tests/fixtures/file-upload/example.txt']);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const cloned=await page.evaluate(async mode=>{
      window.owner=document.querySelector('#original');window.originalRoot=owner.querySelector('.sf-file-upload');window.retainedFile=SF.FileUpload.getItems(originalRoot)[0].file;
      const clone=owner.cloneNode(true);clone.id='copy';clone.addEventListener('sf-file-upload:select',()=>events.copy++);document.querySelector('main').append(clone);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      return{originalCount:SF.FileUpload.getItems(originalRoot).length,copyCount:SF.FileUpload.getItems(clone.querySelector('.sf-file-upload')).length,copyRows:clone.querySelectorAll('.sf-upload-progress').length,inputs:clone.querySelectorAll('input[type=file]').length,bound:typeof clone.querySelector('.sf-file-upload').__sfFileUploadOnClick==='function'};
    },mode);
    await page.locator('#copy input[type=file]').first().setInputFiles(['tests/fixtures/file-upload/second.txt']);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const selectedCopy=await page.evaluate(()=>({count:SF.FileUpload.getItems(document.querySelector('#copy .sf-file-upload')).length,originalRetained:SF.FileUpload.getItems(originalRoot)[0]?.file===retainedFile,events:{...events}}));
    const detached=await page.evaluate(async()=>{
      owner.remove();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const input=originalRoot.querySelector('input');input.dispatchEvent(new Event('change',{bubbles:true}));
      const dt=new DataTransfer();dt.items.add(new File(['detached'],'detached.txt'));
      originalRoot.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
      return{unbound:typeof originalRoot.__sfFileUploadOnClick!=='function',observerGone:!originalRoot.__sfFileUploadInteractionObserver,retained:SF.FileUpload.getItems(originalRoot)[0]?.file===retainedFile,events:{...events}};
    });
    await page.evaluate(()=>document.querySelector('main').append(owner));await page.waitForFunction(()=>typeof owner.querySelector('.sf-file-upload').__sfFileUploadOnClick==='function');
    const reinserted=await page.evaluate(async()=>{const root=owner.querySelector('.sf-file-upload');return{retained:SF.FileUpload.getItems(root)[0]?.file===retainedFile,content:await SF.FileUpload.getItems(root)[0]?.file.text(),events:{...events}};});
    await page.evaluate(()=>{const root=owner.querySelector('.sf-file-upload');delete root.dataset.sfFileUploadBound;});
    await page.addScriptTag({url:`${base}/component/file-upload/js/file-upload.js`});
    const repeated=await page.evaluate(async()=>{
      const root=owner.querySelector('.sf-file-upload');let clicks=0;root.querySelector('input').click=()=>clicks++;
      root.click();document.querySelector('#destination').append(owner);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      owner.querySelector('.sf-file-upload').click();return{clicks,retained:SF.FileUpload.getItems(owner.querySelector('.sf-file-upload'))[0]?.file===retainedFile,events:{...events}};
    });
    results.push({mode,order,cloned,selectedCopy,detached,reinserted,repeated});
    if(cloned.copyCount||cloned.copyRows||cloned.inputs!==1||!cloned.bound||selectedCopy.count!==1||!selectedCopy.originalRetained||selectedCopy.events.original!==1||selectedCopy.events.copy!==1||!detached.unbound||!detached.observerGone||!detached.retained||detached.events.original!==1||!reinserted.retained||reinserted.content?.trim()!=='SF5 retained file'||repeated.clicks!==2||!repeated.retained||repeated.events.original!==1)failures.push(results.at(-1));
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
