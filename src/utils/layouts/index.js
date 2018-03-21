import escapeStringRegExp from 'escape-string-regexp';

import layouts from './layouts';

const layoutRegExps = Object.entries(layouts)
    .map(([key, value]) => 
        [key, value + value.toUpperCase()])
    .map(([key, value]) =>    
        [key, value, new RegExp('[' + escapeStringRegExp(value) + ']', 'gi')])
    .reduce((layoutRegExps, [key, value, regExp]) => {
        layoutRegExps[key] = { value, regExp };
        return layoutRegExps;
    }, {});

export const getAllLayouts = str => Object.entries(layoutRegExps)
    .map(([key, { value: toValue }]) => 
        ({ locale: key, value: Object.entries(layoutRegExps)
            .reduce((str, [key, { value: fromValue, regExp }]) =>
                str.replace(regExp, c => toValue[fromValue.indexOf(c)]),
                str
            )})
    );