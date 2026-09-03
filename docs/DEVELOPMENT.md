# Development

## Validate changes

```console
make validate
```

Validation checks the JSON files, JavaScript syntax, GSettings schema, and pure
formatting tests. It does not contact Home Assistant.

## Install a development build

```console
make install
```

Log out and back in after the first installation on Wayland. Later updates can
usually be loaded by disabling and enabling the extension, although GNOME Shell
may retain imported JavaScript modules until the next login.

View Shell logs with:

```console
journalctl --user -f -o cat /usr/bin/gnome-shell
```

View preference-process logs with:

```console
journalctl --user -f -o cat /usr/bin/gjs
```

## Build a release archive

```console
make pack
```

The extension archive is written to `dist/`.
