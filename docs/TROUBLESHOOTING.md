# Troubleshooting

## The panel shows `Home Assistant !`

Open the indicator menu to read the detailed error, then select **Refresh now**
after correcting the configuration.

Common causes are:

- The Home Assistant URL is not reachable from the desktop.
- The URL includes an API path. Configure only the base URL, without `/api`.
- The access token was copied incompletely, expired, or revoked.
- The entity ID does not exist or is not visible to the token's user.
- The configured attribute path does not exist in the entity attributes.

## The extension is installed but absent

GNOME Wayland normally discovers newly installed native extensions only after a
logout and login. To use the indicator immediately, enable AppIndicator support
and start the included temporary process:

```console
gnome-extensions enable appindicatorsupport@rgcjonas.gmail.com
./bin/home-assistant-sensor-tray
```

The temporary indicator shares all settings and the keyring token with the native
extension. It also has a **Preferences** item for initial configuration.

## The preferences cannot access the keyring

The extension requires a Secret Service implementation and the libsecret GObject
introspection package. Both are normally present on GNOME desktops. On minimal or
custom installations, install the distribution packages that provide
`org.freedesktop.secrets` and the `Secret-1.typelib` file, then log out and back
in.

## Inspect the Home Assistant response

Use Home Assistant's **Developer Tools → States** page to verify the exact entity
ID, state, attributes, and attribute nesting. This avoids putting a token into a
shell command or terminal history.

## View extension logs

```console
journalctl --user -f -o cat /usr/bin/gnome-shell
```

Before sharing logs, remove private URLs, IP addresses, entity names, and any
other details that identify the home network.
