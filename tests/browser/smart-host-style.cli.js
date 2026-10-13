async(page)=>{
  const failures=[],results=[],errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  const cases=[['dropdown-state-lab.html','#smart','.sf-dropdown'],['field-controls-lab.html','sf-input','.sf-input'],['field-controls-lab.html','sf-textarea','.sf-textarea'],['range-slider-state-lab.html','#smart-auto','.sf-range-slider']];
  for(const [fixture,selector,rootSelector] of cases){
    await page.goto(`http://127.0.0.1:8765/ui-source/tests/fixtures/${fixture}`);
    await page.waitForFunction(({selector,rootSelector})=>document.querySelector(selector)?.querySelector(rootSelector),{selector,rootSelector});
    const outcome=await page.locator(selector).evaluate(async(host,rootSelector)=>{
      const failures=[],records=[];
      const wait=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const values=()=>{const e=document.createElement('div');e.style.cssText=host.getRootStyle();return e.style;};
      const check=(ok,name,actual)=>{records.push(name);if(!ok)failures.push({name,actual});};
      host.removeAttribute('root-style');host.removeAttribute('style');await wait();
      const reference=host.style;
      host.style.setProperty('--sf-test-first','var(--sf-space-1)');
      check(values().getPropertyValue('--sf-test-first')==='var(--sf-space-1)','synchronous root-style read sees CSSOM update',host.getRootStyle());
      host.style.setProperty('--sf-test-second','var(--sf-space-2)','important');await wait();
      check(values().getPropertyValue('--sf-test-first')==='var(--sf-space-1)'&&values().getPropertyValue('--sf-test-second')==='var(--sf-space-2)','same-turn updates accumulate',host.getRootStyle());
      host.style.marginInlineStart='8px';await wait();
      host.style.setProperty('--sf-test-third','var(--sf-space-3)');await wait();
      check(values().marginInlineStart==='8px'&&values().getPropertyValue('--sf-test-first')==='var(--sf-space-1)','later update preserves declarations',host.getRootStyle());
      check(host.style.getPropertyPriority('--sf-test-second')==='important','CSSOM reads priority',host.style.cssText);
      const removed=host.style.removeProperty('--sf-test-second');await wait();
      check(removed==='var(--sf-space-2)'&&!values().getPropertyValue('--sf-test-second')&&!!values().getPropertyValue('--sf-test-first'),'remove only requested declaration',{removed,style:host.getRootStyle()});
      host.style.cssText='--sf-test-first: var(--sf-space-4);font-size:1.25em;line-height:1.5';await wait();
      check(!values().getPropertyValue('--sf-test-third')&&!values().marginInlineStart,'cssText replaces whole style',host.getRootStyle());
      const root=host.querySelector(rootSelector),hostSize=parseFloat(getComputedStyle(host).fontSize),rootSize=parseFloat(getComputedStyle(root).fontSize);
      check(Math.abs(rootSize/hostSize-1.25)<0.02,'relative font size applied once',{hostSize,rootSize});
      host.setAttribute('root-style','--sf-test-first:var(--sf-space-2)');await wait();
      check(values().getPropertyValue('--sf-test-first')==='var(--sf-space-2)','root-style precedence',host.getRootStyle());
      host.removeAttribute('root-style');await wait();
      check(values().getPropertyValue('--sf-test-first')==='var(--sf-space-4)','root-style removal restores author style',host.getRootStyle());
      host.setAttribute('style','--sf-test-replaced:var(--sf-space-1)');await wait();
      check(!values().getPropertyValue('--sf-test-first')&&host.style.getPropertyValue('--sf-test-replaced')==='var(--sf-space-1)','attribute replacement synchronizes CSSOM',host.getRootStyle());
      check(reference===host.style,'stable CSSStyleDeclaration identity',null);
      check(reference instanceof CSSStyleDeclaration,'native CSSStyleDeclaration methods retained',null);
      host.removeAttribute('style');await wait();
      check(!values().getPropertyValue('--sf-test-replaced')&&!reference.getPropertyValue('--sf-test-replaced'),'remove attribute clears author CSSOM',host.getRootStyle());
      host.style='--sf-test-assigned:var(--sf-space-2)';await wait();
      check(values().getPropertyValue('--sf-test-assigned')==='var(--sf-space-2)','style assignment supported',host.getRootStyle());
      host.style.setProperty('--sf-test-pending','var(--sf-space-4)');
      host.setAttribute('style','--sf-test-assigned:var(--sf-space-2)');await wait();
      check(!values().getPropertyValue('--sf-test-pending'),'attribute replacement supersedes queued CSSOM edit',host.getRootStyle());
      host.style.setProperty('--sf-test-priority','var(--sf-space-3)','important');
      host.setAttribute('root-style','--sf-test-priority:var(--sf-space-1)');await wait();
      check(values().getPropertyValue('--sf-test-priority')==='var(--sf-space-3)','important priority survives root-style layering',host.getRootStyle());
      host.removeAttribute('root-style');
      const parent=host.parentNode,next=host.nextSibling;host.remove();
      host.style.setProperty('--sf-test-detached','var(--sf-space-3)');
      parent.insertBefore(host,next);await wait();
      check(values().getPropertyValue('--sf-test-assigned')==='var(--sf-space-2)'&&values().getPropertyValue('--sf-test-detached')==='var(--sf-space-3)','detached CSSOM update survives reconnect',host.getRootStyle());
      check(getComputedStyle(host).display==='contents','host remains boxless',getComputedStyle(host).display);
      check(!host._updateLoopBlocked,'no update loop',host._updateLoopCount);
      return {failures,checks:records.length};
    },rootSelector);
    failures.push(...outcome.failures.map(f=>({selector,...f})));results.push({selector,checks:outcome.checks});
  }
  return {status:failures.length||errors.length?'failed':'passed',results,failures,errors};
}
