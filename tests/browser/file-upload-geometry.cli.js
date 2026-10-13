async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,1280])for(const theme of ['light','dark'])for(const dir of ['ltr','rtl'])for(const size of ['1/3','1/2','1','2','3']){
    await page.setViewportSize({width,height:1200});await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const n of ['file-upload','progress-bar','featured-icon'])await page.addStyleTag({url:`${base}/component/${n}/css/${n}.css`});
    await page.addScriptTag({url:`${base}/component/file-upload/js/file-upload.js`});
    for(const n of ['file-upload','progress-bar'])await page.addScriptTag({url:`${base}/smart/${n}/js/${n}.js`});
    await page.evaluate(({theme,dir,size})=>{
      document.documentElement.className=`theme-${theme}`;document.documentElement.dir=dir;
      document.querySelector('main').innerHTML=`<section id="ordinary"><div class="sf-file-upload sf-file-upload--size-${size} flex flex-col"><span>Выбрать файлы</span></div><div class="sf-file-upload-files grid gap-1"></div></section><section id="smart"><sf-file-upload size="${size}" link-text="Выбрать файлы"></sf-file-upload></section>`;
    },{theme,dir,size});
    await page.waitForFunction(()=>document.querySelectorAll('.sf-file-upload-input').length===2);
    await page.evaluate(()=>{const items=['process','error','done'].map(state=>({name:'Отчёт_'+ 'ДлинноеИмя'.repeat(20)+'.txt',state,fileSize:'123 MB',progress:state==='done'?100:30,errorMessage:'Повторить '+ 'Сообщение'.repeat(18)}));SF.FileUpload.setItems(document.querySelector('#ordinary .sf-file-upload'),items);document.querySelector('sf-file-upload').items=items;});
    await page.waitForFunction(()=>document.querySelectorAll('.sf-upload-progress').length===6);
    await page.evaluate(async()=>{await document.fonts.load('24px "Material Symbols Outlined"');document.querySelectorAll('.sf-icon').forEach(e=>e.classList.add('sf-icon-loaded'));});
    const inspect=()=>page.evaluate(()=>{
      const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,right:r.right,w:r.width,h:r.height,y:r.y,bottom:r.bottom};};
      const radius=token=>{const e=document.createElement('span');e.style.borderRadius=`var(${token})`;document.body.append(e);const r=getComputedStyle(e).borderTopLeftRadius;e.remove();return r;};
      const surface=radius('--sf-radius--surface'),control=radius('--sf-radius--ui');
      const paths=['ordinary','smart'].map(id=>{const owner=document.getElementById(id),root=owner.querySelector('.sf-file-upload');return{id,radius:getComputedStyle(root).borderTopLeftRadius,rows:[...owner.querySelectorAll('.sf-upload-progress')].map(row=>{
        const r=box(row),name=row.querySelector('.sf-upload-progress-name'),button=row.querySelector('[data-action=remove]'),retry=row.querySelector('[data-action=retry]');
        const checks=[name,button,retry,...row.querySelectorAll('.sf-progress-bar')].filter(Boolean);
        const progressOneLine=[...row.querySelectorAll('.sf-progress-bar-text')].every(e=>{const range=document.createRange();range.selectNodeContents(e);return range.getClientRects().length<=1;});
        return{row:r,progressOneLine,inside:checks.every(e=>{const b=box(e);return b.x>=r.x-1&&b.right<=r.right+1}),buttonRadius:button?getComputedStyle(button).borderTopLeftRadius:null,overlap:button?Math.min(box(name).right,box(button).right)>Math.max(box(name).x,box(button).x)+1:false};
      })};});
      return{surface,control,overflow:document.documentElement.scrollWidth>innerWidth,paths};
    });
    const ordinary=await inspect();
    await page.evaluate(()=>{document.documentElement.style.setProperty('--sf-radius--surface','var(--sf-radius-3)');document.documentElement.style.setProperty('--sf-radius--ui','var(--sf-radius-1)');});
    const customized=await inspect();
    await page.evaluate(()=>document.documentElement.style.fontSize='150%');
    const enlarged=await inspect();
    const row={width,theme,dir,size,ordinary,customized,enlarged};results.push(row);
    if([ordinary,customized,enlarged].some(s=>s.overflow||s.paths.some(p=>p.radius!==s.surface||p.rows.some(r=>!r.inside||!r.progressOneLine||r.overlap||(r.buttonRadius!==null&&r.buttonRadius!==s.control)))))failures.push(row);
    if(width===390&&size==='1'&&dir==='ltr')await page.screenshot({path:`output/playwright/file-upload-geometry-${theme}.png`,fullPage:true});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
