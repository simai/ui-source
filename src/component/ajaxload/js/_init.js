window.addEventListener('DOMContentLoaded',function() {
    document.querySelectorAll('[sf-ajaxload]')
    .forEach(
        (item) =>
        {
            let param = {
                src: item.getAttribute('sf-src')
            }

            new SF.AjaxLoad(item,param);
        }
    );
});
