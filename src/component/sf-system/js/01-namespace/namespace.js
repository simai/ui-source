var sft = SF || window.SF;
var SF = SF || window.SF || {};

window.SF = SF || {}

if(sft) {
    Object.keys(sft).forEach((key) => {
        window.SF[key] = sft[key];
        SF[key] = sft[key];
    });
}

exports = window.SF;
exports = SF;