

export default function extend(target, object) {
    for(let key in object) {
        if(Object.prototype.hasOwnProperty.call(object, key)) {
            ///if(typeof(object[key]) == 'object') {
                //SF.extend(target[key], object[key])
            //} else {
                target[key] = object[key];
            //}
        }
    }
    return target;
}

SF.extend = extend;
