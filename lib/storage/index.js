'use strict';

var Svn = require('./svn'),
    Local = require('./local');

module.exports = function (options) {
    if (options.type === 'svn') {
        return new Svn(options);
    } if (options.type === 'local') {
        return new Local(options);
    } else {
        return options;
    }
};
