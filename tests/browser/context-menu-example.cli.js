async page => {
  const base='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser',draft='http://127.0.0.1:8766/ui-source/source/output/action-focus-browser/examples/context-menu-positions/index.html';
  const errors=[],results=[],failures=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  for(const width of [390,1280])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/modal-loader-lab.html');await page.addStyleTag({url:`${base}/component/context-menu/css/context-menu.css`});
    await page.evaluate(async({draft,theme})=>{document.documentElement.className=`theme-${theme}`;document.querySelector('main').innerHTML=await(await fetch(draft)).text();},{draft,theme});
    const row=await page.evaluate(()=>{const roots=Array.from(document.querySelectorAll('.sf-context-menu'));const token=(()=>{const n=document.createElement('i');n.style.cssText='position:absolute;width:var(--sf-radius--surface)';document.body.append(n);const v=`${n.getBoundingClientRect().width}px`;n.remove();return v;})();return{count:roots.length,overflow:document.documentElement.scrollWidth>innerWidth,items:roots.map(root=>{const content=root.querySelector('.sf-context-menu-content'),tail=root.querySelector('.sf-context-menu-tooltip');return{radius:getComputedStyle(content).borderStartStartRadius,token,tail:!!tail&&parseFloat(getComputedStyle(tail).width)>0,paint:tail&&getComputedStyle(tail).backgroundColor};})};});results.push({width,theme,...row});if(row.count!==12||row.overflow||row.items.some(x=>x.radius!==x.token||!x.tail||x.paint==='rgba(0, 0, 0, 0)'))failures.push(results.at(-1));
    if(width===390)await page.screenshot({path:`output/playwright/context-menu-example-${theme}.png`,fullPage:true});
  }
  return{status:failures.length||errors.length?'failed':'passed',cases:results.length,failures,errors,results};
}
