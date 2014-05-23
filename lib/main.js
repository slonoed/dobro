'use strict';

var join = require('path').join,
    fs = require('fs-extra'),
    exec = require('child_process').exec,
    util = require('util'),
    events = require('events');

/**
 * Конструктор сборщика
 * @param {Object} options параметры
 * @param {String} options.cwd рабочая директория
 * @param {Object} options.storage конфиг хранилища
 * @constructor
 */
function Dobro(options) {
    options = options || {};

    this._cwd = options.cwd;

    this._storage = require('./storage')(options.storage);

    this._storage.on('log', function(msg) {
        this.emit('log', this._storage.type + ' storage: ' + msg);
    }.bind(this));
}

util.inherits(Dobro, events.EventEmitter);

/**
 * Возвращает md5 от полученого значения
 * @param {String} str исходная строка
 * @returns {String}
 */
Dobro.prototype.md5 = function(str) {
    return require('crypto')
        .createHash('md5')
        .update(str)
        .digest('hex');
};

/**
 * Возвращает md5 хеш от текущего бандла
 * @param {Array} bundle конфиг бандла
 * @returns {String}
 */
Dobro.prototype.calculateBundleHash = function(bundle) {
    return this.md5(bundle
        .sort(function(a, b) {
            if (a.name > b.name)
                return 1;
            if (a.name < b.name)
                return -1;
            return 0;
        })
        .reduce(function(memo, pack) {
            return Object.keys(pack)
                .sort()
                .reduce(function(memo, key) {
                    return memo + key + pack[key];
                }, memo);
        }, ''));
};

/**
 * Генерирует уникальное имя для конкретного пакета (без учета версии)
 * @param {Object} pack пакет
 * @returns {String}
 */
Dobro.prototype.generatePackName = function(pack) {
    switch (pack.type) {
        case 'git':
            return pack.name + '_' + this.md5(pack.repo) + '_' + pack.commit;
        case 'svn':
            return pack.name + '_' + pack.revision;
        default:
            return pack.name + '_' + pack.version;
    }
};


/**
 * Полная установка пакета + сохранение в хранилище
 * @param {Object} pack пакет
 */
Dobro.prototype.fullInstall = function(packPath, pack) {

    // устанавливаем в эту папку пакет с его путями
    this.install(packPath, pack);
    // сохраняем папку в хранилище
    this.saveToStorage(packPath, pack);
    // устанавливаем из хранилища повторно
    this.installFromStorage(pack);
};


/**
 * Устанавливает пакет из хранилища. Вернет null, если успешно или ошибку
 * @param {Object} pack пакет
 * @returns {Boolean}
 */
Dobro.prototype.installFromStorage = function(pack) {
    try {
        this._storage.pull(this._cwd, this.generatePackName(pack));
        return null;
    } catch(e) {
        this.emit('log', 'svn error ' + e);

        return e;
    }
};

/**
 * Отправляет установленый пакет в хранилище
 * @param {String} path путь до установленого пакета
 * @param {Object} pack пакет
 * @returns {*}
 */
Dobro.prototype.saveToStorage = function(path, pack) {
    return this._storage.push(path, this.generatePackName(pack));
};

/**
 * Устанавливает пакет в указаную папку
 * @param {String} path путь для установки
 * @param {Object} pack пакет
 */
Dobro.prototype.install = function(path, pack) {

    // Устанавливаем, в зависимости от типа
    if (pack.type === 'git') {
        this._installByGit(path, pack);
    } else if (pack.type === 'svn') {
        this._installBySvn(path, pack);
    } else {
        this._installByNpm(path, pack);
    }

};

/**
 * Устанавливает пакет из GIT репозитория
 * @param {String} packTempPath путь для установки
 * @param {Object} pack пакет
 * @returns {null}
 * @private
 */
Dobro.prototype._installByGit = function(packTempPath, pack) {
    var repoPath = join(packTempPath, pack.dest || '.', pack.name),
        cmd = 'git clone ' + pack.repo + ' ' + repoPath;

    this.emit('log', 'Clone %s from GIT', pack.name);

    if (pack.dest)
        fs.mkdirsSync(join(packTempPath, pack.dest));

    try {

        this._exec(cmd);

        if (pack.commit)
            this._exec('(cd ' + repoPath + ' && git checkout ' + pack.commit + ')');

        fs.remove.sync(fs, join(repoPath, '.git'));
    } catch(e) {
        throw new Error('cant install ' + pack.name + ' from git.\n' + e);
    }

    return null;
};

/**
 * Устанавливает пакет с помощью NPM
 * @param {String} packTempPath путь для установки
 * @param {Object} pack пакет
 * @returns {null}
 * @private
 */
Dobro.prototype._installByNpm = function(packTempPath, pack) {
    this.emit('log', 'Install %s from NPM ' + pack.name);

    // создаем временную директорию для пакета
    fs.mkdirsSync(join(packTempPath, 'node_modules'));

    return this._exec('npm --prefix ' + packTempPath + ' install ' + pack.name + '@' + pack.version);
};

/**
 * Устанавливает пакет из SVN репозитория
 * @param {String} packTempPath путь для установки
 * @param {Object} pack пакет
 * @returns {null}
 * @private
 */
Dobro.prototype._installBySvn = function(packTempPath, pack) {
    var repoPath = join(packTempPath, pack.dest || '.', pack.name),
        cmd = 'svn checkout ' + pack.url + ' -' + pack.revision + ' ' + repoPath;

    this.emit('log', 'Checkout %s from SVN ' + pack.name);

    if (pack.dest)
        fs.mkdirsSync(join(packTempPath, pack.dest));

    return this._exec(cmd);
};


/**
 * Выполняет команду синхронно
 * @param {String} cmd команда
 * @returns {*}
 */
Dobro.prototype._exec = function(cmd) {
    this.emit('log', 'exec: ' + cmd);

    return exec.sync(null, cmd);
};


module.exports = Dobro;
