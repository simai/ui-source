async page => {
  const results=[];
  const errors=[];
  const externalRequests=[];
  const check=(name,pass,detail='')=>results.push({name,pass:Boolean(pass),detail});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',event=>{if(event.type()==='error')errors.push(event.text());});
  page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:8766/'))externalRequests.push(request.url());});
  await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
  await page.setViewportSize({width:1280,height:900});
  await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/outline-method-lab.html');

  check('native navigation keeps an accessible name and lists',await page.locator('#outline').evaluate(root=>root.tagName==='NAV'&&root.getAttribute('aria-label')&&root.querySelectorAll('ul').length===2));
  check('body typography is inherited through Framework roles',await page.locator('#overview-link').evaluate(link=>{
    const linkStyle=getComputedStyle(link);
    const bodyStyle=getComputedStyle(document.body);
    return linkStyle.fontSize===bodyStyle.fontSize&&linkStyle.lineHeight===bodyStyle.lineHeight;
  }));
  check('current state has a semantic indicator and stable text start',await page.evaluate(()=>{
    const first=document.querySelector('#overview-link');
    const second=document.querySelector('#usage-link');
    const before=[first.getBoundingClientRect().x,second.getBoundingClientRect().x];
    first.removeAttribute('aria-current');
    second.setAttribute('aria-current','location');
    const after=[first.getBoundingClientRect().x,second.getBoundingClientRect().x];
    const style=getComputedStyle(second);
    return Math.abs(before[0]-after[0])<0.5&&Math.abs(before[1]-after[1])<0.5&&style.borderInlineStartColor!==style.backgroundColor;
  }));
  check('nested hierarchy has logical indentation',await page.evaluate(()=>document.querySelector('#nested-link').getBoundingClientRect().x>document.querySelector('#usage-link').getBoundingClientRect().x));
  await page.locator('#overview-link').hover();
  check('hover gives the complete row a surface response',await page.locator('#overview-link').evaluate(link=>getComputedStyle(link).backgroundColor!=='rgba(0, 0, 0, 0)'));

  await page.mouse.click(1100,800);
  await page.locator('#overview-link').click();
  check('pointer focus does not show the keyboard ring',await page.locator('#overview-link').evaluate(link=>!link.matches(':focus-visible')&&getComputedStyle(link).boxShadow==='none'));
  await page.mouse.click(1100,800);
  await page.keyboard.press('Tab');
  check('keyboard focus is visible and inset',await page.locator('#overview-link').evaluate(link=>link.matches(':focus-visible')&&getComputedStyle(link).boxShadow.includes('inset')));

  await page.emulateMedia({forcedColors:'active'});
  check('forced colors keeps a visible inset focus outline',await page.locator('#overview-link').evaluate(link=>{
    const style=getComputedStyle(link);
    return matchMedia('(forced-colors: active)').matches&&style.outlineStyle==='solid'&&parseFloat(style.outlineOffset)<0;
  }));
  await page.emulateMedia({forcedColors:'none'});

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.documentElement.dir='rtl');
  check('long labels remain bounded on mobile',await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth&&document.querySelector('#usage-link').scrollWidth<=document.querySelector('#outline').clientWidth));
  check('nesting follows inline start in RTL',await page.evaluate(()=>document.querySelector('#nested-link').getBoundingClientRect().right<document.querySelector('#usage-link').getBoundingClientRect().right));
  await page.evaluate(()=>document.documentElement.className='theme-dark');
  check('semantic states survive dark theme',await page.locator('#usage-link').evaluate(link=>{
    const style=getComputedStyle(link);
    return style.color!==style.backgroundColor&&style.borderInlineStartWidth!=='0px';
  }));
  check('no external requests',externalRequests.length===0,externalRequests.join('\n'));
  check('no runtime errors',errors.length===0,errors.join('\n'));
  return {results,failures:results.filter(item=>!item.pass),errors,externalRequests};
}
