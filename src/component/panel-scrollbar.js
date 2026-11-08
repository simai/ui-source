// The scrollbar of a dropping panel stands in the inline-end inset only while
// it takes room (owner C07, docs review R029, 2026-11-07): the area that
// scrolls the rows gives up its inline-end padding then, and keeps it beside an
// overlay scrollbar or none. The sheets draw the track (the inset, the thumb,
// the inset -- src/component/context-menu/scss/_panel.scss); this marks the
// area with a class while its scrollbar takes room, read from offsetWidth -
// clientWidth past the borders whenever the area is drawn or changes its size
// (a narrowed search, a panel fitted to its room, a window made smaller).
// Used by sf-menu-context, sf-dropdown's list, sf-input-lookup and
// sf-profile-picker.

export function scrollbarTakesRoom(area) {
  const style = getComputedStyle(area);
  const borders = (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
  return area.offsetWidth - area.clientWidth - borders > 0;
}

export class PanelScrollbar {
  constructor() {
    this.area = null;
    this.name = '';
    this.observer = null;
  }

  // Watch `area` (or nothing, given null) and mark it with `name`. A new area
  // releases the old one and takes its mark off.
  watch(area, name) {
    if (area !== this.area || name !== this.name) {
      this.observer?.disconnect();
      if (this.area && this.name) this.area.classList.remove(this.name);
      this.area = area ?? null;
      this.name = name;
      if (this.area && typeof ResizeObserver === 'function') {
        // The mark moves the area's padding, so it is written on the next
        // frame: written in the observer's own call it would resize what is
        // observed while the observer delivers (a ResizeObserver loop).
        this.observer ??= new ResizeObserver(() => requestAnimationFrame(() => this.mark()));
        this.observer.observe(this.area);
      }
    }
    this.mark();
  }

  mark() {
    const area = this.area;
    if (!area?.isConnected || !this.name) return;
    const takesRoom = scrollbarTakesRoom(area);
    if (area.classList.contains(this.name) !== takesRoom) area.classList.toggle(this.name, takesRoom);
  }

  disconnect() {
    this.observer?.disconnect();
    this.observer = null;
    if (this.area && this.name) this.area.classList.remove(this.name);
    this.area = null;
    this.name = '';
  }
}
