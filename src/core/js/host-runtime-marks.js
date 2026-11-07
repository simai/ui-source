// The marks the runtime keeps on a Smart host -- SF.Assembly's part marks, the
// first paint's, the Loader's and the style gate's. They are the runtime's,
// not the author's: forwardHostAttributes leaves them on the host (the
// Assembly and the Loader find the host by them), and element.dataAttributes
// never reports them. The style gate's pair, data-sf-style-pending and
// data-sf-style-ready, was missing here and came back from dataAttributes as
// sfStylePending / sfStyleReady beside what the author wrote (docs review
// R022, 2026-11-07).
export const HOST_RUNTIME_MARKS = new Set([
  "data-sf-role",
  "data-sf-instance",
  "data-sf-start",
  "data-sf-started",
  "data-sf-assembly",
  "data-sf-static",
  "data-sf-first-paint",
  "data-sf-held",
  "data-sf-skeleton",
  "data-sf-observer",
  "data-sf-style-pending",
  "data-sf-style-ready",
]);

// What the author wrote as data-* on a host, read the way dataset reads
// (data-add -> add, data-row-id -> rowId), from the host's record of
// attribute name -> value. The runtime's marks are left out even when an
// older record holds them.
export function readHostDataAttributes(record) {
  const read = {};
  if (!record || !record.size) {
    return read;
  }

  record.forEach((value, name) => {
    if (HOST_RUNTIME_MARKS.has(name)) {
      return;
    }
    const key = name
      .slice(5)
      .replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    read[key] = value;
  });

  return read;
}
