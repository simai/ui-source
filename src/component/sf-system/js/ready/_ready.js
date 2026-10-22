// The callback form of SF.ready, kept for the components that call it. SF.ready
// itself lives on the shared global, created once by whichever bundle runs
// first (core.js does, before this chunk): src/core/js/ready.js.
import {installReady} from '../../../../core/js/ready.js';

const ready = installReady();

export default function readyCallback(handler) {
  return (window.SF?.ready || ready)?.(handler);
}
