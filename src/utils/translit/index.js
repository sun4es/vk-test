import escapeStringRegExp from 'escape-string-regexp';

import forward from './dictionary';

function createReverse(forward) {
    let reverse = {};
    for (let f of Object.keys(forward)) {
        if (forward[f]) {
            for (let r of forward[f].split('|')) {
                reverse[r] = reverse[r] ? reverse[r] + '|' + f : f;
            }
        }
    }
    return reverse;
}

function decompose(dictionary, str, set) {
    for (let f of Object.keys(dictionary)) {
        if (f !== str && str.indexOf(f) !== -1) {
            for (let r of dictionary[f].split('|')) {
                let newStr = str.replace(f, r);
                if (!set.has(newStr)) {
                    set.add(newStr);
                    decompose(dictionary, newStr, set);
                }
            }
        }
    }
}

function expand(dictionary) {
    let dictionaryCopy = Object.assign({}, dictionary);
    for (let f of Object.keys(dictionaryCopy)) {
        let fe = f + '|' + dictionaryCopy[f];
        if (f.length > 1) {
            let decomposed = new Set();
            decompose(dictionary, f, decomposed);
            fe = fe + (decomposed.size ? '|' + Array.from(decomposed).join('|') : '');
        }
        dictionaryCopy[f] = fe
    }
    return dictionaryCopy;
}

let reverse = createReverse(forward);

export const dictionary = Object.assign({}, expand(forward), expand(reverse));
const letters = new RegExp('(' + Object.keys(dictionary).sort((a, b) => b.length - a.length).join('|') + ')', 'gi');

export const createRegExp = filter => {
    return new RegExp('^' + escapeStringRegExp(filter).replace(letters, (...b) => ('(?:' + dictionary[b[1].toLowerCase()]) + ')'), 'gi');
}