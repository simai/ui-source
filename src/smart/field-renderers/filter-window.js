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
//     size,                    the step of the controls ('1' or '1/2'), the list's own
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

export function filterWindowOpen({anchor, field = {}, value = {}, size = '1', placement = 'bottom-start', width = 'panel', count, kind = '', renderControl} = {}) {
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
      body.className = 'sf-filter-window flex flex-col gap-1/2';
      foot = doc.createElement('div');
      foot.setAttribute('slot', 'footer');
      frame.append(body, foot);
    } else {
      frame = doc.createElement('sf-popover');
      frame.setAttribute('surface-role', 'dialog');
      frame.setAttribute('placement', placement);
      frame.setAttribute('label', label);
      frame.setAttribute('data-sf-filter-window', field.key);
      const surface = doc.createElement('div');
      surface.setAttribute('slot', 'content');
      surface.className = 'sf-filter-window flex flex-col gap-1/2 p-1/2';
      // The window's width (C157, C310): the panel's step, 20rem; 24rem for
      // people and records with a caption.
      surface.setAttribute('data-sf-filter-width', width === 'wide' ? 'wide' : 'panel');
      surface.style.inlineSize = width === 'wide' ? 'var(--sf-popup-form-wide-width)' : 'var(--sf-popup-panel-width)';
      surface.style.maxInlineSize = '100%';
      body = doc.createElement('div');
      body.className = 'sf-filter-window-control flex flex-col';
      foot = doc.createElement('div');
      surface.append(body, foot);
      frame.append(surface);
    }

    const host = {
      size,
      // The single-field window (C308 FO-5): the rows' checks stand at the end.
      filterWindow: true,
      getFieldText: (key) => word(key, anchor),
      getFilterControlValue: () => temp,
      patchTempFilterValue: (key, patch) => {
        temp = {...temp, ...patch};
        draw();
      },
      getFilterOperatorLabel: (operator) => filterOperatorLabel(operator, anchor, kind),
      getVisibleFilterOptions: (one) => (Array.isArray(one?.filter?.options) ? one.filter.options : []),
      getFilterOptionsProvider: (one) => one?.filter?.provider ?? null,
    };
    const finish = (action) => {
      answer = action === 'apply' ? {action, value: clone(temp)} : {action, value: null};
      close();
    };
    // «Применить (N)» (FO5-1, C157 (3)): the number of values chosen when the
    // condition is a list; plain «Применить» otherwise or with none chosen.
    const applyText = () => {
      const number = typeof count === 'function' ? count(temp) : (Array.isArray(temp?.values) ? temp.values.length : 0);
      return number ? `${word('filterApply', anchor)} (${number})` : word('filterApply', anchor);
    };
    function draw() {
      render(html`${renderControl(field, host)}`, body);
      render(html`<div class="sf-filter-window-footer flex gap-1/3 items-cross-center">
          <sf-button size=${size} scheme="primary" text=${applyText()}
                     data-action="apply" @click=${() => finish('apply')}></sf-button>
          <sf-button size=${size} appearance="outline" scheme="on-surface" text=${word('filterReset', anchor)}
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
