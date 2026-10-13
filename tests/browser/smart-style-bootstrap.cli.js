async(page)=>{
  const failures=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/dropdown-state-lab.html');
  await page.addScriptTag({url:'http://127.0.0.1:8765/ui-source/source/output/action-focus-browser/smart/breadcrumbs/js/breadcrumbs.js'});
  const result=await page.evaluate(async()=>{
    const wait=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const host=document.createElement('sf-breadcrumbs');document.querySelector('main').replaceChildren(host);await wait();
    const emptyDisplay=getComputedStyle(host).display;
    host.setAttribute('items','Главная::href=/|Проект::current');await wait();
    host.style.setProperty('--sf-test-first','var(--sf-space-1)');host.style.setProperty('--sf-test-second','var(--sf-space-2)');await wait();
    return {emptyDisplay,readyDisplay:getComputedStyle(host).display,nav:!!host.querySelector('nav'),text:host.textContent,style:host.getRootStyle(),blocked:host._updateLoopBlocked};
  });
  if(result.emptyDisplay!=='contents'||result.readyDisplay!=='contents'||!result.nav||!result.text.includes('Проект')||result.blocked)failures.push(result);
  if(!result.style.includes('--sf-test-first')||!result.style.includes('--sf-test-second'))failures.push(result);
  return {status:failures.length||errors.length?'failed':'passed',failures,errors,result};
}
