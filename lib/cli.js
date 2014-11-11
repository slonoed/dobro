'use strict';

var join = require('path').join,
    sync = require('sync'),
    fs = require('fs-extra'),
    program = require('commander'),
    exec = require('child_process').exec;


var style = require('./style'),
    Dobro = require('./main'),
    cwd = process.cwd(),
    temp = join(process.cwd(), '__dobro_temp__'),
    bundle,
    dobro;

program
    .option('-v, --verbose', 'Full output')
    .option('-l, --local', 'Local install (storage not using)')
    .option('-n, --nopush', 'Use storage read only')
    .parse(process.argv);


// Начало выполнения.
// sync создает новый контекст выполнения и внетри метода
// могут выполняться синхронно через method.sync
// первый метод-параметр будет выполняться в этом контексте
// второй метод-параметр будет вызван по завершении (успешном или нет) первого метода
sync(function() {

    if (program.local) {
        console.log(style('red', 'Local mode is ON: dependencies will not added to storage'));
    }


    // Читаем файл конфига и если с ним проблема, то прекращаем работу
    try {
        bundle = JSON.parse(fs.readFileSync(join(process.cwd(), 'dobro.json')));
    } catch(e) {
        throw new Error('Cat\'t parse dobro.json, check this file');
    }

    console.time('Build time');

    dobro = new Dobro({
        cwd: process.cwd(),
        storage: bundle.storage
    });

    // Если был указан параметр -v, то делаем подробный вывод
    if (program.verbose)
        dobro.on('log', function(msg) {
            console.log('\t', 'dobro: ', msg);
        });

    fs.removeSync(temp);
    fs.mkdirpSync(temp);
    fs.mkdirpSync(join(temp, '.dobrosvntemp'));
    fs.mkdirpSync(join(temp, '.dobrolocaltemp'));


    bundle.dependencies.forEach(function(pack) {
        console.log('\nPack: %s', style('blue', pack.name));
        var packPath = join(temp, dobro.generatePackName(pack));

        // in local mode just install all deps
        if (program.local) {
            fs.mkdirsSync(packPath);
            // install package with it deps
            dobro.install(packPath, pack);
            fs.copy.sync(fs, packPath, process.cwd());

            // try to install from storages
        } else if (dobro.installFromStorage(pack)) {

            // if error -> full install

            // создаем временную папку для пакета
            fs.mkdirsSync(packPath);

            // install package to this temp folder
            dobro.install(packPath, pack);

            // if no push flag - just copy to project
            if (program.nopush) {
                fs.copy.sync(fs, packPath, process.cwd());
            } else {
                // save to storage
                dobro.saveToStorage(packPath, pack);
                // install from storage again
                if (dobro.installFromStorage(pack)) {
                    throw new Error('Package ' + pack.name + '@' + pack.version + ' not installed');
                }
            }
        }

        console.log('%s ready', style('green', program.verbose ? dobro.generatePackName(pack) : pack.name));
    });

}, function(err) {

    // удаляем временную папку
    fs.removeSync(temp);

    if (err) {
        console.log(style('red', 'ERROR ' + err), '\n' + err.stack);

        process.exit(1);
    }

    console.timeEnd('Build time')
});
