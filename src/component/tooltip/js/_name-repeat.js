// A tooltip that only says what the trigger's name already says is not the
// trigger's description too, or a screen reader says it twice: an icon button
// named «Повторить Отчёт.xlsx» with the tooltip «Повторить» was heard as
// «Повторить Отчёт.xlsx, Повторить» (sf-file-download, file rows, 2026-11-16).
// Before, only a tooltip equal to the name was left out (docs trial 4,
// 2026-10-15); now a tooltip whose words stand whole inside the name is too.
// The tooltip is still drawn; only the link for assistive technology goes.
// Pure functions over the DOM, no imports: the tooltip controller and
// sf-button-icon's name tooltip read the same rule.

const squash = (text) => String(text ?? '').replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

// Parts a reader does not hear as words of the tooltip: the keys of its
// shortcut (said on the trigger by aria-keyshortcuts, KB-4) and the tail.
const UNSAID = '.sf-tooltip-shortcut, .sf-tooltip-tail';

// The words a node says: text of its descendants, without hidden or
// aria-hidden ones (an icon's ligature, a status seen only) and without the
// parts named by skip.
export function spokenText(node, skip = '') {
  if (!node) return '';
  let words = '';
  for (const child of node.childNodes ?? []) {
    if (child.nodeType === 3) {
      words += child.data;
    } else if (child.nodeType === 1) {
      if (child.hidden || child.getAttribute?.('aria-hidden') === 'true') continue;
      if (skip && child.matches?.(skip)) continue;
      words += ` ${spokenText(child, skip)} `;
    }
  }
  return words;
}

// The trigger's accessible name, as near as a page can read it: the elements
// aria-labelledby names, else aria-label, else its own words (without a
// tooltip surface standing inside it), else its title.
export function triggerName(trigger, surface = null) {
  if (!trigger?.getAttribute) return '';
  const doc = trigger.ownerDocument;
  const ids = String(trigger.getAttribute('aria-labelledby') || '').split(/\s+/u).filter(Boolean);
  if (ids.length && doc) {
    const labelled = ids.map((id) => doc.getElementById(id)?.textContent || '').join(' ');
    if (squash(labelled)) return labelled;
  }
  const label = trigger.getAttribute('aria-label');
  if (squash(label)) return label;
  const surfaceSelector = surface?.id ? `#${globalThis.CSS?.escape ? CSS.escape(surface.id) : surface.id}` : '';
  const own = spokenText(trigger, [UNSAID, surfaceSelector, '.sf-tooltip', 'sf-tooltip'].filter(Boolean).join(', '));
  if (squash(own)) return own;
  return trigger.getAttribute('title') || '';
}

// What the tooltip says: its text and supporting text, without the keys. A
// Smart <sf-tooltip> not drawn yet says its text and supporting-text settings.
export function tooltipText(surface) {
  if (!surface) return '';
  const drawn = spokenText(surface, UNSAID);
  if (squash(drawn)) return drawn;
  if (surface.localName === 'sf-tooltip') {
    return [surface.getAttribute('text'), surface.getAttribute('supporting-text')].filter(Boolean).join(' ');
  }
  return '';
}

// Whether the tooltip's words stand whole inside the name: equal, or a run of
// whole words of it («Повторить» in «Повторить Отчёт.xlsx», not «Ред» in
// «Редактировать»). An empty tooltip or name repeats nothing.
export function repeatsName(name, said) {
  const whole = squash(name);
  const part = squash(said);
  if (!whole || !part) return false;
  if (whole === part) return true;
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escape(part)}(?:$|[^\\p{L}\\p{N}])`, 'u').test(whole);
}
