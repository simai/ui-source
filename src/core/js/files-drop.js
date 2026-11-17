// Files from the computer dropped on an element (Framework order FO-1 of the
// view set study, ui-control control/research/2026-11-17-view-round-1/
// framework-orders.md). sf-file-upload, sf-input-image, sf-tree, sf-input-rich
// and the set's sf-view each read dataTransfer on their own: which drag
// carries files, the copy cursor, the state while a file is held over the
// element, the files of a drop. This is that reading, once:
//
//   const drop = filesDrop(element, {
//     onFiles: (files, event) => {},   once per drop that carries files
//     onOver: (over) => {},            a file is held over the element, or no longer
//     disabled: () => false,           the element takes nothing now: the cursor
//                                      says no and no files are given
//   });
//   drop.stop();
//
// While files are held over it the element carries data-sf-files-over (a
// host state its sheet draws the drop zone by). Only a drag that carries
// files is taken, so text or a row dragged across the element passes on to
// whoever takes it. Leaving the element for a child of it is not leaving.
// A drop that carries files is the element's even while it is disabled (the
// browser would otherwise open the file in place of the page), and gives
// nothing.
//
// What the zone says (owner decision C223): a screen that cannot drag -- a
// touch screen with no fine pointer at all -- is not asked to; filesDragWords()
// answers whether the words about dragging belong on this screen, the same
// media query the file field's sheet hides them by.
//
// Nothing here draws or keeps state outside the controller it returns, so
// every bundle may carry its own copy.

export const FILES_OVER_ATTRIBUTE = 'data-sf-files-over';
export const NO_DRAG_QUERY = '(pointer: coarse) and (not (any-pointer: fine))';

/** Whether a drag event carries files from the computer. */
export function carriesFiles(event) {
  return [...(event?.dataTransfer?.types ?? [])].includes('Files');
}

/** Whether the words about dragging belong on this screen (C223): false on a touch screen with no fine pointer. */
export function filesDragWords(view = globalThis) {
  try {
    return !view?.matchMedia?.(NO_DRAG_QUERY)?.matches;
  } catch {
    return true;
  }
}

export function filesDrop(element, {onFiles = null, onOver = null, disabled = null, mark = true} = {}) {
  if (!element?.addEventListener) return {stop() {}, get over() { return false; }};
  let over = false;
  const isDisabled = () => (typeof disabled === 'function' ? Boolean(disabled()) : Boolean(disabled));
  const setOver = (next) => {
    if (next === over) return;
    over = next;
    if (mark) element.toggleAttribute(FILES_OVER_ATTRIBUTE, over);
    if (typeof onOver === 'function') onOver(over);
  };
  const inside = (node) => Boolean(node) && (element.contains(node) || element.shadowRoot?.contains(node));

  const onDragOver = (event) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    if (isDisabled()) {
      event.dataTransfer.dropEffect = 'none';
      setOver(false);
      return;
    }
    event.dataTransfer.dropEffect = 'copy';
    setOver(true);
  };
  const onDragLeave = (event) => {
    if (inside(event.relatedTarget)) return;
    setOver(false);
  };
  const onDrop = (event) => {
    if (!carriesFiles(event) && !(event.dataTransfer?.files?.length)) return;
    event.preventDefault();
    setOver(false);
    if (isDisabled()) return;
    const files = [...(event.dataTransfer?.files ?? [])];
    if (files.length && typeof onFiles === 'function') onFiles(files, event);
  };
  // The drag ended somewhere else (Escape, a drop outside): nothing is held.
  const onDragEnd = () => setOver(false);

  element.addEventListener('dragover', onDragOver);
  element.addEventListener('dragleave', onDragLeave);
  element.addEventListener('drop', onDrop);
  element.ownerDocument?.addEventListener?.('dragend', onDragEnd, true);

  return {
    stop() {
      element.removeEventListener('dragover', onDragOver);
      element.removeEventListener('dragleave', onDragLeave);
      element.removeEventListener('drop', onDrop);
      element.ownerDocument?.removeEventListener?.('dragend', onDragEnd, true);
      setOver(false);
    },
    get over() {
      return over;
    },
  };
}

export default filesDrop;
