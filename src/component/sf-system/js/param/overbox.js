export let Overbox = {
    action          : 'hover',
    mode            : 'inline',
    loadtimeout     : '0',
    width           : '300px',
    height          : false,
    close:
    {
        active : false,
        modifier : 'sf-close transition'
    },
    load:
    {
        active : false,
    },
    tooltip : {
        active      : true,
        position    : 'auto',
        overlay     : 'absolute flex-col items-cross-start',
        area        : 'w-full overflow-auto p-4 border-1 radius-1 border-gray-0 elevation-1',
        content     : 'w-full',
    },
    pointer:
    {
        active : true,
        modifier : 'absolute overflow-hidden'
    },
    hide : {active:false},
    event : {},
    data : {overbox : 'sf-overbox'}
};

SF.Param.Overbox = Overbox;
