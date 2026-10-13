
export default function cloneDeep(target, object)
{
    for(let key in object)
    {
        if(Object.prototype.hasOwnProperty.call(object, key))
        {
            if(typeof(object[key]) == 'object' && object[key].nodeName == undefined)
            {
                if(!target[key])
                {
                    target[key] = {}
                }

                SF.cloneDeep(target[key], object[key])
            }
            else
            {
                target[key] = object[key];
            }
        }
    }

    return target;
}

SF.cloneDeep = cloneDeep;
