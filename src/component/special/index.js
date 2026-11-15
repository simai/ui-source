import './scss/index.scss';

import '../sf-system/js/01-namespace/namespace.js';
import '../sf-system/js/02-methods/_methods.js';
import '../sf-system/js/02-methods/_events.js';
import '../sf-system/js/03-system/_parameters.js';
import '../sf-system/js/03-system/_controller.js';
import '../sf-system/js/03-system/_search.js';
import '../sf-system/js/03-system/_blocks.js';
import '../sf-system/js/03-system/_provider.js';
import '../sf-system/js/04-blocks/_special.js';
import '../sf-system/js/03-system/_stack.js';
// The panel's classes become the core display settings (owner decision C196
// (7), until 2027-01-01): js/bridge.js.
import {bridgeLegacySpecial} from './js/bridge.js';

// document.addEventListener('DOMContentLoaded', (e) => {
    new SF.Controller();
// });
bridgeLegacySpecial();
