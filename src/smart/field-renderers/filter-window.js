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
import {html, render} from 'lit';
import {pageText} from '../../core/js/page-language';
import LANG_WORDS from './lang/index.mjs';

const SET_NAME = 'sf-field-renderers';
const SET_TEXT = LANG_WORDS;

// The anchor a window was closed from by a press on it: that press's click
// must not open it again.
const CLOSED_BY_ANCHOR = new WeakMap();
const OPEN = new WeakMap();
const OPERATOR_WORDS = {
  eq: 'operatorEq', gt: 'operatorGt', gte: 'operatorGte', lt: 'operatorLt', lte: 'operatorLte',
  between: 'operatorBetween', contains: 'operatorContains', startsWith: 'operatorStartsWith',
  any: 'operatorAny', today: 'operatorToday', week: 'operatorWeek', month: 'operatorMonth', in: 'operatorIn',
};

const word = (key, node) => pageText(SET_TEXT, key, node ?? null, SET_NAME);

/** The words of an operator in the page's language; an operator nobody has a word for is shown as it is stored. */
export function filterOperatorLabel(operator, node = null) {
  const key = OPERATOR_WORDS[operator];
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

export function filterWindowOpen({anchor, field = {}, value = {}, size = '1', placement = 'bottom-start', renderControl} = {}) {
  if (!anchor?.isConnected || !field?.key) return Promise.resolve(null);
  const open = OPEN.get(anchor);
  if (open) {
    open.close();
    return Promise.resolve(null);
  }
  // The press on the anchor that closed its window is followed by its click.
  const closedAt = CLOSED_BY_ANCHOR.get(anchor) ?? 0;
  if (Date.now() - closedAt < 500) return Promise.resolve(null);
  const doc = anchor.ownerDocument;
  return new Promise((resolve) => {
    let temp = clone(value);
    let answer = null;
    const popover = doc.createElement('sf-popover');
    popover.setAttribute('surface-role', 'dialog');
    popover.setAttribute('placement', placement);
    popover.setAttribute('label', field.label || field.key);
    popover.setAttribute('data-sf-filter-window', field.key);
    const surface = doc.createElement('div');
    surface.setAttribute('slot', 'content');
    surface.className = 'sf-filter-window flex flex-col gap-1/2 p-1/2';
    popover.append(surface);

    const host = {
      size,
      getFieldText: (key) => word(key, anchor),
      getFilterControlValue: () => temp,
      patchTempFilterValue: (key, patch) => {
        temp = {...temp, ...patch};
        draw();
      },
      getFilterOperatorLabel: (operator) => filterOperatorLabel(operator, anchor),
      getVisibleFilterOptions: (one) => (Array.isArray(one?.filter?.options) ? one.filter.options : []),
      getFilterOptionsProvider: (one) => one?.filter?.provider ?? null,
    };
    const finish = (action) => {
      answer = action === 'apply' ? {action, value: clone(temp)} : {action, value: null};
      popover.close({reason: 'api'});
    };
    function draw() {
      render(html`
        <div class="sf-filter-window-control flex flex-col">${renderControl(field, host)}</div>
        <div class="sf-filter-window-footer flex gap-1/3 items-cross-center">
          <sf-button size=${size} appearance="filled" scheme="primary" text=${word('filterApply', anchor)}
                     data-action="apply" @click=${() => finish('apply')}></sf-button>
          <sf-button size=${size} appearance="outline" scheme="on-surface" text=${word('filterReset', anchor)}
                     data-action="reset" @click=${() => finish('reset')}></sf-button>
        </div>`, surface);
    }
    const close = () => popover.close({reason: 'api'});
    OPEN.set(anchor, {close});
    popover.addEventListener('sf-popover-close', (event) => {
      if (event.detail?.reason === 'close') CLOSED_BY_ANCHOR.set(anchor, Date.now());
    });
    popover.addEventListener('sf-popover-closed', () => {
      OPEN.delete(anchor);
      // The focus is back on the anchor (sf-popover returnFocus); the window
      // leaves the page after it.
      queueMicrotask(() => popover.remove());
      resolve(answer);
    }, {once: true});
    draw();
    // Beside the anchor in the document, so the page's variables, theme,
    // language and density reach it; the surface itself stands in the top layer.
    // The tag is fetched by the Loader when it meets it; the anchor is given
    // once the element is defined (a property set before would hide its
    // accessor), and the window opens on the next frame.
    anchor.after(popover);
    customElements.whenDefined('sf-popover').then(() => {
      popover.anchor = anchor;
      requestAnimationFrame(() => {
        if (popover.isConnected) popover.show();
      });
    });
  });
}
