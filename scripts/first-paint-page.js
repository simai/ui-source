// The page side of the first-paint snapshot (scripts/snapshot-first-paint.mjs;
// standard simai.smart-component 1.3.8 §5.4). Loaded into the snapshot page as
// a classic script before core.js, it defines two globals:
//
//   __sfFirstPaintBuild(spec)  puts the example's host on the stage and marks
//                              what the page gave it (its children, at every
//                              depth), before any code upgrades it;
//   __sfFirstPaintSerialize({skeleton})
//                              the host as a server prints it: its attributes,
//                              the JSON island, the rendered markup marked
//                              data-sf-static, and the page's own children;
//                              with `skeleton`, every text a bar and every
//                              image a fill.
//
// No dependency: it runs in the browser as is.
(() => {
  const PAGE = 'data-sf-snap-page';
  const RUNTIME = new Set([
    PAGE, 'data-sf-started', 'data-sf-style-ready', 'data-sf-style-pending', 'data-sf-instance',
    'data-sf-loaded', 'data-sf-upgraded', 'data-sf-ready', 'data-sf-held',
  ]);
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const RAW = new Set(['script', 'style']);
  const XHTML = 'http://www.w3.org/1999/xhtml';
  const pageText = new WeakSet();
  const originals = new Map();
  let host = null;
  let hosts = [];
  let spec = null;

  const escText = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\u00a0/g, '&nbsp;');
  const escAttr = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/\u00a0/g, '&nbsp;');
  const isCustom = (el) => el.localName.includes('-');

  function build(input) {
    spec = input;
    const stage = document.getElementById('stage');
    // An example's markup either holds the element or is the page around it
    // (the text a copy button copies): then the element comes after it.
    const holds = spec.markup && new RegExp(`<${spec.tag}[\\s>]`, 'u').test(spec.markup);
    if (holds) {
      stage.innerHTML = spec.markup;
    } else {
      let container = stage;
      if (spec.markup) stage.innerHTML = spec.markup;
      if (spec.parent) {
        stage.insertAdjacentHTML('beforeend', spec.parent);
        container = stage.lastElementChild;
      }
      const el = document.createElement(spec.tag);
      for (const [name, value] of spec.attributes) el.setAttribute(name, value);
      if (Object.keys(spec.island).length) {
        const island = document.createElement('script');
        island.type = 'application/json';
        island.setAttribute('data-sf-settings', '');
        island.textContent = JSON.stringify(spec.island);
        el.append(island);
      }
      if (spec.children) {
        const template = document.createElement('template');
        template.innerHTML = spec.children;
        el.append(template.content);
      }
      for (const [slot, markup] of spec.slots) {
        const template = document.createElement('template');
        template.innerHTML = markup;
        for (const child of template.content.children) child.setAttribute('slot', slot);
        el.append(template.content);
      }
      container.append(el);
    }
    host = stage.querySelector(spec.tag);
    if (!host) throw new Error(`no <${spec.tag}> in the example`);
    // Everything the page gave the host, at every depth: page content, never
    // static markup. The original markup of each element that holds page
    // content is kept, so a child the element takes away is printed again.
    // A JSON island is not page content: the element reads it and takes it
    // out, and the printed host carries it once, as its island (§5.4).
    const island = (node) => node.nodeType === 1 && node.matches('script[data-sf-settings]');
    const mark = (el) => {
      originals.set(el, [...el.childNodes].filter((node) => !island(node))
        .map((node) => ({node, html: node.nodeType === 1 ? node.outerHTML : node.nodeType === 3 ? escText(node.data) : ''})));
      for (const node of el.childNodes) {
        if (node.nodeType === 3) pageText.add(node);
        if (node.nodeType !== 1 || island(node)) continue;
        node.setAttribute(PAGE, '');
        mark(node);
      }
    };
    // An example's markup may hold several (a group of radios): each is printed.
    hosts = [...stage.querySelectorAll(spec.tag)].filter((one) => !one.parentElement.closest(spec.tag));
    hosts.forEach(mark);
    window.__sfFirstPaintHost = host;
    window.__sfFirstPaintHosts = hosts;
    return true;
  }

  // What the icon runtime writes once the icon font has arrived: on one run
  // it has, on the next not yet. The live element sets it again; a snapshot
  // never holds it, so it is the same on every run.
  const ICON_LOADED = 'sf-icon-loaded';
  function attributes(el, extra = []) {
    const out = [];
    for (const {name, value} of el.attributes) {
      if (RUNTIME.has(name)) continue;
      if (name === 'loaded' && el.localName === 'sf-icon') continue;
      if (name === 'class' && value.split(/\s+/u).includes(ICON_LOADED)) {
        const kept = value.split(/\s+/u).filter((one) => one && one !== ICON_LOADED).join(' ');
        if (kept) out.push([name, kept]);
        continue;
      }
      out.push([name, value]);
    }
    for (const one of extra) if (!out.some(([name]) => name === one[0])) out.push(one);
    return out.map(([name, value]) => (value === '' ? ` ${name}` : ` ${name}="${escAttr(value)}"`)).join('');
  }
  const open = (el, extra) => `<${el.localName}${attributes(el, extra)}>`;
  const close = (el) => (VOID.has(el.localName) ? '' : `</${el.localName}>`);
  // A foreign subtree (svg, math) as the browser writes it, the markers out.
  const foreign = (el) => {
    const copy = el.cloneNode(true);
    for (const one of [copy, ...copy.querySelectorAll('*')]) for (const name of RUNTIME) one.removeAttribute?.(name);
    return copy.outerHTML;
  };

  // The list and object settings a Smart element holds (no attribute can):
  // a JSON island, so the printed element starts with them (§5.4).
  const islandOf = (el) => {
    const settings = el.constructor?.manifest?.settings;
    const data = el.__sfManifestData;
    if (!settings || !data) return null;
    const out = {};
    for (const [name, value] of Object.entries(data)) {
      if (settings[name] && ['list', 'object'].includes(settings[name].type) && value !== undefined) out[name] = value;
    }
    return Object.keys(out).length ? out : null;
  };
  const islandMarkup = (data) => (data && Object.keys(data).length
    ? `<script type="application/json" data-sf-settings>${JSON.stringify(data).replace(/</g, '\\u003c')}</script>` : '');

  // A text that shows data: not an icon's ligature, not inside a control's value.
  const isIconText = (node) => {
    const el = node.parentElement;
    if (!el) return false;
    if (el.closest('.sf-icon, [class*="material-symbols"], [class*="material-icons"], .sf-ico, i')) return true;
    const family = getComputedStyle(el).fontFamily.toLowerCase();
    return family.includes('symbol') || family.includes('icon');
  };

  // A run of white space between tags is one space wherever white space
  // collapses: the template's indentation is not kept.
  const collapses = (node) => !/^pre|^break-spaces/u.test(getComputedStyle(node.parentElement ?? document.body).whiteSpace);
  function text(node, mode) {
    let data = node.data;
    if (!data.trim() && collapses(node)) data = data.includes('\n') ? '\n' : (data ? ' ' : '');
    if (mode.skeleton && data.trim() && !isIconText(node)) {
      return `<span class="sf-first-paint-bar" aria-hidden="true">${escText(data)}</span>`;
    }
    return escText(data);
  }

  // The rendered markup: everything as it is, the page's markers out; the
  // top node marked data-sf-static. A Smart element drawn inside it gets its
  // own drawn children marked too, so if its code arrives first it replaces
  // them rather than drawing beside them.
  function picture(el, top, mode) {
    if (el.namespaceURI !== XHTML) return foreign(el);
    const extra = top ? [['data-sf-static', '']] : [];
    if (mode.skeleton && top) extra.push(['aria-hidden', 'true']);
    let inner = '';
    if (el.localName === 'template') inner = el.innerHTML;
    else if (RAW.has(el.localName)) inner = el.textContent;
    else if (mode.skeleton && el.localName === 'textarea') inner = '';
    else {
      const nested = isCustom(el);
      if (nested && !mode.skeleton) inner += islandMarkup(islandOf(el));
      for (const node of el.childNodes) {
        if (node.nodeType === 3) inner += text(node, mode);
        else if (node.nodeType === 1) inner += picture(node, nested && !isCustom(node) && !node.hasAttribute('slot'), mode);
      }
    }
    let head = open(el, extra);
    if (mode.skeleton) head = skeletonize(el, head);
    return `${head}${inner}${close(el)}`;
  }

  // Values cleared, images a fill of the same box: the skeleton of §5.4.
  function skeletonize(el, head) {
    const tag = el.localName;
    if (tag === 'input' || tag === 'option') {
      head = head.replace(/ value="[^"]*"/u, ' value=""').replace(/ checked(?=[ >])/u, '');
    }
    if (tag === 'img' || tag === 'video' || tag === 'canvas' || tag === 'picture') {
      const width = Math.round(el.naturalWidth || el.videoWidth || el.width || el.getBoundingClientRect().width) || 1;
      const height = Math.round(el.naturalHeight || el.videoHeight || el.height || el.getBoundingClientRect().height) || 1;
      const blank = `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22${width}%22 height=%22${height}%22/%3E`;
      head = head.replace(/ (src|poster)="[^"]*"/gu, '').replace(/ srcset="[^"]*"/u, '');
      head = head.replace(/^<(\w+)/u, `<$1 src="${blank}"`);
      head = /class="/u.test(head) ? head.replace(/class="/u, 'class="sf-first-paint-fill ') : head.replace(/^<(\w+)/u, '<$1 class="sf-first-paint-fill"');
    }
    return head;
  }

  // An element that holds page content (the host, or a Smart element the page
  // put inside it): its drawn children are static markup, its page children
  // stay page children, and a page child it took into its markup is printed
  // again after, held out of view while static markup is beside it.
  function holder(el, mode, island = undefined) {
    let inner = islandMarkup(island === undefined && isCustom(el) ? islandOf(el) : island);
    const custom = isCustom(el);
    for (const node of el.childNodes) {
      if (node.nodeType === 8) continue;
      if (node.nodeType === 3) {
        if (pageText.has(node)) inner += escText(node.data);
        else if (node.data.trim()) {
          inner += `<span data-sf-static>${text(node, mode)}</span>`;
        } else {
          // White space the template put between its nodes: it takes part in
          // the line as the drawn element's does (a space more or less moved
          // an inline button by a pixel). It cannot be marked; left after the
          // element draws, it collapses with the element's own.
          inner += text(node, mode);
        }
        continue;
      }
      if (node.nodeType !== 1) continue;
      if (node.matches('script[data-sf-settings]')) continue;
      if (node.hasAttribute(PAGE)) inner += holder(node, mode);
      else if (custom) inner += picture(node, true, mode);
      else inner += picture(node, false, mode);
    }
    // Page children the element took away (into its markup, a template, a
    // layer elsewhere): printed as the page gave them.
    for (const {node, html} of originals.get(el) ?? []) {
      if (node.parentNode === el || !html) continue;
      if (node.nodeType === 3) {
        if (node.data.trim()) inner += html;
        continue;
      }
      // A Smart element the page gave and the element placed in its markup
      // is printed with its own first paint, so it shows it there until it
      // draws -- unless the page gave it text, which would show twice.
      const texts = [...node.childNodes].some((one) => one.nodeType === 3 && one.data.trim() && pageText.has(one));
      if (isCustom(node) && node.isConnected && node.isRendered === true && !texts) {
        inner += holder(node, mode).replace(/^<([\w-]+)/u, '<$1 data-sf-held');
        continue;
      }
      inner += html.replace(/^<([\w-]+)/u, '<$1 data-sf-held');
    }
    const extra = [];
    if (hosts.includes(el) && mode.skeleton) extra.push(['data-sf-first-paint', 'skeleton'], ['aria-busy', 'true']);
    return `${open(el, extra)}${inner}${close(el)}`.replaceAll(` ${PAGE}`, '');
  }

  // Ids the code made up are named after the example, so the snapshot is the
  // same on every run; every reference to one follows.
  function stableIds(markup, prefix) {
    const ids = [...markup.matchAll(/ id="([^"]+)"/gu)].map((match) => match[1]);
    const generated = ids.filter((id) => /\d{3,}|[a-z0-9]{6,}-[a-z0-9]{3,}|^sf-[\w-]*-\w*\d/iu.test(id) || /(^|-)[a-z0-9]{8,}$/iu.test(id) && /\d/u.test(id));
    let n = 0;
    let out = markup;
    for (const id of [...new Set(generated)]) {
      const next = `${prefix}-${++n}`;
      const quoted = id.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      out = out.replace(new RegExp(`(?<=[ ="#])${quoted}(?=["\\s])`, 'gu'), next);
    }
    return out;
  }

  function serialize({skeleton = false, prefix = 'sf-first-paint'} = {}) {
    if (!host) throw new Error('nothing built');
    const island = {...(spec.island ?? {})};
    for (const name of skeleton ? spec.late ?? [] : []) delete island[name];
    return stableIds(hosts.map((one) => holder(one, {skeleton}, one === host ? island : undefined)).join('\n'), prefix);
  }

  // ---------- an assembly (§7.3) ----------

  // A part whose late settings (presentation.skeleton.late) have not arrived
  // is printed as its skeleton: the build fills its skeleton.html from the
  // part's settings (a placeholder here, filled in Node).
  const lateMissing = (el) => {
    const late = el.constructor?.manifest?.presentation?.skeleton?.late ?? [];
    const camel = (name) => name.replace(/-([a-z0-9])/gu, (_, letter) => letter.toUpperCase());
    const store = el.__sfManifestData ?? {};
    return late.filter((name) => {
      if (el.hasAttribute(name)) return false;
      // Given, even an empty list: data (the empty state), as the element
      // reads it (element-manifest.js sfAwaitingData).
      if (Object.prototype.hasOwnProperty.call(store, name) && store[name] !== undefined && store[name] !== null) return false;
      const value = el[camel(name)];
      return value === undefined || value === null || (Array.isArray(value) && !value.length);
    });
  };
  const skeletonParts = [];

  function composed(el, top) {
    if (el.namespaceURI !== XHTML) return foreign(el);
    if (el.hasAttribute('data-sf-role') && isCustom(el)) {
      const missing = lateMissing(el);
      if (missing.length) {
        const role = el.getAttribute('data-sf-role');
        skeletonParts.push({role, tag: el.localName, late: missing,
          attributes: [...el.attributes].filter(({name}) => !RUNTIME.has(name)).map(({name, value}) => [name, value]),
          island: islandOf(el) ?? {}});
        return `<!--sf-first-paint-skeleton ${role}-->`;
      }
      return holder(el, {skeleton: false});
    }
    let inner = '';
    for (const node of el.childNodes) {
      if (node.nodeType === 3) inner += text(node, {skeleton: false});
      else if (node.nodeType === 1) inner += composed(node, false);
    }
    return `${open(el, top ? [['data-sf-static', '']] : [])}${inner}${close(el)}`;
  }

  // The assembly's host as a server prints it: its attributes, and its live
  // layout as one static node, each part's host in its place.
  function serializeAssembly({prefix = 'sf-first-paint'} = {}) {
    if (!host) throw new Error('nothing built');
    skeletonParts.length = 0;
    const layout = host.querySelector(':scope > [data-sf-layout]');
    if (!layout) throw new Error(`${host.localName} has no layout box`);
    const html = `${open(host)}${composed(layout, true)}${close(host)}`.replaceAll(` ${PAGE}`, '');
    return {html: stableIds(html, prefix), skeletons: skeletonParts.slice()};
  }

  window.__sfFirstPaintBuild = build;
  window.__sfFirstPaintSerialize = serialize;
  window.__sfFirstPaintSerializeAssembly = serializeAssembly;
})();
