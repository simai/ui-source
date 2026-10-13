// One placement/lifecycle contract for native and body-projected panels.
import BundledPosition from '../../core/js/position.js';

// Prefer the helper Core published; a bundle loaded without core.js (for
// example an isolated documentation frame) still positions with its own copy.
const position = () => globalThis.SF?.Position || BundledPosition;
const portals = new WeakMap();
const properties = ['position', 'inset', 'margin', 'width', 'max-width', 'max-height', 'overflow', 'left', 'top', 'right', 'bottom','z-index'];
const inherited = [
  'font-family','font-size','font-weight','font-style','font-stretch','font-variant',
  'font-feature-settings','font-variation-settings','font-optical-sizing','font-kerning',
  'line-height','letter-spacing','word-spacing','text-transform','text-indent',
  'white-space','word-break','overflow-wrap','text-rendering',
  'direction','writing-mode','text-orientation','color','color-scheme','text-align',
];

function syncFallbackContext(root,state) {
  if (!state.context) return;
  const context=state.context,computed=getComputedStyle(root);
  const classes=['sf-dropdown',...Array.from(root.classList).filter(name=>name.startsWith('sf-dropdown--')&&!['sf-dropdown--open','sf-dropdown--drop-up','sf-dropdown--drop-down'].includes(name))].join(' ');
  if(context.className!==classes)context.className=classes;
  const names=[...Array.from(computed).filter(name=>name.startsWith('--sf-')),...inherited];
  const keys=new Set(names);
  for(const name of state.contextProperties||[])if(!keys.has(name))context.style.removeProperty(name);
  for(const name of names){
    const value=computed.getPropertyValue(name);
    if(context.style.getPropertyValue(name)!==value)context.style.setProperty(name,value);
  }
  state.contextProperties=names;
}

// What the list hangs from. Usually the dropdown's own field; where the
// consumer handed a trigger in, that trigger. Looking only for the field, the
// portal never opened for such a dropdown at all -- the list stayed in the page
// where it was rendered, with no placement of its own and clipped by whatever
// box it sat in.
export function triggerOf(root) {
  return root?.querySelector('.sf-dropdown-field, .sf-dropdown-trigger') ?? null;
}

export function positionDropdownPortal(root, list) {
  const state = portals.get(list);
  if (!state || !root.isConnected || list.hidden) return false;
  const field = triggerOf(root);
  if (!field) return false;
  if(root.closest('[hidden], [inert], [aria-hidden="true"], dialog:not([open])') ||
    !field.getClientRects().length || ['hidden','collapse'].includes(getComputedStyle(field).visibility)){
    state.onUnavailable?.();
    return false;
  }
  syncFallbackContext(root,state);
  if (state.wrap) {
    state.wrap.style.minHeight = '0';
    state.wrap.style.overflowY = 'auto';
  }
  // Geometry is the shared Framework contract (SF.Position on Floating UI):
  // below the field by default, flipped above when the panel does not fit and
  // there is more room, shifted inside the viewport and height-limited by it.
  if (!state.anchor) {
    state.anchor = position().anchor(field, list, {
      side: 'block-end',
      align: 'start',
      // A list matches the width of a field, because a field is as wide as the
      // list it opens. A trigger of the consumer's own is not: an icon button
      // would make the list the width of a glyph.
      matchWidth: field.classList.contains('sf-dropdown-field'),
      fitHeight: true,
      autoUpdate: false,
      onPosition: ({side}) => {
        const up = side === 'block-start';
        list.dataset.placement = root.dataset.placement = up ? 'top' : 'bottom';
        root.classList.toggle('sf-dropdown--drop-up', up);
        root.classList.toggle('sf-dropdown--drop-down', !up);
      },
    });
  }
  state.anchor.update();
  return true;
}

export function openDropdownPortal(root, list, onUnavailable) {
  if (!list?.isConnected || !triggerOf(root)) return false;
  const active=list.contains(document.activeElement)?document.activeElement:null;
  if (!portals.has(list)) {
    const saved = properties.map(name => [name, list.style.getPropertyValue(name), list.style.getPropertyPriority(name)]);
    const state = {root, saved, onUnavailable, popover:list.getAttribute('popover'), frame:0,native:typeof list.showPopover==='function'};
    state.wrap = list.querySelector('.sf-list-container-wrap');
    state.wrapStyles = state.wrap ? ['min-height','overflow-y'].map(name => [name,state.wrap.style.getPropertyValue(name),state.wrap.style.getPropertyPriority(name)]) : [];
    state.schedule = () => {
      if (!state.frame) state.frame = requestAnimationFrame(() => {state.frame=0;positionDropdownPortal(root,list);});
    };
    portals.set(list,state);
    root.__sfDropdownPortalList=list;
    if(state.native)list.setAttribute('popover','manual');
    else {
      state.parent=list.parentNode;state.next=list.nextSibling;
      state.context=document.createElement('div');
      state.context.style.cssText='display:contents;position:static';
      syncFallbackContext(root,state);
      // A body projection is inert outside a native modal dialog and sits
      // behind Framework modal stacks. Keep it in the closest modal boundary,
      // but outside the modal's clipped content panel.
      const boundary=root.closest('dialog[open], [role="dialog"][aria-modal="true"]');
      (boundary||document.body).append(state.context);state.context.append(list);
      list.style.zIndex='var(--sf-z-index-9)';
    }
    state.inheritance=new MutationObserver(state.schedule);
    for(let node=root;node;node=node.parentElement)state.inheritance.observe(node,{attributes:true,attributeFilter:['class','style','dir','hidden','inert','aria-hidden','open']});
    Object.assign(list.style,{position:'fixed',inset:'auto',margin:'0',overflow:state.wrap?'hidden':'auto'});
    if (typeof ResizeObserver === 'function') {
      state.resize = new ResizeObserver(state.schedule);
      state.resize.observe(triggerOf(root));
      state.resize.observe(list);
    }
    window.visualViewport?.addEventListener('resize',state.schedule);
    window.visualViewport?.addEventListener('scroll',state.schedule);
  }
  list.hidden = false;
  if (portals.get(list).native && !list.matches(':popover-open')) list.showPopover();
  if(!positionDropdownPortal(root,list))return false;
  if(active&&document.activeElement!==active)active.focus({preventScroll:true});
  return true;
}

export function closeDropdownPortal(list) {
  const state = portals.get(list);
  if (!state) return false;
  const active=list.contains(document.activeElement)?document.activeElement:null;
  state.anchor?.stop();
  state.resize?.disconnect();cancelAnimationFrame(state.frame);
  state.inheritance?.disconnect();
  window.visualViewport?.removeEventListener('resize',state.schedule);
  window.visualViewport?.removeEventListener('scroll',state.schedule);
  if(state.native){
    if (list.matches(':popover-open')) list.hidePopover();
    if (state.popover === null) list.removeAttribute('popover');else list.setAttribute('popover',state.popover);
  }else{
    if(state.next?.parentNode===state.parent)state.parent.insertBefore(list,state.next);else state.parent.append(list);
    state.context.remove();
  }
  for (const [name,value,priority] of state.saved) {
    if(value)list.style.setProperty(name,value,priority);else list.style.removeProperty(name);
  }
  for (const [name,value,priority] of state.wrapStyles) {
    if(value)state.wrap.style.setProperty(name,value,priority);else state.wrap.style.removeProperty(name);
  }
  delete list.dataset.placement;delete state.root.dataset.placement;
  state.root.classList.remove('sf-dropdown--drop-up','sf-dropdown--drop-down');
  if(state.root.__sfDropdownPortalList===list)delete state.root.__sfDropdownPortalList;
  portals.delete(list);
  // A mode change leaves the list open. Closing/disabled/disconnect paths do
  // not restore focus into a hidden or detached panel.
  if(active&&!list.hidden&&state.root.isConnected&&document.activeElement!==active)active.focus({preventScroll:true});
  return true;
}
