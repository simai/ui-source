import {renderPanel} from './parts';

// rows: the name (and a caption) at the start of the row, the control at
// the end -- a switch for a boolean, quiet pills for up to three icons or two
// short words, else a compact select «value ⇕» that opens a small menu. A
// long name takes the whole line and the control drops under it.
export function renderSettingsMenuRowsTemplate(context) {
  return renderPanel(context, 'rows');
}
