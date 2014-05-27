Tool for packing and storing deps of your project.
Read config from file `dobro.json` in current dir.

# dobro.json
Put config file into current directory.
Sample
```json
{
    "storage": [
        {
            "readonly": true,
            "type": "local",
            "path": "/Users/slonoed/bem-local-libs/"
        },
        {
            "type": "svn",
            "url": "svn+ssh:/mysvn/svn/libs-storage"
        }
    ],
    "dependencies": [
        {
            "name": "bem",
            "version": "0.6.16"
        },
        {
            "type": "git",
            "dest": "libs",
            "name": "lego",
            "repo": "git://github.yandex-team.ru/lego/romochka",
            "commit": "2.10.25"
        },
        {
            "type": "git",
            "dest": "libs",
            "name": "bem-mvc",
            "repo": "git://github.com/bem/bem-mvc",
            "commit": "d5884290c7f82316829546f6c7660cb25aad6771"
        },
        {
            "type": "svn",
            "dest": "libs",
            "name": "my-lib-from-svn",
            "url": "svn+ssh://svn.myserver.ru/lib",
            "revision": "r3571"
        }
    ]
}
```

`storage` section can be object-config or array of object-configs.

In this example each packages will be retrieve from local forder first, then from svn repo. If not find it will be installed and added to svn (local storage in readonly)
