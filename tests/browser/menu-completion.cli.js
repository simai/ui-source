async page => {
  const results=[];
  const errors=[];
  const externalRequests=[];
  const check=(name,pass,detail='')=>results.push({name,pass:Boolean(pass),detail});

  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',event=>{if(event.type()==='error')errors.push(event.text());});
  page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:8766/'))externalRequests.push(request.url());});
  await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
  await page.emulateMedia({forcedColors:'none',colorScheme:'light'});
  await page.setViewportSize({width:1280,height:900});
  await page.goto('http://127.0.0.1:8766/ui-source/tests/fixtures/menu-method-lab.html');
  await page.waitForTimeout(100);

  check('navigation keeps native list semantics',await page.evaluate(()=>{
    const nav=document.querySelector('nav');
    const menu=document.querySelector('#menu');
    return nav.getAttribute('aria-label')==='Разделы проекта'
      && menu.tagName==='UL'
      && !menu.hasAttribute('role')
      && [...menu.children].every(item=>item.tagName==='LI');
  }));

  check('menu and rows own complete layout without flex utilities',await page.evaluate(()=>{
    const menu=document.querySelector('#menu');
    const row=document.querySelector('#current > .sf-menu-element');
    return menu.className==='sf-menu'
      && getComputedStyle(menu).display==='flex'
      && getComputedStyle(menu).flexDirection==='column'
      && getComputedStyle(row).display==='flex'
      && row.getBoundingClientRect().width===menu.getBoundingClientRect().width;
  }));

  check('generated branch uses one native disclosure button',await page.evaluate(()=>{
    const branch=document.querySelector('#generated');
    const button=branch.querySelector(':scope > button.sf-menu-element');
    const submenu=branch.querySelector(':scope > .sf-menu');
    return button?.type==='button'
      && button.getAttribute('aria-expanded')==='false'
      && button.getAttribute('aria-controls')===submenu.id
      && submenu.hidden
      && button.querySelector(':scope > .sf-icon-button')?.getAttribute('aria-hidden')==='true'
      && branch.querySelectorAll(':scope > button, :scope > [tabindex="0"]').length===1;
  }));

  const generated=page.locator('#generated > .sf-menu-element');
  await generated.click();
  check('pointer opens branch and uses right-down indicator semantics',await page.evaluate(()=>{
    const branch=document.querySelector('#generated');
    return branch.classList.contains('open')
      && !branch.hasAttribute('expanded')
      && !branch.querySelector(':scope > .sf-menu').hidden
      && branch.querySelector(':scope > .sf-menu-element .sf-icon').textContent==='keyboard_arrow_down';
  }));
  check('pointer focus has no keyboard ring',await generated.evaluate(element=>!element.matches(':focus-visible')&&getComputedStyle(element).boxShadow==='none'));

  await page.evaluate(()=>document.activeElement?.blur());
  await page.locator('#current a').focus();
  await page.keyboard.press('Tab');
  check('tab reaches disclosure in native order with a visible ring',await generated.evaluate(element=>document.activeElement===element&&element.matches(':focus-visible')&&getComputedStyle(element).boxShadow!=='none'));
  await page.keyboard.press('Space');
  check('Space closes the focused disclosure',await generated.getAttribute('aria-expanded')==='false'&&await page.locator('#generated > .sf-menu').evaluate(menu=>menu.hidden));

  const beforeCombined=await page.locator('#combined > .sf-menu').evaluate(menu=>menu.hidden);
  await page.locator('#combined a[href="#catalog"]').click();
  check('a branch destination remains a link and does not toggle',beforeCombined&&await page.locator('#combined > .sf-menu').evaluate(menu=>menu.hidden)&&await page.evaluate(()=>location.hash==='#catalog'));
  const toggle=page.locator('#combined > .sf-menu-element > button.sf-icon-button');
  check('link and disclosure have separate controls',await page.evaluate(()=>{
    const row=document.querySelector('#combined > .sf-menu-element');
    const link=row.querySelector('a[href]');
    const button=row.querySelector('button.sf-icon-button');
    return !row.hasAttribute('role')&&!row.hasAttribute('tabindex')&&Boolean(link&&button)
      && button.getAttribute('aria-controls')===document.querySelector('#combined > .sf-menu').id;
  }));
  await toggle.click();
  check('supplied toggle alone opens its submenu',await toggle.getAttribute('aria-expanded')==='true'&&!await page.locator('#combined > .sf-menu').evaluate(menu=>menu.hidden));

  check('disabled branch uses a disabled native control',await page.evaluate(()=>{
    const button=document.querySelector('#disabled > button.sf-menu-element');
    return button?.disabled&&document.querySelector('#disabled > .sf-menu').hidden;
  }));

  check('current page remains a native link',await page.evaluate(()=>{
    const link=document.querySelector('#current a');
    return link.getAttribute('aria-current')==='page'&&link.hasAttribute('href')&&!link.hasAttribute('role');
  }));

  check('horizontal variant changes only the root level into a row',await page.evaluate(()=>{
    const menu=document.querySelector('#horizontal');
    const submenu=document.querySelector('#horizontal-products > .sf-menu');
    return getComputedStyle(menu).flexDirection==='row'
      && getComputedStyle(submenu).flexDirection==='column'
      && [...menu.children].every(item=>getComputedStyle(item).flexGrow==='0');
  }));

  const horizontalProducts=page.locator('#horizontal-products > .sf-menu-element');
  await horizontalProducts.click();
  check('horizontal branch opens a vertical flyout below its parent',await page.evaluate(()=>{
    const root=document.querySelector('#horizontal-products');
    const submenu=root.querySelector(':scope > .sf-menu');
    const rootRect=root.getBoundingClientRect();
    const submenuRect=submenu.getBoundingClientRect();
    return root.classList.contains('open')
      && !submenu.hidden
      && getComputedStyle(submenu).position==='absolute'
      && submenuRect.top>=rootRect.bottom-1
      && root.querySelector(':scope > .sf-menu-element .sf-icon').textContent==='keyboard_arrow_up';
  }));

  await page.locator('#horizontal-tools > .sf-menu-element').click();
  check('deeper horizontal submenu opens toward the logical inline side',await page.evaluate(()=>{
    const root=document.querySelector('#horizontal-tools');
    const submenu=root.querySelector(':scope > .sf-menu');
    const rootRect=root.getBoundingClientRect();
    const submenuRect=submenu.getBoundingClientRect();
    return !submenu.hidden&&submenuRect.left>=rootRect.right-1;
  }));

  await page.keyboard.press('Escape');
  check('Escape closes the active flyout and restores disclosure focus',await page.evaluate(()=>{
    const root=document.querySelector('#horizontal-tools');
    return root.querySelector(':scope > .sf-menu').hidden
      && document.activeElement===root.querySelector(':scope > .sf-menu-element');
  }));

  await page.locator('#horizontal-support > .sf-menu-element').click();
  check('opening a horizontal sibling closes the previous branch',await page.evaluate(()=>{
    return document.querySelector('#horizontal-products > .sf-menu').hidden
      && document.querySelector('#horizontal-tools > .sf-menu').hidden
      && !document.querySelector('#horizontal-support > .sf-menu').hidden;
  }));

  await page.locator('h1').click();
  check('outside click closes a horizontal branch',await page.locator('#horizontal-support > .sf-menu').evaluate(menu=>menu.hidden));

  await page.evaluate(()=>{document.documentElement.className='theme-dark';document.documentElement.dir='rtl';});
  await horizontalProducts.click();
  await page.locator('#horizontal-tools > .sf-menu-element').click();
  check('horizontal flyouts follow the logical inline side in RTL',await page.evaluate(()=>{
    const root=document.querySelector('#horizontal-tools');
    const submenu=root.querySelector(':scope > .sf-menu');
    const rootRect=root.getBoundingClientRect();
    const submenuRect=submenu.getBoundingClientRect();
    return getComputedStyle(document.querySelector('#horizontal')).direction==='rtl'
      && !submenu.hidden
      && submenuRect.right<=rootRect.left+1
      && document.documentElement.scrollWidth<=document.documentElement.clientWidth;
  }));
  await page.locator('h1').click();

  await page.setViewportSize({width:390,height:844});
  check('long labels wrap and four levels stay within mobile RTL',await page.evaluate(()=>{
    const text=document.querySelector('#long .sf-menu-element-text');
    const icon=document.querySelector('#generated > .sf-menu-element .sf-icon');
    return text.getBoundingClientRect().height>Number.parseFloat(getComputedStyle(text).lineHeight)
      && document.querySelector('.sf-menu-element--level-3')
      && getComputedStyle(icon).transform!=='none'
      && document.documentElement.scrollWidth<=document.documentElement.clientWidth;
  }));

  check('dynamic leaf upgrades to a native branch and returns to a passive row',await page.evaluate(async()=>{
    const root=document.querySelector('#dynamic');
    const submenu=document.createElement('ul');
    submenu.className='sf-menu';
    submenu.innerHTML='<li class="sf-menu-item">Поздний раздел</li>';
    root.append(submenu);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const branch=root.querySelector(':scope > button.sf-menu-element');
    const upgraded=branch&&branch.getAttribute('aria-controls')===submenu.id&&submenu.hidden;
    submenu.remove();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const passive=root.querySelector(':scope > span.sf-menu-element');
    return upgraded&&passive&&!passive.hasAttribute('role')&&!passive.hasAttribute('tabindex');
  }));

  await page.emulateMedia({forcedColors:'active'});
  const currentGenerated=page.locator('#generated > .sf-menu-element');
  await page.evaluate(()=>document.activeElement?.blur());
  await page.locator('#current a').focus();
  await page.keyboard.press('Tab');
  check('forced colors preserves keyboard focus',await currentGenerated.evaluate(element=>matchMedia('(forced-colors: active)').matches&&getComputedStyle(element).outlineStyle==='solid'));

  check('no external requests',externalRequests.length===0,externalRequests.join('\n'));
  check('no runtime errors',errors.length===0,errors.join('\n'));
  return {results,failures:results.filter(item=>!item.pass),errors,externalRequests};
}
