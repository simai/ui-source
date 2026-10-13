async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const mode of ['ordinary-native','ordinary-alias','smart'])for(const dir of ['ltr','rtl']){
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const layer of ['component','smart'])await page.addScriptTag({url:`${base}/${layer}/file-upload/js/file-upload.js`});
    await page.evaluate(({mode,dir})=>{
      document.documentElement.dir=dir;
      document.querySelector('main').innerHTML=mode==='smart'?'<sf-file-upload id="subject" accept=".txt"></sf-file-upload>':'<div id="subject" class="sf-file-upload" accept=".txt">Files</div><div class="sf-file-upload-files"></div>';
      window.selectionEvents=[];document.querySelector('#subject').addEventListener('sf-file-upload:select',e=>selectionEvents.push({source:e.detail.source,count:e.detail.files.length,multiple:e.detail.multiple}));
    },{mode,dir});
    await page.waitForFunction(()=>document.querySelector('.sf-file-upload-input'));
    const row=await page.evaluate(async mode=>{
      const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const subject=document.querySelector('#subject'),root=()=>document.querySelector('.sf-file-upload'),input=()=>root().querySelector('input[type=file]');
      const items=()=>mode==='smart'?subject.getItems():SF.FileUpload.getItems(root());
      const config=(multiple,accept)=>{subject.setAttribute(mode==='ordinary-alias'?'data-accept':'accept',accept);const attr=mode==='ordinary-alias'?'data-multiple':'multiple';if(multiple)subject.setAttribute(attr,'true');else subject.removeAttribute(attr);};
      const transfer=()=>{const dt=new DataTransfer();dt.items.add(new File(['first'],'a.txt',{type:'text/plain'}));dt.items.add(new File(['second'],'b.bin',{type:'application/octet-stream'}));return dt;};
      const drag=(type,dt)=>{const e=new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:dt});root().dispatchEvent(e);return{cancelled:e.defaultPrevented,highlight:root().classList.contains('dragover'),effect:dt.dropEffect};};
      const dt=transfer(),single=drag('drop',dt);await settle();
      const singleCount=items().length,firstIdentity=items()[0]?.file===dt.files[0];
      config(true,'image/*');await settle();
      const nativeMultiple=input().multiple,nativeAccept=input().accept;
      const multi=transfer();drag('dragover',multi);const highlighted=root().classList.contains('dragover');drag('drop',multi);await settle();
      const multiCount=items().length,content=await items()[1]?.file.text();
      const text=new DataTransfer();text.setData('text/plain','text only');const textOver=drag('dragover',text),textDrop=drag('drop',text);await settle();
      const textKeepsItems=items().length===2;
      config(false,'.txt');await settle();const nativeSingle=!input().multiple;
      subject.setAttribute('disabled','');await settle();
      const eventCount=selectionEvents.length,disabledOver=drag('dragover',transfer()),disabledDrop=drag('drop',transfer());await settle();
      const disabledUnchanged=items().length===2&&selectionEvents.length===eventCount;
      subject.removeAttribute('disabled');await settle();drag('drop',transfer());await settle();
      return{single,singleCount,firstIdentity,nativeMultiple,nativeAccept,highlighted,multiCount,content,textOver,textDrop,textKeepsItems,nativeSingle,disabledOver,disabledDrop,disabledUnchanged,resumedCount:items().length,events:selectionEvents};
    },mode);
    const ok=row.singleCount===1&&row.firstIdentity&&row.nativeMultiple&&row.nativeAccept==='image/*'&&row.highlighted&&row.multiCount===2&&row.content==='second'&&!row.textOver.cancelled&&!row.textOver.highlight&&!row.textDrop.cancelled&&row.textKeepsItems&&row.nativeSingle&&row.disabledOver.cancelled&&row.disabledDrop.cancelled&&!row.disabledOver.highlight&&row.disabledOver.effect==='none'&&row.disabledUnchanged&&row.resumedCount===1&&row.events.length===3;
    await page.evaluate(()=>document.querySelector('#subject').setAttribute('multiple',''));
    await page.waitForFunction(()=>document.querySelector('.sf-file-upload-input').multiple);
    await page.locator('input[type=file]').setInputFiles(['tests/fixtures/file-upload/example.txt','tests/fixtures/file-upload/second.txt']);
    await page.waitForFunction(()=>selectionEvents.length===4);
    await page.locator('input[type=file]').setInputFiles(['tests/fixtures/file-upload/example.txt','tests/fixtures/file-upload/second.txt']);
    await page.waitForFunction(()=>selectionEvents.length===5);
    await page.locator('input[type=file]').setInputFiles([]);
    const native=await page.evaluate(async mode=>{
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const items=mode==='smart'?document.querySelector('#subject').getItems():SF.FileUpload.getItems(document.querySelector('.sf-file-upload'));
      return{count:items.length,contents:await Promise.all(items.map(i=>i.file.text())),events:selectionEvents.slice(3),totalEvents:selectionEvents.length,inputEmpty:!document.querySelector('input[type=file]').value};
    },mode);
    const nativeOk=native.count===2&&native.contents[0].trim()==='SF5 retained file'&&native.contents[1].trim()==='Second file'&&native.totalEvents===5&&native.events.every(e=>e.source==='input'&&e.count===2&&e.multiple)&&native.inputEmpty;
    results.push({mode,dir,...row,native});if(!ok||!nativeOk)failures.push(results.at(-1));
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
