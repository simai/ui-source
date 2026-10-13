async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const order of ['component-first','smart-first']){
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const layer of order==='component-first'?['component','smart']:['smart','component'])await page.addScriptTag({url:`${base}/${layer}/file-upload/js/file-upload.js`});
    await page.evaluate(()=>{
      document.querySelector('main').innerHTML='<div id="picker" class="sf-file-upload" data-target="#external">Files</div><aside id="external" class="sf-file-upload-files"></aside>';
      window.removed=0;document.querySelector('#picker').addEventListener('sf-file-upload:remove',()=>removed++);
    });
    await page.waitForFunction(()=>typeof document.querySelector('#picker').__sfFileUploadOnClick==='function');
    await page.locator('#picker input[type=file]').setInputFiles(['tests/fixtures/file-upload/example.txt']);
    const row=await page.evaluate(async()=>{
      const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const root=document.querySelector('#picker'),external=document.querySelector('#external');
      const file=SF.FileUpload.getItems(root)[0].file,oldRow=external.firstElementChild;
      const clone=root.cloneNode(true);clone.id='copy';root.after(clone);await settle();
      const cloneSafe=external.firstElementChild===oldRow&&SF.FileUpload.getItems(clone).length===0&&!clone.classList.contains('has-files');
      clone.remove();await settle();
      // The original list can leave the document before the picker. Teardown
      // must address the node actually bound, not a fresh selector result.
      external.remove();root.remove();await settle();
      oldRow.querySelector('[data-action="remove"]').click();
      const detachedSafe=removed===0&&SF.FileUpload.getItems(root)[0]?.file===file&&!root.__sfFileUploadInteractionObserver;
      document.querySelector('main').append(root,external);await settle();
      oldRow.querySelector('[data-action="remove"]').click();await settle();
      return{cloneSafe,detachedSafe,removed,reconnectedEmpty:SF.FileUpload.getItems(root).length===0,listEmpty:external.children.length===0};
    });
    results.push({order,...row});if(!row.cloneSafe||!row.detachedSafe||row.removed!==1||!row.reconnectedEmpty||!row.listEmpty)failures.push(results.at(-1));
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
