'use strict';

/*
 В качестве хранилища используется SVN
 */


var exec = require('child_process').exec,
    join = require('path').join,
    fs = require('fs-extra'),
    util = require('util'),
    events = require('events');

/**
 * Конструктор  хранилища SVN
 * @param {Object} options параметры
 * @param {String} options.url ссылка на репозиторий
 * @constructor
 */
function Storage(options) {
    events.EventEmitter.call(this);

    this._url = options.url;

    // Добавляем слеш в конец, если его не было
    if (this._url[this._url.length - 1] != '/')
        this._url = this._url + '/';

    this.type = 'svn';
}

util.inherits(Storage, events.EventEmitter);

/**
 * Получает пакет из SVN хранилища
 * @param {String} path путь куда развернуть пакет
 * @param {String} name имя пакета
 */
Storage.prototype.pull = function(path, name) {
    var temp = join(process.cwd(), '__dobro_temp__', '.dobrosvntemp', name),
        cmd;

    fs.mkdirsSync(temp);
    cmd = 'svn checkout ' + this._url + name + ' ' + temp;
    this.emit('log', cmd);
    exec.sync(null, cmd);

    cmd = 'tar -xf ' + join(temp, name) + '.tar -C ' + path + '  --no-same-permissions';
    this.emit('log', cmd);
    exec.sync(null, cmd);

    fs.removeSync(temp);
};

/**
 * Отправляет пакет в хранилище
 * @param {String} path содержимое пакета
 * @param {String} name имя пакета
 */
Storage.prototype.push = function(path, name) {
    var temp = join(process.env.HOME, '.dobrosvntemp', name),
        cmd;

    fs.mkdirsSync(temp);
    cmd = 'tar -cf ' + join(temp, name) + '.tar -C ' + path + ' .';

    this.emit('log', cmd);
    exec.sync(null, cmd);

    cmd = 'svn import -m "Add ' + name + '" ' + temp + ' ' + this._url + name;
    this.emit('log', cmd);
    exec.sync(null, cmd);

    fs.removeSync(temp);
};


module.exports = Storage;
