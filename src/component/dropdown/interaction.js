let sequence = 0;

// Option checkboxes are selection indicators, not independent form controls.
// Use Checkbox's silent public state adapter when it is available; late-loaded
// Checkbox initializes from the already synchronized native checked property.
export function syncDropdownCheckbox(item, selected) {
  const checkbox = item.querySelector('.sf-checkbox input[type="checkbox"]');
  if (!checkbox) return;
  const icon = item.querySelector('.sf-checkbox-box sf-icon, .sf-checkbox-box .sf-icon');
  const glyph = icon?.tagName?.toLowerCase() === 'sf-icon' ? icon.getAttribute('icon') || '' : icon?.textContent;
  const needsSync = checkbox.checked !== selected || checkbox.indeterminate ||
    (icon && glyph !== (selected ? 'check' : ''));
  if (!needsSync) return;
  checkbox.checked = selected;
  checkbox.indeterminate = false;
  globalThis.SF?.Checkbox?.setState?.(checkbox, { checked: selected, indeterminate: false });
}

function identify(node, prefix) {
  if (!node.id) {
    let id;
    do { id = `${prefix}-${++sequence}`; } while (document.getElementById(id));
    node.id = id;
  }
  return node.id;
}

// Shared keyboard/name adapter; selection and rendering remain with each owner.
export function createDropdownInteraction(root, adapter) {
  let popup = null, pending = null, frame = null, released = false;
  const assigned = new WeakMap();
  const own = (node, name, value) => {
    const previous = assigned.get(node) || {};
    if (previous[name] !== undefined && node.getAttribute(name) === previous[name]) node.removeAttribute(name);
    delete previous[name];
    if (!node.hasAttribute(name) && value) {
      node.setAttribute(name, value);previous[name] = value;
    }
    assigned.set(node, previous);
  };
  // The dropdown's own field, or the trigger the consumer handed in: the
  // keyboard, the focus and the aria state belong to whichever one is there.
  const field = () => root.querySelector('.sf-dropdown-field, .sf-dropdown-trigger');
  const trigger = () => field()?.querySelector(':scope > button') || field();
  const input = () => field()?.querySelector('input:not([type="hidden"])');
  const search = () => adapter.getList()?.querySelector('.sf-input input');
  const items = () => [...(adapter.getList()?.querySelectorAll('.sf-list-item') || [])];
  const available = () => items().filter(e=>!e.hidden&&!e.classList.contains('disabled')&&e.getAttribute('aria-disabled')!=='true'&&e.getAttribute('aria-hidden')!=='true');
  const contains = node => node && (root.contains(node)||adapter.getList()?.contains(node));
  const text = item => item.querySelector('.sf-list-item-container, .sf-avatar-label-group-title, .sf-tag-container')?.textContent?.trim() || item.dataset.value || '';
  const focus = node => { if(node&&!node.disabled){node.focus({preventScroll:true});node.scrollIntoView({block:'nearest',inline:'nearest'});} };
  const resolvePending = () => {
    if (!pending) return;
    if (pending === 'trigger') { pending=null;focus(trigger());return; }
    if (!adapter.isOpen() || adapter.getList()?.hidden) return;
    const options=available();
    const target=pending==='search'?(search()||options[0]||trigger()):pending==='last'?options.at(-1):
      typeof pending==='object'?options.find(e=>e.dataset.value===pending.value):options[0];
    pending=null;focus(target);
  };
  const beforeClose = () => { if(adapter.getList()?.contains(document.activeElement))pending='trigger'; };
  const close = () => { pending='trigger';focus(trigger());adapter.close();refresh(); };
  const open = target => { pending=target;adapter.open();refresh(); };
  const onKeydown = event => {
    if (adapter.isDisabled() || event.altKey || event.ctrlKey || event.metaKey) return;
    const target=event.target,option=target.closest?.('.sf-list-item'),inPopup=adapter.getList()?.contains(target);
    const isTrigger=target===trigger()||target===input()||target===field();
    let handled=false;
    if(event.key==='Escape'&&adapter.isOpen()){close();handled=true;}
    else if(event.key==='Tab'&&adapter.isOpen()){
      // Start native Tab traversal at the trigger even when the popup is portaled.
      if(inPopup)focus(trigger());adapter.close();refresh();return;
    } else if(isTrigger&&['ArrowDown','ArrowUp','Enter',' '].includes(event.key)){
      if(adapter.isOpen()&&['Enter',' '].includes(event.key))close();
      else open(event.key==='ArrowUp'?'last':'search');
      handled=true;
    } else if(inPopup&&['ArrowDown','ArrowUp'].includes(event.key)){
      const options=available(),index=options.indexOf(option);
      const next=index<0?(event.key==='ArrowUp'?options.length-1:0):Math.max(0,Math.min(options.length-1,index+(event.key==='ArrowUp'?-1:1)));
      focus(options[next]);handled=true;
    } else if(option&&inPopup&&['Home','End'].includes(event.key)){
      const options=available();focus(event.key==='Home'?options[0]:options.at(-1));handled=true;
    } else if(option&&inPopup&&['Enter',' '].includes(event.key)){
      if(available().includes(option)){
        pending=adapter.isMultiple()?{value:option.dataset.value}:'trigger';
        adapter.select(option);refresh();
      }
      handled=true;
    }
    if(handled){event.preventDefault();event.stopImmediatePropagation();}
  };
  const onFocusout = () => {
    if(frame!==null)cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      frame=null;
      if(!released&&adapter.isOpen()&&!pending&&!contains(document.activeElement)){adapter.close();refresh();}
    });
  };
  let summary = document.createElement('span');
  summary.className='sf-dropdown-value';root.append(summary);identify(summary,'sf-dropdown-value');
  const refresh = () => {
    if(released)return;
    const next=adapter.getList();
    if(popup!==next){
      popup?.removeEventListener('keydown',onKeydown,true);popup?.removeEventListener('focusout',onFocusout);
      popup=next;popup?.addEventListener('keydown',onKeydown,true);popup?.addEventListener('focusout',onFocusout);
    }
    const button=trigger(),container=popup?.querySelector('.sf-list-container');
    if(!button||!container)return;
    if(!summary.isConnected)root.append(summary);
    const label=root.querySelector('.sf-dropdown-label .sf-dropdown-text');
    const owner=adapter.owner||root;
    const labelId=label?.textContent.trim()?identify(label,'sf-dropdown-label'):'';
    const ownerLabel=owner.getAttribute('aria-label')||root.getAttribute('aria-label');
    const ownerRefs=owner.getAttribute('aria-labelledby')||root.getAttribute('aria-labelledby');
    const buttonId=identify(button,'sf-dropdown-trigger');
    const authorButtonLabel=button.hasAttribute('aria-label')&&assigned.get(button)?.['aria-label']!==button.getAttribute('aria-label');
    own(button,'aria-labelledby',ownerRefs||(!ownerLabel&&labelId?(authorButtonLabel?`${buttonId} ${labelId}`:labelId):''));
    own(button,'aria-label',ownerLabel);
    if(button.tagName!=='BUTTON')button.setAttribute('role','button');
    button.tabIndex=adapter.isDisabled()?-1:0;
    button.setAttribute('aria-expanded',String(adapter.isOpen()));
    button.setAttribute('aria-haspopup','listbox');
    button.setAttribute('aria-controls',identify(container,'sf-dropdown-listbox'));
    button.querySelectorAll('.sf-icon').forEach(icon=>icon.setAttribute('aria-hidden','true'));
    if(field()!==button)field().tabIndex=-1;
    if(input())input().tabIndex=-1;
    container.setAttribute('role','listbox');
    container.setAttribute('aria-multiselectable',String(adapter.isMultiple()));
    own(container,'aria-labelledby',ownerRefs||labelId||buttonId);
    const query=search();
    if(query){
      query.setAttribute('role','searchbox');query.setAttribute('aria-controls',container.id);
      own(query,'aria-labelledby',query.hasAttribute('aria-label')?'':ownerRefs||labelId||buttonId);
    }
    items().forEach(item=>{
      item.setAttribute('role','option');item.tabIndex=-1;
      item.setAttribute('aria-selected',String(item.classList.contains('selected')));
      own(item,'aria-disabled',item.classList.contains('disabled')?'true':'');
      syncDropdownCheckbox(item,item.classList.contains('selected'));
      item.querySelectorAll('.sf-checkbox').forEach(indicator=>{
        if(indicator.getAttribute('aria-hidden')!=='true')indicator.setAttribute('aria-hidden','true');
      });
      item.querySelectorAll('.sf-icon, sf-icon').forEach(icon=>{
        if(icon.getAttribute('aria-hidden')!=='true')icon.setAttribute('aria-hidden','true');
      });
      item.querySelectorAll('input, button, a[href], [tabindex]').forEach(child=>{child.tabIndex=-1;});
    });
    const labels=adapter.selectedLabels?.()||items().filter(e=>e.classList.contains('selected')).map(text);
    summary.textContent=labels.join(', ')||input()?.value||input()?.placeholder||'';
    const refs=new Set((button.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));refs.add(summary.id);
    button.setAttribute('aria-describedby',[...refs].join(' '));
    resolvePending();
  };
  root.addEventListener('keydown',onKeydown,true);root.addEventListener('focusout',onFocusout);
  refresh();
  return {refresh,beforeClose,release(){
    released=true;if(frame!==null)cancelAnimationFrame(frame);
    root.removeEventListener('keydown',onKeydown,true);root.removeEventListener('focusout',onFocusout);
    popup?.removeEventListener('keydown',onKeydown,true);popup?.removeEventListener('focusout',onFocusout);
    const button=trigger();
    if(button){const refs=(button.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==summary.id);if(refs.length)button.setAttribute('aria-describedby',refs.join(' '));else button.removeAttribute('aria-describedby');}
    summary.remove();
  }};
}
