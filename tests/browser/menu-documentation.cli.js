async page => {
  const results=[];
  const errors=[];
  const externalRequests=[];
  const check=(name,pass,detail='')=>results.push({name,pass:Boolean(pass),detail});

  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',event=>{if(event.type()==='error')errors.push(event.text());});
  page.on('request',request=>{
    const url=request.url();
    if(/^https?:/.test(url)&&!url.startsWith('http://127.0.0.1:8878/')) externalRequests.push(url);
  });

  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:8878/ru/components/menu/');
  await page.waitForTimeout(1000);

  const frames=page.locator('[data-docara-example-frame]');
  check('documentation exposes six live examples',await frames.count()===6,String(await frames.count()));
  let framesFit=true;
  for(let index=0;index<await frames.count();index+=1){
    const frameHeight=await frames.nth(index).evaluate(frame=>frame.clientHeight);
    const geometry=await page.frameLocator('[data-docara-example-frame]').nth(index).locator('html').evaluate(root=>({height:root.scrollHeight,width:root.scrollWidth,clientWidth:root.clientWidth}));
    framesFit=framesFit&&frameHeight>=geometry.height-1&&geometry.width<=geometry.clientWidth;
  }
  check('all example frames settle to their natural height',framesFit);

  const disclosure=page.frameLocator('[data-docara-example-frame]').nth(1);
  const disclosureControl=disclosure.locator('.sf-menu-item').first().locator(':scope > .sf-menu-element');
  await disclosureControl.click();
  check('disclosure example opens its nested list',await disclosure.locator('.sf-menu-item').first().evaluate(item=>item.classList.contains('open')));
  await page.waitForTimeout(500);

  const split=page.frameLocator('[data-docara-example-frame]').nth(2);
  const splitButton=split.locator('button.sf-icon-button');
  await splitButton.click();
  await page.waitForTimeout(100);
  check('link and separate toggle example works',await split.locator('#catalog-sections').evaluate(menu=>getComputedStyle(menu).display!=='none'));

  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({colorScheme:'dark'});
  await page.waitForTimeout(500);
  check('examples remain bounded on mobile',await page.evaluate(()=>
    document.documentElement.scrollWidth<=document.documentElement.clientWidth
    && [...document.querySelectorAll('[data-docara-example-frame]')].every(frame=>{
      const root=frame.contentDocument?.documentElement;
      return !root||root.scrollWidth<=root.clientWidth;
    })
  ));

  check('documentation has no external requests',externalRequests.length===0,externalRequests.join('\n'));
  const unexpectedErrors=errors.filter(message=>
    !message.includes('has been blocked by CORS policy')
    && message!=='Failed to load resource: net::ERR_FAILED'
  );
  check('documentation has no unexpected runtime errors',unexpectedErrors.length===0,unexpectedErrors.join('\n'));
  return {results,failures:results.filter(item=>!item.pass),errors:unexpectedErrors,previewFontWarnings:errors.length-unexpectedErrors.length,externalRequests};
}
