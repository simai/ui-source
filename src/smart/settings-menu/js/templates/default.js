import {renderPanel} from './parts';

// drill, the default arrangement (owner, 2026-10-30): each row is a leading
// icon, the setting's name and its current value under the name in small
// dimmed text, and a chevron at the end. Pressing it opens the choice list in
// place -- the same panel, a head with the way back, a check mark on the
// chosen option. A boolean stays in its row as a switch. A long name wraps, a
// long value ends in an ellipsis with the whole of it in title, and the panel
// keeps its width.
export function renderSettingsMenuTemplate(context) {
  return renderPanel(context, 'drill');
}
