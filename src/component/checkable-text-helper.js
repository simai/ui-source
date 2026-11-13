import { instancePath, partId, pathIsSettled } from '../core/js/instance-path.js';

// A checkable control's name is its label alone; its description is the
// description (standard simai.smart-component 1.3.8 §4.8; simai/ui-source#44).
// The box, the label and the description sit inside one <label> so a press
// anywhere toggles the control, and a <label> names its control by all of its
// text: «Приглашения на мероприятия Не чаще раза в месяц» was read as one name.
// The input is named by the label row (aria-labelledby) and described by the
// rest of the text column (aria-describedby). An author's aria-label or
// aria-labelledby wins; ids the author put on aria-describedby are kept. Ids
// come from the instance path, never a counter (#41).
//
// sf-switch was fixed this way first (1.3.1, its own copy in _switch.js);
// sf-checkbox and sf-radio share the anatomy and read this helper.
//
// parts:
//   kind         the Smart tag (`sf-checkbox`)
//   classKind    the root class of class markup (`sf-checkbox`, `sf-radio-button`)
//   text         selector of the label text inside the label row: the name;
//                the help mark beside it is a button with a name of its own
//                and is left out (the row is the name when there is no text
//                part, as in class markup without one)
//   label        selector of the label row inside the root
//   column       selector of the text column that holds the label row and the description
//   description  selector of the description when there is no column
function splitIds(value) {
  return String(value || '').split(/\s+/).filter(Boolean);
}

function descriptionParts(root, parts) {
  const column = parts.column ? root.querySelector(parts.column) : null;
  if (!column) return parts.description ? [...root.querySelectorAll(parts.description)] : [];
  const label = root.querySelector(parts.label) || (parts.text && root.querySelector(parts.text));
  return [...column.children].filter((node) => node !== label
    && !node.contains(label)
    && !node.hasAttribute('aria-hidden')
    && node.textContent.trim());
}

export function linkCheckableText(root, parts) {
  if (!root) return;
  const input = root.querySelector('input[type="checkbox"], input[type="radio"]');
  if (!input) return;
  const smart = root.closest(parts.kind);
  const owner = smart || root;
  const kind = smart ? parts.kind : parts.classKind;
  // A control built before it is placed has no path yet: link it once it is.
  if (!pathIsSettled(owner)) {
    if (!root.__sfCheckableLinkPending && typeof requestAnimationFrame === 'function') {
      root.__sfCheckableLinkPending = true;
      requestAnimationFrame(() => {
        root.__sfCheckableLinkPending = false;
        if (pathIsSettled(owner)) linkCheckableText(root, parts);
      });
    }
    return;
  }
  const path = instancePath(owner, { kind });
  const linked = root.__sfCheckableLinked || { label: '', described: [] };

  const label = (parts.text && root.querySelector(parts.text)) || root.querySelector(parts.label);
  const ownLabel = linked.label && input.getAttribute('aria-labelledby') === linked.label;
  if (label && label.textContent.trim() && !input.hasAttribute('aria-label')
    && (ownLabel || !input.hasAttribute('aria-labelledby'))) {
    if (!label.id) label.id = partId(path, 'label');
    input.setAttribute('aria-labelledby', label.id);
    linked.label = label.id;
  } else if (ownLabel) {
    input.removeAttribute('aria-labelledby');
    linked.label = '';
  }

  const ids = descriptionParts(root, parts).map((node, index) => {
    if (!node.id) node.id = partId(path, index ? `description-${index + 1}` : 'description');
    return node.id;
  });
  const authored = splitIds(input.getAttribute('aria-describedby')).filter((id) => !linked.described.includes(id));
  const describedBy = [...new Set([...authored, ...ids])];
  if (describedBy.length) input.setAttribute('aria-describedby', describedBy.join(' '));
  else input.removeAttribute('aria-describedby');
  linked.described = ids;

  // The <label> names its control by `for`, not by the first control inside
  // it: the help mark is a button, and with the box at the end
  // (position="end") the button came first and a press on the text pressed
  // the help.
  if (root instanceof HTMLLabelElement && !root.htmlFor) {
    if (!input.id) input.id = partId(path, 'input');
    root.htmlFor = input.id;
  }
  root.__sfCheckableLinked = linked;
}

// A press that comes from the help (the sf-help-mark of the help setting, or
// what the help slot holds) is the help's, never the control's: the <label>
// around both must not toggle. The press cancels the label's activation (the
// «?» button has no default of its own, its listener still opens the help);
// a link or a field in the explanation keeps its own default, which the label
// leaves alone as interactive content. Read on the <label> as its click
// listener.
export function keepHelpOutOfLabel(event) {
  const label = event.currentTarget;
  const target = event.target;
  if (!(target instanceof Element) || !(label instanceof Element)) return;
  const help = target.closest('sf-help-mark, [slot="help"]');
  if (!help || !label.contains(help)) return;
  const own = target.closest('a[href], input, select, textarea, summary');
  if (own && help.contains(own)) return;
  event.preventDefault();
}

export const CHECKBOX_TEXT_PARTS = Object.freeze({
  kind: 'sf-checkbox',
  classKind: 'sf-checkbox',
  text: '.sf-checkbox-label, [data-sf-checkbox-label]',
  label: '.sf-checkbox-top',
  column: '.sf-checkbox-container',
  description: '.sf-checkbox-description',
});

export const RADIO_TEXT_PARTS = Object.freeze({
  kind: 'sf-radio',
  classKind: 'sf-radio-button',
  text: '.sf-radio-button-text, [data-sf-radio-label]',
  label: '.sf-radio-button-top',
  column: '.sf-radio-button-container',
  description: '.sf-radio-button-description',
});

// sf-switch reads the same binding since C63 W9 (it had its own copy in
// component/switch/js/_switch.js, written first, the same algorithm).
export const SWITCH_TEXT_PARTS = Object.freeze({
  kind: 'sf-switch',
  classKind: 'sf-switch',
  text: '.sf-switch-container',
  label: '.sf-switch-top',
  column: '.sf-switch-container-wrap',
  description: '.sf-switch-description',
});
