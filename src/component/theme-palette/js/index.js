// core's theme-palette.js publishes SF.ThemePalette when it runs; registered
// here, the Loader announces it as theme-palette (SF.Loader.ready and the
// theme-palette:ready event).
import registerComponent from '../../register-helper';
import '../../../core/js/theme-palette.js';

registerComponent('theme-palette', window.SF.ThemePalette);
