'use strict';

/*
 В качестве хранилища используется локальная директория
 */

var join = require('path').join,
    fs = require('fs-extra'),
    util = require('util'),
    events = require('events');

/**
 * Конструктор локального хранилища
 * @param {Object} options параметры
 * @param {String} options.url ссылка на папку хранилища
 * @constructor
 */
function Local(options) {
    events.EventEmitter.call(this);

    this._url = options.url;
    this.type = 'local';
}

util.inherits(Local, events.EventEmitter);


/**
 * Получает пакет из хранилища
 * @param {String} path путь куда распаковать пакет
 * @param {String} name имя пакета в хранилище
 * @returns {Boolean}
 */
Local.prototype.pull = function(path, name) {
    try {
        fs.copy.sync(fs, join(url, name), path);
    }
    catch(e) {
        throw new Error(['Can\'t pull ', name, ' from local storage ', '(', url, ')'].join(''));
    }
};

/**
 * Сохраняет пакет в локальном хранилище
 * @param {String} path путь к пакету
 * @param {String} name имя пакета
 * @returns {null}
 */
Local.prototype.push = function(path, name) {
    try {
        fs.copy.sync(fs, path, join(url, name));

        return null;
    }
    catch(e) {
        throw new Error(['Can\'t push ', name, 'to local storage ',
            '(', url, ')'].join(''));
    }
};


module.exports = Local;
