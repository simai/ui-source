async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,1280])for(const theme of ['light','dark'])for(const dir of ['ltr','rtl'])for(const size of ['1/3','1/2','1','2','3']){
    await page.setViewportSize({width,height:1100});await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.addStyleTag({url:`${base}/component/file-upload/css/file-upload.css`});
    for(const layer of ['component','smart'])await page.addScriptTag({url:`${base}/${layer}/file-upload/js/file-upload.js`});
    await page.evaluate(({size,theme,dir})=>{
      document.documentElement.className=`theme-${theme}`;document.documentElement.dir=dir;
      document.querySelector('main').innerHTML=`<section id="ordinary"><div class="sf-file-upload sf-file-upload--size-${size}">Выбрать</div><div class="sf-file-upload-files grid gap-2"></div></section><section id="smart"><sf-file-upload size="${size}"></sf-file-upload></section>`;
    },{size,theme,dir});
    await page.waitForFunction(()=>document.querySelectorAll('.sf-file-upload-input').length===2);
    await page.evaluate(()=>{const items=['Повторить','Повторить '+ 'Сообщение'.repeat(14)].map(errorMessage=>({name:'example.txt',state:'error',fileSize:'100 KB',errorMessage}));SF.FileUpload.setItems(document.querySelector('#ordinary .sf-file-upload'),items);document.querySelector('sf-file-upload').items=items;});
    await page.waitForFunction(()=>document.querySelectorAll('[data-action=retry]').length===4);
    await page.evaluate(async()=>{document.body.getBoundingClientRect();await document.fonts.ready;});
    const measure=()=>page.evaluate(async()=>{
      const fontStyle=getComputedStyle(document.activeElement);
      await document.fonts.load(`${fontStyle.fontWeight} ${fontStyle.fontSize} ${fontStyle.fontFamily}`,document.activeElement.textContent);
      await new Promise(r=>requestAnimationFrame(r));
      const b=document.activeElement,s=getComputedStyle(b),r=b.getBoundingClientRect(),label=b.closest('.sf-upload-progress-content')?.querySelector('.sf-upload-progress-text').getBoundingClientRect();
      const outline=s.outlineStyle!=='none'?Math.max(0,parseFloat(s.outlineWidth)+parseFloat(s.outlineOffset)):0;
      const inset=s.boxShadow.includes('inset'),ring=inset||s.outlineStyle!=='none';
      const probe=document.createElement('span');probe.style.cssText='position:absolute;inline-size:var(--sf-focus-outline-width);block-size:0';document.body.append(probe);
      const expected=probe.getBoundingClientRect().width;probe.remove();
      const range=document.createRange();range.selectNodeContents(b);const glyphs=[...range.getClientRects()].filter(x=>x.width>0&&x.height>0);
      return{visible:b.matches(':focus-visible'),ring,inset,outlineStyle:s.outlineStyle,outlineOffset:parseFloat(s.outlineOffset),outlineWidth:parseFloat(s.outlineWidth),clear:!!label&&r.top-outline>=label.bottom&&outline===0,padding:[s.paddingTop,s.paddingInlineStart],radius:s.borderTopLeftRadius,width:r.width,height:r.height,glyphClear:glyphs.every(t=>t.left>=r.left+expected-1&&t.right<=r.right-expected+1&&t.top>=r.top+expected-1&&t.bottom<=r.bottom-expected+1),overflow:document.documentElement.scrollWidth>innerWidth};
    });
    const states=[];
    const blurBox=button=>button.evaluate(async b=>{
      b.blur();const s=getComputedStyle(b);
      await document.fonts.load(`${s.fontWeight} ${s.fontSize} ${s.fontFamily}`,b.textContent);
      await new Promise(r=>requestAnimationFrame(r));const r=b.getBoundingClientRect();return{width:r.width,height:r.height};
    });
    for(const font of ['100%','150%']){
      await page.evaluate(async font=>{document.documentElement.style.fontSize=font;document.body.getBoundingClientRect();await document.fonts.ready;},font);
      await page.keyboard.press('Tab');
      for(let i=0;i<4;i++){
        const button=page.locator('[data-action=retry]').nth(i),rest=await blurBox(button);await button.focus();
        const normal=await measure();await page.emulateMedia({forcedColors:'active'});
        const forcedRest=await blurBox(button);await button.focus();const forced=await measure();await page.emulateMedia({forcedColors:'none'});
        states.push({font,i,rest,normal,forcedRest,forced});
      }
    }
    results.push({width,theme,dir,size,states});
    // Check focus geometry within each system mode. Chromium also switches
    // font-variant-emoji in forced colors; cross-mode text metrics are not a
    // reliable proxy for layout changes caused by our focus indicator.
    if(states.some(({rest:r,normal:n,forcedRest:fr,forced:f})=>!n.visible||!n.ring||!n.clear||!n.glyphClear||n.overflow||parseFloat(n.padding[0])<=0||parseFloat(n.padding[1])<=0||!f.visible||f.outlineStyle==='none'||f.outlineWidth<=0||!f.clear||!f.glyphClear||f.overflow||Math.abs(r.width-n.width)>1||Math.abs(r.height-n.height)>1||Math.abs(fr.width-f.width)>1||Math.abs(fr.height-f.height)>1))failures.push(results.at(-1));
    if(width===390&&dir==='ltr'&&size==='1'){
      await page.evaluate(async()=>{await document.fonts.load('24px "Material Symbols Outlined"');document.querySelectorAll('.sf-icon').forEach(e=>e.classList.add('sf-icon-loaded'));});
      await page.locator('[data-action=retry]').first().focus();await page.screenshot({path:`output/playwright/file-upload-retry-${theme}.png`,fullPage:true});
    }
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
