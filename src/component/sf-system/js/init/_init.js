window.addEventListener('sf-loader-ready', () => {
    new SF.Search(
        {
            modal: '[sf-modal]',
            gallery: '[sf-gallery]',
            overbox: '[sf-overbox]',
        },
        {
            init: '[sf-modal]',
            overlay: 'fixed w-full h-full top-0 right-0 bottom-0 left-0 items-cross-center content-main-center bg-surface-transparent-overlay',
            area: 'relative w-10/12 sm:w-10/12 w-2/3 lg:w-1/2 xl:w-1/2',
            content: 'overflow-hidden border-0 radius-surface p-2 bg-surface-1',
            close:
                {
                    active: true,
                    modifier: 'sf-close transition',
                },
        }
    );
})
