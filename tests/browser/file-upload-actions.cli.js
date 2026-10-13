async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,1280])for(const theme of ['light','dark'])for(const dir of ['ltr','rtl'])for(const size of ['1/3','1/2','1','2','3']){
    await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce',forcedColors:'none'});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    for(const name of ['file-upload','progress-bar'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addScriptTag({url:`${base}/component/file-upload/js/file-upload.js`});
    for(const name of ['file-upload','progress-bar'])await page.addScriptTag({url:`${base}/smart/${name}/js/${name}.js`});
    await page.evaluate(({size,theme,dir})=>{
      document.documentElement.className=`theme-${theme}`;document.documentElement.dir=dir;
      document.querySelector('main').innerHTML=`<div class="flex"><button id="reference" aria-label="Reference" class="sf-icon-button sf-icon-button--icon sf-icon-button--on-surface sf-icon-button--link sf-icon-button--size-${size} flex items-center justify-center"><i class="sf-icon" aria-hidden="true">delete</i></button></div><section id="ordinary"><div class="sf-file-upload sf-file-upload--size-${size}">Выбрать</div><div class="sf-file-upload-files grid gap-2"></div></section><section id="smart"><sf-file-upload size="${size}"></sf-file-upload></section>`;
    },{size,theme,dir});
    await page.waitForFunction(()=>document.querySelectorAll('.sf-file-upload-input').length===2);
    await page.evaluate(()=>{
      const items=['process','error'].map(state=>({name:'ДлинноеИмя'.repeat(14)+'.txt',state,progress:45,errorMessage:'Повторить',fileSize:'100 KB'}));
      SF.FileUpload.setItems(document.querySelector('#ordinary .sf-file-upload'),items);document.querySelector('sf-file-upload').items=items;
    });
    await page.waitForFunction(()=>document.querySelectorAll('[data-action=remove]').length===4);
    await page.evaluate(async()=>{await document.fonts.load('24px "Material Symbols Outlined"');document.querySelectorAll('.sf-icon').forEach(e=>e.classList.add('sf-icon-loaded'));});
    const inspect=()=>page.evaluate(()=>{
      const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
      const reference=box(document.querySelector('#reference'));
      return{reference,overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('[data-action=remove]')].map(e=>{
        const b=box(e),i=box(e.querySelector('.sf-icon')),name=box(e.closest('.sf-upload-progress-top').querySelector('.sf-upload-progress-name'));
        return{box:b,centered:Math.abs(b.x+b.w/2-i.x-i.w/2)<1&&Math.abs(b.y+b.h/2-i.y-i.h/2)<1,overlap:Math.min(b.right,name.right)>Math.max(b.x,name.x)+1,match:Math.abs(b.w-reference.w)<1&&Math.abs(b.h-reference.h)<1};
      })};
    });
    const normal=await inspect();
    await page.locator('#ordinary [data-action=remove]').first().hover();
    const hover=await page.locator('#ordinary [data-action=remove]').first().evaluate(e=>({background:getComputedStyle(e).backgroundColor,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}));
    await page.locator('#ordinary .sf-file-upload').focus();await page.keyboard.press('Tab');
    const focus=await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e),r=e.getBoundingClientRect();return{action:e.getAttribute('data-action'),visible:e.matches(':focus-visible'),ring:s.boxShadow!=='none'||s.outlineStyle!=='none',w:r.width,h:r.height};});
    await page.emulateMedia({forcedColors:'active'});
    const forced=await page.evaluate(()=>{const s=getComputedStyle(document.activeElement);return{style:s.outlineStyle,width:parseFloat(s.outlineWidth)};});
    await page.emulateMedia({forcedColors:'none'});await page.locator('#ordinary [data-action=retry]').focus();
    const retry=await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return{visible:e.matches(':focus-visible'),ring:s.boxShadow.includes('inset')||s.outlineStyle!=='none',width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height};});
    await page.evaluate(()=>document.documentElement.style.fontSize='150%');const enlarged=await inspect();
    const row={width,theme,dir,size,normal,hover,focus,forced,retry,enlarged};results.push(row);
    if([normal,enlarged].some(s=>s.overflow||s.buttons.some(b=>!b.match||!b.centered||b.overlap))||hover.background==='rgba(0, 0, 0, 0)'||Math.abs(hover.h-normal.reference.h)>1||focus.action!=='remove'||!focus.visible||!focus.ring||Math.abs(focus.h-normal.reference.h)>1||forced.style==='none'||forced.width<=0||!retry.visible||!retry.ring)failures.push(row);
    if(width===390&&dir==='ltr'&&size==='1')await page.screenshot({path:`output/playwright/file-upload-actions-${theme}.png`,fullPage:true});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
