async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',failures=[],errors=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const theme of ['light','dark'])for(const dir of ['ltr','rtl'])for(const forced of [false,true]){
    await page.setViewportSize({width,height:700});await page.emulateMedia({forcedColors:forced?'active':'none'});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['menu','icon-buttons','icons'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    await page.addScriptTag({url:`${base}/component/menu/js/menu.js`});
    const row=await page.evaluate(async({theme,dir})=>{
      document.documentElement.className=`theme-${theme}`;document.documentElement.dir=dir;
      const main=document.querySelector('main');main.innerHTML=`<ul class="sf-menu flex flex-col" aria-label="Разделы"><li id="leaf" class="sf-menu-item">Обзор</li><li id="link" class="sf-menu-item"><a class="sf-menu-element" href="#target">Ссылка</a></li><li id="branch" class="sf-menu-item">Проект<ul class="sf-menu flex flex-col"><li class="sf-menu-item">Документы</li></ul></li><li id="legacy" class="sf-menu-item"><div class="sf-menu-element"><span class="sf-menu-element-text">Серверная ветка</span><button type="button" class="sf-icon-button" aria-label="Переключить серверную ветку"><span class="sf-icon">expand_more</span></button></div><ul class="sf-menu"><li class="sf-menu-item">Пункт</li></ul></li><li id="disabled" class="sf-menu-item" disabled>Архив<ul class="sf-menu"><li class="sf-menu-item">2024</li></ul></li></ul>`;
      const suppliedButton=document.querySelector('#legacy button'), suppliedLabel=suppliedButton.getAttribute('aria-label');let suppliedClicks=0;suppliedButton.addEventListener('click',()=>suppliedClicks++);
      const action=document.createElement('li');action.className='sf-menu-item';action.innerHTML='<button id="native-action" type="button" class="sf-menu-element">Действие</button>';main.querySelector('ul').append(action);const nativeAction=action.firstElementChild;nativeAction.dataset.clicks='0';nativeAction.addEventListener('click',()=>nativeAction.dataset.clicks=String(Number(nativeAction.dataset.clicks)+1));
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      await document.fonts.load('24px "Material Symbols Outlined"');document.querySelectorAll('.sf-icon').forEach(e=>e.classList.add('sf-icon-loaded'));
      const leaf=document.querySelector('#leaf'),branch=document.querySelector('#branch'),disabled=document.querySelector('#disabled');
      const element=branch.querySelector(':scope > .sf-menu-element'),tail=element.querySelector('.sf-icon-button'),icon=tail?.querySelector('.sf-icon');
      const focusables=e=>[...e.querySelectorAll('button,a[href],[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled);
      element.focus();const focused=document.activeElement===element,css=getComputedStyle(element),keyboardPaint=css.boxShadow!=='none'||css.outlineStyle!=='none';
      const before=element.getBoundingClientRect();element.click();await new Promise(r=>requestAnimationFrame(r));const open=branch.classList.contains('open'),down=icon?.textContent;
      element.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await new Promise(r=>requestAnimationFrame(r));const closed=!branch.classList.contains('open'),right=icon?.textContent,after=element.getBoundingClientRect(),mirrored=(dir==='rtl')===(getComputedStyle(icon).transform!=='none');
      element.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));await new Promise(r=>requestAnimationFrame(r));const spaceOpen=branch.classList.contains('open');element.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      const dynamic=document.createElement('ul');dynamic.className='sf-menu';dynamic.innerHTML='<li class="sf-menu-item">Поздний пункт</li>';leaf.append(dynamic);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const dynamicOwner=leaf.querySelector(':scope > .sf-menu-element'),dynamicAdded=dynamicOwner?.getAttribute('role')==='button'&&dynamicOwner?.tabIndex===0&&dynamicOwner?.querySelector(':scope > .sf-icon-button')?.tagName==='SPAN';
      dynamic.remove();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const dynamicRemoved=!dynamicOwner?.hasAttribute('role')&&!dynamicOwner?.hasAttribute('tabindex')&&!dynamicOwner?.querySelector(':scope > .sf-icon-button');
      leaf.append(dynamic);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));dynamicOwner.setAttribute('role','link');dynamicOwner.setAttribute('tabindex','7');dynamic.remove();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const authorOverride=dynamicOwner.getAttribute('role')==='link'&&dynamicOwner.getAttribute('tabindex')==='7';dynamicOwner.removeAttribute('role');dynamicOwner.removeAttribute('tabindex');
      element.blur();
      suppliedButton.click();
      return{leafRole:leaf.querySelector(':scope > .sf-menu-element')?.getAttribute('role'),leafStops:focusables(leaf).length,
        branchStops:[element,...element.querySelectorAll(':scope > .sf-icon-button')].filter(x=>x.matches('button,a[href],[tabindex]:not([tabindex="-1"])')&&!x.disabled).length,
        ownerRole:element.getAttribute('role'),tailTag:tail?.tagName,tailHidden:tail?.getAttribute('aria-hidden'),
        linkPreserved:document.querySelector('#link > a[href="#target"]')?.getAttribute('role')===null,
        legacyTail:document.querySelector('#legacy > .sf-menu-element > .sf-icon-button')?.tagName,
        legacyRowPassive:!document.querySelector('#legacy > .sf-menu-element').hasAttribute('role')&&!document.querySelector('#legacy > .sf-menu-element').hasAttribute('tabindex'),
        legacyPreserved:document.querySelector('#legacy button')===suppliedButton&&suppliedClicks===1&&suppliedButton.getAttribute('aria-label')===suppliedLabel&&suppliedButton.getAttribute('aria-expanded')==='true',
        dynamicAdded,dynamicRemoved,authorOverride,
        focused,keyboardPaint,
        open,closed,spaceOpen,down,right,mirrored,disabledStops:focusables(disabled).length,
        geometry:Math.abs(before.width-after.width)<.5&&Math.abs(before.height-after.height)<.5,
        expanded:element.getAttribute('aria-expanded'),pageFits:document.documentElement.scrollWidth<=innerWidth};
    },{theme,dir});
    row.branchName=await page.getByRole('button',{name:'Проект',exact:true}).count()===1;
    await page.locator('#branch > .sf-menu-element').click();
    row.pointerPaint=await page.locator('#branch > .sf-menu-element').evaluate(e=>{const c=getComputedStyle(e);return c.boxShadow!=='none'||c.outlineStyle!=='none';});
    await page.locator('#native-action').focus();await page.keyboard.press('Enter');await page.keyboard.press('Space');row.nativeAction=await page.locator('#native-action').getAttribute('data-clicks')==='2';
    const ok=row.leafRole===null&&row.leafStops===0&&row.branchStops===1&&row.ownerRole==='button'&&row.tailTag==='SPAN'&&row.tailHidden==='true'&&row.branchName&&row.linkPreserved&&row.nativeAction&&row.legacyTail==='BUTTON'&&row.legacyRowPassive&&row.legacyPreserved&&row.dynamicAdded&&row.dynamicRemoved&&row.authorOverride&&row.focused&&row.keyboardPaint&&!row.pointerPaint&&row.open&&row.closed&&row.spaceOpen&&row.down==='keyboard_arrow_down'&&row.right==='chevron_right'&&row.mirrored&&row.disabledStops===0&&row.geometry&&row.expanded==='false'&&row.pageFits;
    if(!ok)failures.push({width,theme,dir,forced,...row});results.push({width,theme,dir,forced,ok,...row});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
