/*$(document).on('lazybeforeunveil', function(e){
    var ajax = $(e.target).data('ajax');
    if(ajax){
        $(e.target).load(ajax);
    }
});*/

var SF = SF || {};

SF.LazyLoad = function()
{

}

document.addEventListener('lazybeforeunveil',SF.LazyLoad)