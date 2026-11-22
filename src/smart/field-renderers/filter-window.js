// A filter field's window (Framework order FO-5 of the view set study,
// ui-control control/research/2026-11-17-view-round-1/framework-orders.md):
// the field renderers' filter control of one field in sf-popover, with
// «Применить» and «Сбросить» under it, opened from any control -- a chip, a
// column's heading, a button -- with no table around it. The set's table drew
// this window itself (its chip window), and a page that wanted it without a
// table kept a hidden table only to open it.
//
//   const answer = await SF.fieldRenderers.filterWindow.open({
//     anchor,                  the control it opens from (required)
//     field,                   the Framework field descriptor with its filter
//     value,                   the filter's value now: {value?, values?, operator?}
//     size,                    accepted and not used: the window has one step of its own,
//                              FILTER_WINDOW_STEP, for every part (VR11-4, PH-7)
//     placement,               sf-popover's (bottom-start)
//   });
//   answer: {action: 'apply', value} -- the value the person set
//           {action: 'reset', value: null} -- the filter taken off
//           null -- closed without either (Escape, a press outside, the anchor again)
//
// The footer is the order of every panel (owner decision C157 (3), C159 (4)):
// the main action first at the start, «Применить», then «Сбросить». The
// window is a non-modal dialog (sf-popover's dialog surface), named by the
// field's label; it takes the focus when it opens and gives it back to the
// anchor when it closes. One window per anchor: opening it again from the
// same anchor while it is open closes it. It holds no state after it closes.
//
// Returns of the component study (ui-control control/research/2026-11-18-
// framework-parts-fo): «Применить (N)» (FO5-1); a bottom sheet on a phone
// (FO5-2); on the body like SF.menu.open, not beside the anchor (FO5-3); the
// reopen guard by the anchor's press, no timer (FO5-4). The check of a value
// row stands at the end of the row (owner decision C308 FO-5, design d03,
// C106 (2)): sf-input-choice's list rows with control-position="end".
import {html, render} from 'lit';
import {pageText} from '../../core/js/page-language';
import {followDensity} from '../../core/js/density.js';
import LANG_WORDS from './lang/index.mjs';

const SET_NAME = 'sf-field-renderers';
const SET_TEXT = LANG_WORDS;

// The anchor a window was closed from by a press on it: that press's click
// must not open it again (holdReopen).
const CLOSED_BY_ANCHOR = new WeakMap();
const OPEN = new WeakMap();
const OPERATOR_WORDS = {
  eq: 'operatorEq', gt: 'operatorGt', gte: 'operatorGte', lt: 'operatorLt', lte: 'operatorLte',
  between: 'operatorBetween', contains: 'operatorContains', startsWith: 'operatorStartsWith',
  any: 'operatorAny', today: 'operatorToday', week: 'operatorWeek', month: 'operatorMonth',
  // The conditions of a list property (owner decision C310, FF-8): любой из,
  // все из, ни один из; and of every type, не задано / задано (C310 replaces
  // C293's «Пусто» / «Не пусто»). operatorIn («В списке») stays in the packs
  // for a host that names it.
  in: 'operatorAnyOf', all: 'operatorAllOf', not_in: 'operatorNoneOf', empty: 'operatorEmpty', not_empty: 'operatorFilled',
};

// The window's condition words of a string and a number (C310): содержит,
// начинается с; от – до, равно, больше, меньше -- one lower-case line with
// любой из and не задано. The former capitalised words stay for a table's
// operator field (OPERATOR_WORDS).
const CONDITION_WORDS = {
  string: {contains: 'operatorContainsWord', startsWith: 'operatorStartsWithWord'},
  number: {between: 'operatorFromTo', eq: 'operatorEqualWord', gt: 'operatorMoreWord', gte: 'operatorMoreOrEqualWord', lt: 'operatorLessWord', lte: 'operatorLessOrEqualWord'},
};

const word = (key, node) => pageText(SET_TEXT, key, node ?? null, SET_NAME);

/** The words of an operator in the page's language; kind (string, number) picks the window's condition words. An operator nobody has a word for is shown as it is stored. */
export function filterOperatorLabel(operator, node = null, kind = '') {
  const key = CONDITION_WORDS[kind]?.[operator] ?? OPERATOR_WORDS[operator];
  return key ? word(key, node) : String(operator ?? '');
}

const clone = (value) => {
  if (!value || typeof value !== 'object') return {};
  try {
    return structuredClone(value);
  } catch {
    return {...value};
  }
};

// The phone (FO5-2): no md breakpoint token on the root, the same reading as
// sf-input-rich's link panel and the other phone sheets (under 600 px).
const onPhone = (doc) => !doc.defaultView?.getComputedStyle(doc.documentElement).getPropertyValue('--sf-breakpoint-md').trim();

// The window stands where the menu does (FO5-3, as SF.menu.open): on the body,
// or in the open modal dialog the anchor is in (a modal dialog makes the rest
// of the page inert), never inside whatever holds the anchor (a list, a table
// row, a row of buttons). It takes the anchor's density, theme and language.
function mount(surface, anchor) {
  const doc = anchor.ownerDocument;
  followDensity(surface, anchor);
  const themed = anchor.closest?.('.theme-dark, .theme-light');
  if (themed && themed !== doc.documentElement && themed !== doc.body) {
    surface.classList.add(themed.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light');
  }
  const lang = anchor.closest?.('[lang]')?.getAttribute('lang');
  if (lang) surface.setAttribute('lang', lang);
  (anchor.closest?.('dialog[open]') || doc.body).append(surface);
}

// The reopen guard (FO5-4): a press on the anchor closed its window, and the
// click that follows that press -- or an open its handler asks for later,
// after a fetch -- must not open it again. Held until the next press or key
// (the document hears them first, before the anchor's own handlers); no timer.
function holdReopen(anchor) {
  const doc = anchor.ownerDocument;
  CLOSED_BY_ANCHOR.set(anchor, true);
  const clear = () => {
    CLOSED_BY_ANCHOR.delete(anchor);
    doc.removeEventListener('pointerdown', clear, true);
    doc.removeEventListener('keydown', clear, true);
  };
  doc.addEventListener('pointerdown', clear, true);
  doc.addEventListener('keydown', clear, true);
}

// The window's one step (popup head round 3, PH-7, group build 16): set once
// here and given to every part -- the condition band, the value fields, the
// search, the rows and the footer's buttons -- in every condition state, with
// rows or without. The rows' own step, the choice list's panel step 1, which
// the opener's density brings down (C22, C79). The band and the footer took
// the list's size (size=, filterSize) while the rows kept theirs, so at 1/2
// the window had two steps, and which parts were drawn decided its look.
// The size option stays for callers; it no longer changes the window.
export const FILTER_WINDOW_STEP = '1';

export function filterWindowOpen({anchor, field = {}, value = {}, placement = 'bottom-start', width = 'panel', count, kind = '', renderControl, footer: withFooter = true} = {}) {
  if (!anchor?.isConnected || !field?.key) return Promise.resolve(null);
  const open = OPEN.get(anchor);
  if (open) {
    open.close();
    return Promise.resolve(null);
  }
  // The press on the anchor that closed its window is followed by its click.
  if (CLOSED_BY_ANCHOR.get(anchor)) return Promise.resolve(null);
  const doc = anchor.ownerDocument;
  const sheet = onPhone(doc);
  return new Promise((resolve) => {
    let temp = clone(value);
    let answer = null;
    const label = field.label || field.key;
    let frame;
    let body;
    let foot;
    if (sheet) {
      // On a phone (FO5-2, C157 (5)): the same content in a bottom sheet, the
      // field's label its title, the buttons in its pinned footer.
      frame = doc.createElement('sf-drawer');
      frame.setAttribute('placement', 'bottom');
      frame.setAttribute('heading', label);
      frame.setAttribute('data-sf-filter-window', field.key);
      body = doc.createElement('div');
      body.className = 'sf-filter-window flex flex-col';
      // The window's list scrolls inside it, under the band and the search
      // (C313): every box down to it may be shorter than its content.
      body.style.minBlockSize = '0';
      // Only the rows scroll (group build 16 return GB16-3): the window fills
      // the sheet under its head and over its foot (sf-drawer 1.21.0,
      // data-sf-drawer-fill), so the band and the search stay put, and the
      // last row's text stands from the foot's line as the first from the
      // search's (C397, PH-8).
      body.setAttribute('data-sf-drawer-fill', '');
      // The sheet's title and its footer's buttons stand on the rows' text
      // (C397, PH-9): the drawer's inset is the list's start column, the
      // panel's inset and the row's padding (12 on a phone), as the popover's
      // footer pads.
      frame.style.setProperty('--sf-drawer-gutter', 'calc(var(--sf-space-1\\/4) + var(--sf-space-1\\/2))');
      frame.append(body);
      if (withFooter) {
        foot = doc.createElement('div');
        foot.setAttribute('slot', 'footer');
        frame.append(foot);
      }
    } else {
      frame = doc.createElement('sf-popover');
      frame.setAttribute('surface-role', 'dialog');
      frame.setAttribute('placement', placement);
      frame.setAttribute('label', label);
      frame.setAttribute('data-sf-filter-window', field.key);
      const surface = doc.createElement('div');
      surface.setAttribute('slot', 'content');
      // The window's parts reach its edges (owner decision C313): the
      // condition band, the search's and the list's hairlines; each part
      // keeps its own inset, the footer the panel's.
      surface.className = 'sf-filter-window flex flex-col p-0';
      // The window's width (C157, C310): the panel's step, 20rem; 24rem for
      // people and records with a caption.
      surface.setAttribute('data-sf-filter-width', width === 'wide' ? 'wide' : 'panel');
      surface.style.inlineSize = width === 'wide' ? 'var(--sf-popup-form-wide-width)' : 'var(--sf-popup-panel-width)';
      surface.style.maxInlineSize = '100%';
      // The band at the window's top takes the window's corners, so its
      // inward focus ring is not cut by them (popup head round 2, PH-3).
      surface.style.setProperty('--sf-dropdown-band-radius', 'var(--sf-popover-radius, var(--sf-radius--surface))');
      body = doc.createElement('div');
      body.className = 'sf-filter-window-control flex flex-col';
      body.style.minBlockSize = '0';
      surface.append(body);
      if (withFooter) {
        foot = doc.createElement('div');
        foot.className = 'sf-filter-window-foot';
        // The footer stands as the start column (owner decision C397, PH-9):
        // the panel's inset and the row's padding, 16 (12 compact), the
        // rows' text and the buttons on one line.
        foot.style.padding = 'calc(var(--sf-space-1\\/4) + var(--sf-space-1\\/2))';
        // The footer's hairline across the window, as the band's and the search's.
        foot.style.borderBlockStart = 'var(--sf-px) solid var(--sf-outline-variant)';
        surface.append(foot);
      }
      frame.append(surface);
    }

    const host = {
      size: FILTER_WINDOW_STEP,
      // The single-field window (C308 FO-5): the rows' checks stand at the end.
      filterWindow: true,
      // In a phone's sheet the band reaches the sheet's edges (C313 (1)).
      sheet,
      getFieldText: (key) => word(key, anchor),
      getFilterControlValue: () => temp,
      patchTempFilterValue: (key, patch) => {
        temp = {...temp, ...patch};
        draw();
      },
      getFilterOperatorLabel: (operator) => filterOperatorLabel(operator, anchor, kind),
      getVisibleFilterOptions: (one) => (Array.isArray(one?.filter?.options) ? one.filter.options : []),
      getFilterOptionsProvider: (one) => one?.filter?.provider ?? null,
      // A single choice applies on a press, as a menu item (C312 (2)).
      applyTempFilterValue: (key, patch) => {
        temp = {...temp, ...patch};
        finish('apply');
      },
      // «Снять условие» (C312 (2)): the filter taken off, as «Сбросить».
      resetFilter: () => finish('reset'),
    };
    const finish = (action) => {
      answer = action === 'apply' ? {action, value: clone(temp)} : {action, value: null};
      close();
    };
    // «Применить (N)» (FO5-1, C157 (3)): the number of values chosen when the
    // condition is a list; plain «Применить» otherwise or with none chosen.
    const footSize = FILTER_WINDOW_STEP;
    const applyText = () => {
      const number = typeof count === 'function' ? count(temp) : (Array.isArray(temp?.values) ? temp.values.length : 0);
      return number ? `${word('filterApply', anchor)} (${number})` : word('filterApply', anchor);
    };
    // The rows' scrollbar shifts nothing (popup head round 3, owner's scroll
    // variant B): the rows give its room from their own end padding
    // (sf-input-choice, data-sf-choice-track), so the band's chevron, the
    // search's icon and the checks keep one column with or without it.

    function draw() {
      render(html`${renderControl(field, host)}`, body);
      if (!foot) return;
      // The footer's buttons stand on the window's step (PH-7), as the rows.
      render(html`<div class="sf-filter-window-footer flex gap-1/3 items-cross-center">
          <sf-button size=${footSize} scheme="primary" text=${applyText()}
                     data-action="apply" @click=${() => finish('apply')}></sf-button>
          <sf-button size=${footSize} appearance="outline" scheme="on-surface" text=${word('filterReset', anchor)}
                     data-action="reset" @click=${() => finish('reset')}></sf-button>
        </div>`, foot);
    }
    const close = () => (sheet ? frame.close?.({reason: 'api'}) : frame.close({reason: 'api'}));
    OPEN.set(anchor, {close});
    const closed = () => {
      OPEN.delete(anchor);
      // The sheet gives the focus back to the anchor, as the popover does
      // (the anchor does not name the drawer, so the drawer does not know it).
      if (sheet && anchor.isConnected) {
        const target = anchor.matches?.('button, a[href], input, select, textarea, [tabindex]') ? anchor
          : anchor.querySelector?.('button, a[href], input, select, textarea, [tabindex]') ?? anchor;
        target.focus?.({preventScroll: true});
      }
      // The focus is back on the anchor (sf-popover returnFocus, sf-drawer's
      // opener); the window leaves the page after it.
      queueMicrotask(() => frame.remove());
      resolve(answer);
    };
    if (sheet) {
      frame.addEventListener('sf-drawer-closed', closed, {once: true});
    } else {
      frame.addEventListener('sf-popover-close', (event) => {
        if (event.detail?.reason === 'close') holdReopen(anchor);
      });
      frame.addEventListener('sf-popover-closed', closed, {once: true});
    }
    draw();
    mount(frame, anchor);
    // The tag is fetched by the Loader when it meets it; the anchor is given
    // once the element is defined (a property set before would hide its
    // accessor), and the window opens on the next frame.
    customElements.whenDefined(sheet ? 'sf-drawer' : 'sf-popover').then(() => {
      if (!sheet) frame.anchor = anchor;
      requestAnimationFrame(() => {
        if (!frame.isConnected) return;
        if (sheet) frame.open?.();
        else frame.show();
      });
    });
  });
}
