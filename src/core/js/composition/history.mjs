// One history for an editor of a Composition Document: typing and structure
// share it. A step is a snapshot of the whole editing state (the Document and
// the selection) taken before a change; undo returns the snapshot exactly,
// the same nodes with the same ids.
//
// A change of structure or of format is one step each. Typing in one field
// is one step per run: a new step starts when the field changes or after a
// pause (800 ms by default). Undo and redo end a run.
//
// Provenance: the snapshot history of SIMAI Editor (ui-editor EditorModel
// remember / rememberTyping / restore) was moved into the SIMAI Framework
// core by its rightholder, Rim Zabarov (owner decision 2026-11-10,
// composition F3.1). Written for the Framework and licensed with it
// (REUSE.toml: Apache-2.0).

export const HISTORY_DEPTH = 200;
export const TYPING_PAUSE = 800;

const refused = (reason) => ({ ok: false, reason });

/**
 * createHistory({depth, pause, now}) -> history.
 *
 * history.record(state, {group}) keeps `state` (the state before a change)
 * as a step. Without a group the step always starts; with a group (a typing
 * key such as '<id>/<field>') it starts only when the group changed or the
 * pause has passed since the last record of that group.
 * history.undo(current) / history.redo(current) -> {ok: true, state} with the
 * restored state (a fresh copy), the current one going to the other stack;
 * {ok: false, reason: 'empty'} when there is no step.
 */
export function createHistory({ depth = HISTORY_DEPTH, pause = TYPING_PAUSE, now = () => Date.now() } = {}) {
  let undoStack = [];
  let redoStack = [];
  let group = '';
  let groupUntil = 0;

  const push = (stack, state) => {
    stack.push(JSON.stringify(state));
    if (stack.length > depth) stack.shift();
  };
  const endRun = () => {
    group = '';
    groupUntil = 0;
  };
  const restore = (from, to, current) => {
    const step = from.pop();
    if (step === undefined) return refused('empty');
    push(to, current);
    endRun();
    return { ok: true, state: JSON.parse(step) };
  };

  return {
    record(state, { group: key = '' } = {}) {
      if (!key) {
        push(undoStack, state);
        redoStack = [];
        endRun();
        return { ok: true, step: true };
      }
      const at = now();
      const step = at > groupUntil || key !== group;
      if (step) {
        push(undoStack, state);
        redoStack = [];
      }
      group = key;
      groupUntil = at + pause;
      return { ok: true, step };
    },
    /** Ends a typing run: the next typing starts a new step. */
    endRun,
    /**
     * Replaces the newest step with `state`: two changes the person made as
     * one (a drag that also splits) keep the state before the first.
     */
    amend(state) {
      if (!undoStack.length) return refused('empty');
      undoStack[undoStack.length - 1] = JSON.stringify(state);
      return { ok: true };
    },
    undo(current) {
      return restore(undoStack, redoStack, current);
    },
    redo(current) {
      return restore(redoStack, undoStack, current);
    },
    clear() {
      undoStack = [];
      redoStack = [];
      endRun();
    },
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
    get undoDepth() {
      return undoStack.length;
    },
    get redoDepth() {
      return redoStack.length;
    },
  };
}

export default { HISTORY_DEPTH, TYPING_PAUSE, createHistory };
