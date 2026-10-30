// The size sf-tag asks sf-icon-button for, for its remove button. The button's
// sizes are 1/3, 1/2, 1, 2 and 3; the tag asks for the smallest at every tag
// size and its stylesheet draws the box from the label (templates/default.css).
// Before 1.1.6 sizes 1/2 and 1/3 asked for 1/4, a size the button does not
// have, and it fell back to size 1. A pure module, so a contract reads it.
export const CLOSE_SIZE = '1/3';

export function closeSize() {
    return CLOSE_SIZE;
}
