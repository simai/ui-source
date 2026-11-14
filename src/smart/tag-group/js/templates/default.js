import {nothing} from 'lit';
import './default.css';

// Nothing. The tags are the page's own nodes, left where they were written;
// the group lays out the row (its stylesheet), walks it and adds «+N» by DOM
// (index.js), and never moves a tag -- a node moved out from under a template
// engine comes back on its next render, in the wrong place.
export function renderTagGroupTemplate() {
    return nothing;
}
