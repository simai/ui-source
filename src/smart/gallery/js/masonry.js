// The masonry look's placement (owner decision C150 (11), 2026-11-14) where
// the browser has no display: grid-lanes. The grid (component.figure,
// .sf-figure-grid--masonry) keeps its columns -- the same auto-fill tracks and
// gap as the grid look -- and the tiles stand in it, each at the top of its
// row, until they are placed: each tile, in order, goes into the shortest
// column (a tie to the start one), so every tile stands no higher than the one
// before it and reading and Tab go by rows, left to right and only down. A
// placed tile keeps its column (--sf-figure-grid--lane, read by the grid as
// grid-column N / span 1: an absolute grid item with both lines takes that
// column's width, and the grid mirrors it in RTL) and its block offset; the grid gets the height
// of its longest column. The shape of each tile comes from the picture's width
// and height, so nothing waits for a picture to arrive; a tile whose height
// changes (a picture without sizes arriving, a caption wrapping, a column
// count changing with the width) is placed again before the next frame.
// The mark data-sf-masonry="placed" is the runtime's: a printed first paint
// leaves it out, so printed markup stands as the unplaced grid.
// Only the tiles are observed: the grid's own height changes as they are
// placed, and a change of its width reaches every tile's width.

const NATIVE = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('display', 'grid-lanes');

// Two heights within half a pixel are one: the start column takes the tile.
const TIE = 0.5;

export function masonryIsNative() {
  return NATIVE;
}

export class MasonryPlacement {
  constructor() {
    this.grid = null;
    this.observer = null;
    this.tiles = [];
    this.place = this.place.bind(this);
  }

  // Called after every drawing of the masonry look with its grid.
  attach(grid) {
    if (NATIVE || !(grid instanceof HTMLElement)) {
      this.detach();
      return;
    }
    if (grid !== this.grid) {
      this.detach();
      this.grid = grid;
    }
    if (!this.observer && typeof ResizeObserver === 'function') this.observer = new ResizeObserver(this.place);
    const tiles = Array.from(grid.children);
    this.tiles.filter((tile) => !tiles.includes(tile)).forEach((tile) => {
      this.observer?.unobserve(tile);
      clearTile(tile);
    });
    tiles.filter((tile) => !this.tiles.includes(tile)).forEach((tile) => this.observer?.observe(tile));
    this.tiles = tiles;
    this.place();
  }

  // Another look, or the element left the page: the grid stands as drawn.
  detach() {
    this.observer?.disconnect();
    this.observer = null;
    this.tiles.forEach(clearTile);
    this.tiles = [];
    if (this.grid) {
      this.grid.removeAttribute('data-sf-masonry');
      this.grid.style.removeProperty('block-size');
    }
    this.grid = null;
  }

  place() {
    const grid = this.grid;
    if (!grid || !grid.isConnected) return;
    const style = getComputedStyle(grid);
    // The resolved tracks: one length per column (none while hidden).
    const columns = style.gridTemplateColumns.split(/\s+/u).map(Number.parseFloat).filter(Number.isFinite).length;
    if (!columns) return;
    const gap = Number.parseFloat(style.rowGap) || 0;
    const tiles = Array.from(grid.children);
    // Read every height first, then write: one layout, not one per tile.
    const heights = tiles.map((tile) => tile.getBoundingClientRect().height);
    const ends = new Array(columns).fill(0);
    const places = heights.map((height) => {
      let column = 0;
      for (let next = 1; next < columns; next += 1) if (ends[next] < ends[column] - TIE) column = next;
      const top = ends[column];
      ends[column] += height + gap;
      return [column, top];
    });
    grid.setAttribute('data-sf-masonry', 'placed');
    tiles.forEach((tile, index) => {
      const [column, top] = places[index];
      tile.style.setProperty('--sf-figure-grid--lane', String(column + 1));
      tile.style.insetBlockStart = `${Math.round(top * 100) / 100}px`;
    });
    const height = Math.max(0, ...ends.map((end) => end - gap));
    grid.style.blockSize = `${Math.round(height * 100) / 100}px`;
  }
}

function clearTile(tile) {
  tile.style.removeProperty('--sf-figure-grid--lane');
  tile.style.removeProperty('inset-block-start');
}
