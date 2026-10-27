async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser';
  const errors=[],results=[],failures=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  const positions=['left','left-top','left-bottom','right','right-top','right-bottom','top','top-left','top-right','bottom','bottom-left','bottom-right'];
  for(const theme of ['light','dark'])for(const dir of ['ltr','rtl']){
    await page.setViewportSize({width:1280,height:900});await page.emulateMedia({reducedMotion:'reduce',forcedColors:'none'});
    await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');
    for(const name of ['buttons','context-menu','admin-menu','icons','icon-buttons','inputs','badges'])await page.addStyleTag({url:`${base}/component/${name}/css/${name}.css`});
    for(const name of ['buttons','context-menu','icons','icon-buttons','input','badges','admin-menu'])await page.addScriptTag({url:`${base}/smart/${name}/js/${name}.js`});
    await page.evaluate(({theme,dir,positions})=>{document.documentElement.className=`theme-${theme}`;document.documentElement.dir=dir;const main=document.querySelector('main');main.innerHTML=`<div id="matrix" style="display:grid;grid-template-columns:repeat(4,auto);gap:64px;padding:64px"></div>`;for(const position of positions){const menu=document.createElement('sf-context-menu');menu.setAttribute('position',position);menu.setAttribute('aria-label',position);menu.innerHTML='<button class="sf-button sf-button--link sf-button--on-surface"><span class="sf-button-text-container">Действие</span></button>';main.querySelector('#matrix').append(menu);}}, {theme,dir,positions});
    await page.waitForFunction(n=>document.querySelectorAll('sf-context-menu .sf-context-menu').length===n,positions.length);
    const matrix=await page.evaluate(()=>Array.from(document.querySelectorAll('#matrix > sf-context-menu')).map(host=>{const root=host.querySelector(':scope > .sf-context-menu'),content=root?.querySelector('.sf-context-menu-content'),tailRendered=!!root?.querySelector('.sf-context-menu-tooltip'),position=host.position;if(!root||!content)return{position,rootMissing:!root,contentMissing:!content,tailRendered};return{position,tailRendered,rootOverflow:getComputedStyle(root).overflow,contentRadius:getComputedStyle(content).borderStartStartRadius,rootRadius:getComputedStyle(root).borderStartStartRadius};}));
    await page.evaluate(async base=>{const main=document.querySelector('main');main.innerHTML=await(await fetch(`${base}/examples/admin-context-menu/index.html`)).text();},base);
    await page.getByRole('button',{name:'Настройки меню',exact:true}).click();await page.locator('sf-icon-button[id$="_settings"] button').first().click();await page.waitForFunction(()=>document.querySelector('sf-context-menu')?.contains(document.activeElement));
    await page.setViewportSize({width:320,height:480});
    await page.evaluate(()=>{const content=document.querySelector('sf-context-menu .sf-context-menu-content');for(let i=0;i<30;i++){const button=document.createElement('button');button.className='sf-button sf-button--link sf-button--on-surface';button.innerHTML=`<span class="sf-button-text-container">Действие ${i}</span>`;content.append(button);}});await page.waitForTimeout(150);
    const admin=await page.evaluate(()=>{const root=document.querySelector('sf-context-menu .sf-context-menu'),content=root.querySelector('.sf-context-menu-content'),r=root.getBoundingClientRect();return{tailHidden:[...root.querySelectorAll('.sf-context-menu-tooltip')].every(t=>t.getClientRects().length===0),rootOverflow:getComputedStyle(root).overflow,contentOverflow:getComputedStyle(content).overflowY,contentScrollable:content.scrollHeight>content.clientHeight,rootBounded:r.top>=0&&r.bottom<=innerHeight,rootRadius:getComputedStyle(root).borderStartStartRadius,contentRadius:getComputedStyle(content).borderStartStartRadius};});
    const tokenRadius=await page.evaluate(()=>{const n=document.createElement('i');n.style.cssText='position:absolute;width:var(--sf-radius--surface);height:0';document.body.append(n);const v=n.getBoundingClientRect().width;n.remove();return`${v}px`;});
    const row={theme,dir,tokenRadius,matrix,admin};results.push(row);
    // No tail since 2026-10-12: the Smart element renders none and legacy markup has no boxes.
    if(matrix.some(x=>x.rootMissing||x.contentMissing||x.tailRendered||x.contentRadius!==tokenRadius||x.rootRadius!==tokenRadius)||admin.rootOverflow!=='visible'||admin.contentOverflow!=='auto'||!admin.contentScrollable||!admin.rootBounded||!admin.tailHidden||admin.contentRadius!==tokenRadius||admin.rootRadius!==tokenRadius)failures.push(row);
    if(dir==='ltr')await page.screenshot({path:`output/playwright/context-menu-surface-${theme}.png`,fullPage:true});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
