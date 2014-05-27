'use strict';

/*
 В качестве хранилища используется локальная директория
 */

var join = require('path').join,
    exec = require('child_process').exec,
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

    this._path = options.path;
    this._readonly = !!options.readonly;
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
        var cmd = 'tar -xf ' + join(this._path, name, name) + '.tar -C ' + path + '  --no-same-permissions';
        this.emit('log', cmd);
        exec.sync(null, cmd);

        return null;
    }
    catch(e) {
        this.emit('log', ['Can\'t pull ', name, ' from local storage ', '(', this._path, ')'].join(''));

        return e;
    }
};

/**
 * Сохраняет пакет в локальном хранилище
 * @param {String} path путь к пакету
 * @param {String} name имя пакета
 * @returns {null}
 */
Local.prototype.push = function(path, name) {
    if (this._readonly) {
        this.emit('log', 'Local storage ' + this._path + ' in readonly mode. Skip push.');

        return null;
    }

    try {
        this.emit('log', 'Try to copy ' + name + ' to local storage ' + this._path);

        fs.copy.sync(fs, path, join(this._path, name));

        return null;
    }
    catch(e) {
        this.emit('log', ['Can\'t push ', name, 'to local storage ', '(', this._path, ')'].join(''));

        return e;
    }
};


module.exports = Local;
