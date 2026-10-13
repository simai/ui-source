// Run with playwright-cli run-code. Paste events exercise the real handler;
// typing/focus/blur use browser interactions, not OS clipboard integration.
async (page) => {
  await page.emulateMedia({forcedColors: 'none'});
  await page.goto('http://127.0.0.1:8765/ui-source/tests/fixtures/quantity-state-lab.html');
  let checks=0;
  const eq=(actual,expected,name)=>{if(actual!==expected)throw new Error(`${name}: ${actual} != ${expected}`);checks++;};
  const input=page.locator('#grouped input');
  const state=()=>input.evaluate(e=>({value:e.value,raw:e.dataset.rawValue}));
  const results=[];
  for(const locale of ['en-US','de-DE','fr-FR','ru-RU','en-IN','ar-EG','fa-IR','en-US-u-nu-mathbold']) {
    await input.evaluate((e,locale)=>{e.dataset.locale=locale;e.dataset.precision='2';e.dataset.allowNegative='true';e.min='';e.max='';},locale);
    for(const value of [1234567.5,-1234567.5]) {
      const formatted=new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
      await input.fill(formatted); await input.blur();
      const current=await state();
      eq(current.raw,String(value),`${locale} signed magnitude`);
      eq(current.value,formatted,`${locale} display roundtrip`);
      results.push({locale,...current});
    }
  }
  await input.evaluate(e=>{e.dataset.locale='en-US';e.dataset.precision='3';e.dataset.inputMode='strict';});
  await input.fill('1234.5'); await input.blur();
  await input.focus(); await input.press('End'); await input.press('1');
  eq((await state()).raw,'1234.5','strict edit retains rounded magnitude');
  eq((await state()).value,'1234.5001','strict key is not blocked by displayed grouping');
  await input.fill('1.2'); await input.press('End');
  const paste=async text=>input.evaluate((e,text)=>{
    const data=new DataTransfer();data.setData('text/plain',text);
    e.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  },text);
  await paste('.3');eq((await state()).value,'1.2','strict paste rejects second decimal in whole result');
  await input.press('ControlOrMeta+A'); await paste('letters123');
  eq((await state()).value,'1.2','strict paste rejects nonnumeric characters');
  await input.evaluate(e=>{e.dataset.locale='de-DE';});
  await input.press('ControlOrMeta+A');await paste('1,234');await input.blur();
  eq((await state()).raw,'1.234','German decimal not reinterpreted as a group on change');
  eq((await state()).value,'1,234','German decimal display');
  await input.press('ControlOrMeta+A');await paste('1.234,500');await input.blur();
  eq((await state()).raw,'1234.5','German grouped paste');
  await input.evaluate(e=>{e.dataset.precision='999';e.dataset.locale='invalid_locale';});
  await input.fill('123');await input.blur();
  eq(Number.isFinite(Number((await state()).raw)),true,'invalid locale/precision retains finite value');
  return {status:'passed',checks,results};
}
