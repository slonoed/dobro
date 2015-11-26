'use strict';

var join = require('path').join,
    fs = require('fs-extra'),
    exec = require('child_process').exec,
    util = require('util'),
    events = require('events'),
    createStorage = require('./storage'),
    _ = require('lodash');

/**
 * Конструктор сборщика
 * @param {Object} options параметры
 * @param {String} options.cwd рабочая директория
 * @param {Object} options.storage конфиг хранилища
 * @constructor
 */
function Dobro(options) {
    options = options || {};

    options.storage = _.isArray(options.storage) ? options.storage : [options.storage];

    this._cwd = options.cwd;

    this._storages = options.storage.map(function(s) {
        var storageInstance = createStorage(s);

        storageInstance.on('log', function(msg) {
            this.emit('log', s.type + ' storage: ' + msg);
        }.bind(this));

        return storageInstance;
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
            if (!/^[0-9\.\-]+$/.test(pack.version))
                throw new Error('Wrong package version ' + pack.version + '. Version must be strong. ' +
                    'Use only dot and numbers in version field.');

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
 * Trying to install package from storages. Stop working when get first success.
 * Return null or error.
 * @param {Object} pack package
 * @returns {*}
 */
Dobro.prototype.installFromStorage = function(pack) {
    var error = null;

    for (var i = 0, max = this._storages.length; i < max; i++) {
        error = this._storages[i].pull(this._cwd, this.generatePackName(pack));

        if (!error) break;
    }

    return error;
};

/**
 * Send package to all storages. Return null if all success, or error;
 * @param {String} path path to installed package
 * @param {Object} pack package
 * @returns {null|String}
 */
Dobro.prototype.saveToStorage = function(path, pack) {
    return _.some(_.invoke(this._storages, 'push', path, this.generatePackName(pack))) ?
        'Can\'t install to all storages' :
        null;
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

    // Процедура postinstall по требованию
    if (pack.postinstall) {
        this._exec(pack.postinstall);
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
    var filesPath = join(packTempPath, 'node_modules');

    this.emit('log', 'Install %s from NPM ' + pack.name);


    // создаем временную директорию для пакета
    fs.mkdirsSync(filesPath);

    this._exec('npm --prefix ' + packTempPath + ' install ' + pack.name + '@' + pack.version);

    // для случая с peerDependencies переносим их вутрь пакета
    fs.readdirSync(filesPath).forEach(function(subdir) {
        if (subdir === pack.name) return;

        var peerModulePath =  join(filesPath, subdir),
            moduleSubmodulesPath = join(filesPath, pack.name, 'node_modules', subdir);

        fs.copySync(peerModulePath, moduleSubmodulesPath);
        fs.remove.sync(fs, peerModulePath);
    })
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
