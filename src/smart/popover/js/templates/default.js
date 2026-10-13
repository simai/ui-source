import {nothing} from 'lit';
import './default.css';

// Nothing. The trigger and the content are the consumer's own nodes, left where
// they were written; this component says where they are with attributes the
// stylesheet reads, and never moves them -- a node moved out from under a
// template engine comes back on its next render, in the wrong place and wired to
// nothing.
export function renderPopoverTemplate() {
    return nothing;
}
