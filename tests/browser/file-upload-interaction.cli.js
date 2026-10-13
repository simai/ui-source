async page => {
  await page.route('**/*',r=>r.continue());
  const base='http://127.0.0.1:8765/ui-source/source/output/action-focus-browser',results=[],failures=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const mode of ['markup','nested','smart'])for(const theme of ['light','dark'])for(const dir of ['ltr','rtl']){
    await page.setViewportSize({width:390,height:900});await page.emulateMedia({forcedColors:'none',reducedMotion:'reduce'});
    await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/action-focus-lab.html');
    await page.addStyleTag({url:`${base}/component/file-upload/css/file-upload.css`});
    for(const layer of ['component','smart'])await page.addScriptTag({url:`${base}/${layer}/file-upload/js/file-upload.js`});
    await page.evaluate(({mode,theme,dir})=>{
      document.documentElement.className=`theme-${theme}`;document.documentElement.dir=dir;
      const files='<div class="sf-file-upload-files"></div>',zone='<div class="sf-file-upload sf-file-upload--size-1 flex flex-col" aria-label="Приложения"><span>Выбрать файл</span>';
      document.querySelector('main').innerHTML='<button id="start">Начало</button>'+(mode==='smart'?'<sf-file-upload id="host" aria-label="Приложения"></sf-file-upload>':zone+(mode==='nested'?files:'')+'</div>'+(mode==='markup'?files:''))+'<button id="end">Конец</button>';
    },{mode,theme,dir});
    await page.waitForFunction(()=>document.querySelector('.sf-file-upload-input'));
    await page.evaluate(mode=>{const root=document.querySelector('.sf-file-upload');window.pickers=0;root.querySelector('input').click=()=>pickers++;const items=[{name:'example.txt',state:'error',errorMessage:'Повторить'},{name:'second.txt',state:'process'}];if(mode==='smart')document.querySelector('#host').items=items;else SF.FileUpload.setItems(root,items);},mode);
    await page.waitForFunction(()=>document.querySelectorAll('[data-action=remove]').length===2);
    await page.locator('.sf-file-upload').click({position:{x:5,y:5}});
    const pointer=await page.locator('.sf-file-upload').evaluate(r=>({shadow:getComputedStyle(r).boxShadow,visible:r.matches(':focus-visible'),width:r.getBoundingClientRect().width}));
    await page.locator('#start').focus();await page.keyboard.press('Tab');
    const keyboard=await page.locator('.sf-file-upload').evaluate(r=>({focused:document.activeElement===r,shadow:getComputedStyle(r).boxShadow,visible:r.matches(':focus-visible'),width:r.getBoundingClientRect().width,names:[...document.querySelectorAll('[data-action=remove]')].map(b=>b.getAttribute('aria-label')),aria:r.getAttribute('aria-disabled')}));
    await page.keyboard.press('Enter');await page.keyboard.press('Space');
    const activations=await page.evaluate(()=>pickers);
    await page.locator('[data-action=remove]').first().focus();await page.keyboard.press('Tab');
    const retryFocus=await page.locator('[data-action=retry]').evaluate(b=>({focused:document.activeElement===b,style:getComputedStyle(b).outlineStyle,width:parseFloat(getComputedStyle(b).outlineWidth),ring:getComputedStyle(b).boxShadow.includes('inset')||getComputedStyle(b).outlineStyle!=='none'}));
    await page.locator('#start').focus();await page.keyboard.press('Tab');
    if(theme==='light'&&dir==='ltr')await page.screenshot({path:`output/playwright/file-upload-keyboard-${mode}.png`,fullPage:true});
    await page.emulateMedia({forcedColors:'active'});
    const forced=await page.locator('.sf-file-upload').evaluate(r=>({style:getComputedStyle(r).outlineStyle,width:parseFloat(getComputedStyle(r).outlineWidth)}));
    await page.emulateMedia({forcedColors:'none'});
    await page.evaluate(mode=>{(mode==='smart'?document.querySelector('#host'):document.querySelector('.sf-file-upload')).setAttribute('disabled','');},mode);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const disabled=await page.locator('.sf-file-upload').evaluate(root=>{
      const before=root.__sfFileUploadItems.length;document.querySelector('[data-action=remove]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
      root.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      return{tab:root.tabIndex,aria:root.getAttribute('aria-disabled'),input:root.querySelector('input').disabled,buttons:[...document.querySelectorAll('[data-action]')].every(b=>b.disabled),unchanged:root.__sfFileUploadItems.length===before,pickers};
    });
    await page.evaluate(mode=>(mode==='smart'?document.querySelector('#host'):document.querySelector('.sf-file-upload')).removeAttribute('disabled'),mode);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const enabled=await page.locator('.sf-file-upload').evaluate(r=>({tab:r.tabIndex,input:!r.querySelector('input').disabled,buttons:[...document.querySelectorAll('[data-action]')].every(b=>!b.disabled)}));
    await page.locator('[data-action=remove]').first().focus();await page.keyboard.press('Enter');
    const final=await page.evaluate(()=>({pickers,count:document.querySelector('.sf-file-upload').__sfFileUploadItems.length}));
    const authored=await page.locator('.sf-file-upload').evaluate(async root=>{
      const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const button=document.querySelector('[data-action=remove]');
      button.closest('.sf-upload-progress').querySelector('.sf-upload-progress-name').textContent='renamed.txt';await settle();
      const renamed=button.getAttribute('aria-label')?.includes('renamed.txt');
      button.setAttribute('aria-label','Очистить вложение');button.disabled=true;root.tabIndex=-1;
      root.classList.add('disabled');await settle();root.classList.remove('disabled');await settle();
      root.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',repeat:true,bubbles:true}));
      let mutations=0;const observer=new MutationObserver(m=>mutations+=m.length);observer.observe(root,{attributes:true,childList:true,subtree:true});await settle();observer.disconnect();
      return{renamed,label:button.getAttribute('aria-label'),disabled:button.disabled,tab:root.tabIndex,idleMutations:mutations,pickers};
    });
    const row={mode,theme,dir,pointer,keyboard,activations,retryFocus,forced,disabled,enabled,final,authored};results.push(row);
    if(pointer.visible||pointer.shadow!=='none'||!keyboard.focused||!keyboard.visible||keyboard.shadow==='none'||Math.abs(pointer.width-keyboard.width)>1||keyboard.names.some((n,i)=>!n?.includes(i?'second.txt':'example.txt'))||activations!==3||!retryFocus.focused||!retryFocus.ring||forced.style==='none'||forced.width<=0||disabled.tab!==-1||disabled.aria!=='true'||!disabled.input||!disabled.buttons||!disabled.unchanged||disabled.pickers!==3||enabled.tab!==0||!enabled.input||!enabled.buttons||final.pickers!==3||final.count!==1||!authored.renamed||authored.label!=='Очистить вложение'||!authored.disabled||authored.tab!==-1||authored.idleMutations||authored.pickers!==3)failures.push(row);
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
