// Files from the computer dropped on an element (Framework order FO-1 of the
// view set study, ui-control control/research/2026-11-17-view-round-1/
// framework-orders.md; returns FO1-1..FO1-6 of the component study,
// control/research/2026-11-18-framework-parts-fo). sf-file-upload,
// sf-input-image, sf-tree, sf-input-rich and the set's sf-view each read
// dataTransfer on their own: which drag carries files, the copy cursor, the
// state while a file is held over the element, the files of a drop. This is
// that reading, once:
//
//   const drop = filesDrop(element, {
//     onFiles: (files, {event, target, skipped}) => {},
//                                      once per drop that carries files
//     onOver: (over, target) => {},    a file is held over the element (over
//                                      the target), or no longer
//     disabled: () => false,           the element takes nothing now: the cursor
//                                      says no and no files are given
//     target: (event) => node | null,  what under the pointer takes the files
//                                      (a folder row of a tree); null takes
//                                      nothing there. Given back with the files.
//     folders: 'open' | 'skip',        a dropped folder: its files, read
//                                      through the entries (open, the default),
//                                      or left out and named in skipped
//     mark: true,                      data-sf-files-over on the element
//     follow: false,                   a host around its own zone (sf-file-upload
//                                      and its area): it only follows the drag
//                                      -- the over state while files are held
//                                      over it, wherever inside they are taken
//                                      -- and takes no files
//   });
//   drop.stop();
//
// While files are held over it the element carries data-sf-files-over (a
// host state its sheet draws the drop zone by). Only a drag that carries
// files is taken, so text or a row dragged across the element passes on to
// whoever takes it. A drop that carries files is the element's even while it
// is disabled (the browser would otherwise open the file in place of the
// page), and gives nothing.
//
// Zones inside zones (FO1-1): the innermost zone under the pointer takes the
// drop; an outer one sees it taken by a zone (a mark on the event, shared by
// every bundle's copy) and gives nothing. A handler that only cancels the
// event (a component's own area inside the zone) takes nothing from it. A
// file dropped beside every zone (FO1-2) does not open in the tab while a zone
// is on the page: the document cancels a drop of files nobody took. The over
// state counts the enters and leaves of the element (FO1-6): a leave for a
// child is matched by the child's enter, which Safari's leave without a
// relatedTarget cannot say. A dropped folder (FO1-5) arrives as an empty File
// in dataTransfer.files; its entries are read instead.
//
// What the zone says (owner decision C223): a screen that cannot drag -- a
// touch screen with no fine pointer at all -- is not asked to; filesDragWords()
// answers whether the words about dragging belong on this screen, the same
// media query the file field's sheet hides them by.
//
// The look of a drop zone and where in a list files may be dropped wait for
// the owner (q-fo1-zone); each component draws its own zone by the over state
// until then.
//
// Every bundle carries its own copy of this module: the zones on a page are
// counted on one shared global, so the document guard is one for them all.

export const FILES_OVER_ATTRIBUTE = 'data-sf-files-over';
export const NO_DRAG_QUERY = '(pointer: coarse) and (not (any-pointer: fine))';
const ZONES = '__sfFilesDropZones';
// The zone that took a drag event, on the event (FO1-1).
const TAKEN = Symbol.for('sf.filesDrop.taken');
const takenByOther = (event, element) => Boolean(event[TAKEN]) && event[TAKEN] !== element;
const take = (event, element) => {
  try {
    if (!event[TAKEN]) Object.defineProperty(event, TAKEN, {value: element, configurable: true});
  } catch { /* a frozen event is read as not taken */ }
};

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

// The document guard (FO1-2): one per document, on while a zone is on it.
function guard(doc, change) {
  if (!doc?.addEventListener) return;
  const zones = (globalThis[ZONES] ??= new WeakMap());
  const held = zones.get(doc) ?? {count: 0, stop: null};
  held.count = Math.max(0, held.count + change);
  if (held.count && !held.stop) {
    const refuse = (event) => {
      if (event.defaultPrevented || !carriesFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    };
    doc.addEventListener('dragover', refuse);
    doc.addEventListener('drop', refuse);
    held.stop = () => {
      doc.removeEventListener('dragover', refuse);
      doc.removeEventListener('drop', refuse);
    };
  } else if (!held.count && held.stop) {
    held.stop();
    held.stop = null;
  }
  zones.set(doc, held);
}

// A folder's files, read through its entries (FO1-5), each with its path.
function readEntry(entry, path = '') {
  if (!entry) return Promise.resolve([]);
  if (entry.isFile) {
    return new Promise((settle) => entry.file((file) => {
      try {
        if (path && !file.webkitRelativePath) Object.defineProperty(file, 'sfPath', {value: `${path}${file.name}`});
      } catch { /* a read-only File keeps its name */ }
      settle([file]);
    }, () => settle([])));
  }
  if (!entry.isDirectory) return Promise.resolve([]);
  const reader = entry.createReader();
  const all = [];
  return new Promise((settle) => {
    // readEntries answers a batch at a time until it answers none.
    const next = () => reader.readEntries((batch) => {
      if (!batch.length) {
        Promise.all(all.map((one) => readEntry(one, `${path}${entry.name}/`))).then((lists) => settle(lists.flat()));
        return;
      }
      all.push(...batch);
      next();
    }, () => settle([]));
    next();
  });
}

// What a drop gives: the files, and the folders read or skipped. The items
// are read in the drop's own turn (they are empty after it).
function droppedOf(event, folders) {
  const items = [...(event.dataTransfer?.items ?? [])].filter((item) => item.kind === 'file');
  const entries = items.map((item) => (typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null));
  if (!entries.some((entry) => entry?.isDirectory)) {
    return {files: Promise.resolve([...(event.dataTransfer?.files ?? [])]), skipped: []};
  }
  const plain = [...(event.dataTransfer?.files ?? [])];
  const skipped = [];
  const reads = entries.map((entry, index) => {
    if (!entry?.isDirectory) return Promise.resolve(plain[index] ? [plain[index]] : (items[index]?.getAsFile() ? [items[index].getAsFile()] : []));
    if (folders === 'skip') {
      skipped.push(entry.name);
      return Promise.resolve([]);
    }
    return readEntry(entry);
  });
  return {files: Promise.all(reads).then((lists) => lists.flat()), skipped};
}

export function filesDrop(element, {onFiles = null, onOver = null, disabled = null, target = null, folders = 'open', mark = true, follow = false} = {}) {
  if (!element?.addEventListener) return {stop() {}, get over() { return false; }};
  let over = false;
  let depth = 0;
  let place = null;
  const doc = element.ownerDocument;
  const isDisabled = () => (typeof disabled === 'function' ? Boolean(disabled()) : Boolean(disabled));
  const targetOf = (event) => (typeof target === 'function' ? target(event) ?? null : element);
  const setOver = (next, node = null) => {
    if (next === over && node === place) return;
    over = next;
    place = next ? node : null;
    if (mark) element.toggleAttribute(FILES_OVER_ATTRIBUTE, over);
    if (typeof onOver === 'function') onOver(over, place);
  };

  const onDragEnter = (event) => {
    if (!carriesFiles(event)) return;
    depth += 1;
  };
  const onDragOver = (event) => {
    if (!carriesFiles(event)) return;
    if (follow) {
      setOver(!isDisabled(), element);
      return;
    }
    // An inner zone took it (FO1-1): it is that zone's.
    if (takenByOther(event, element)) {
      setOver(false);
      return;
    }
    const node = targetOf(event);
    if (!node) {
      setOver(false);
      return;
    }
    take(event, element);
    event.preventDefault();
    if (isDisabled()) {
      event.dataTransfer.dropEffect = 'none';
      setOver(false);
      return;
    }
    event.dataTransfer.dropEffect = 'copy';
    setOver(true, node);
  };
  const onDragLeave = (event) => {
    if (!carriesFiles(event)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) setOver(false);
  };
  const onDrop = (event) => {
    depth = 0;
    if (!carriesFiles(event) && !(event.dataTransfer?.files?.length)) return;
    if (follow) {
      setOver(false);
      return;
    }
    if (takenByOther(event, element)) {
      setOver(false);
      return;
    }
    const node = targetOf(event);
    setOver(false);
    if (!node) return;
    take(event, element);
    event.preventDefault();
    if (isDisabled()) return;
    const dropped = droppedOf(event, folders);
    dropped.files.then((files) => {
      if ((files.length || dropped.skipped.length) && typeof onFiles === 'function') onFiles(files, {event, target: node, skipped: dropped.skipped});
    });
  };
  // The drag ended somewhere else (Escape, a drop outside): nothing is held.
  const onDragEnd = () => {
    depth = 0;
    setOver(false);
  };

  element.addEventListener('dragenter', onDragEnter);
  element.addEventListener('dragover', onDragOver);
  element.addEventListener('dragleave', onDragLeave);
  element.addEventListener('drop', onDrop);
  doc?.addEventListener?.('dragend', onDragEnd, true);
  doc?.addEventListener?.('drop', onDragEnd, true);
  guard(doc, 1);
  let stopped = false;

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      element.removeEventListener('dragenter', onDragEnter);
      element.removeEventListener('dragover', onDragOver);
      element.removeEventListener('dragleave', onDragLeave);
      element.removeEventListener('drop', onDrop);
      doc?.removeEventListener?.('dragend', onDragEnd, true);
      doc?.removeEventListener?.('drop', onDragEnd, true);
      guard(doc, -1);
      setOver(false);
    },
    get over() {
      return over;
    },
  };
}

export default filesDrop;
