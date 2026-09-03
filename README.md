# GNOME Home Assistant Sensor Indicator

[![CI](https://github.com/noah-be/gnome-home-assistant-sensor-indicator/actions/workflows/ci.yml/badge.svg)](https://github.com/noah-be/gnome-home-assistant-sensor-indicator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A small GNOME Shell extension that displays any Home Assistant entity state or
attribute in the top panel.

## Features

- Displays any Home Assistant entity, including sensors, binary sensors,
  switches, climate entities, and custom integrations.
- Can show the entity state or a nested attribute such as
  `forecast.today.temperature`.
- Supports configurable label templates with `{name}`, `{value}`, `{unit}`, and
  `{entity}` placeholders.
- Optionally rounds numeric values to zero through six decimal places.
- Refreshes automatically every 5 seconds to 1 hour and supports manual refresh.
- Shows entity details and Home Assistant timestamps in the indicator menu.
- Opens the configured entity directly in Home Assistant.
- Stores the access token in the GNOME keyring through libsecret.
- Has no telemetry and no runtime dependencies outside the GNOME platform.

## Requirements

- GNOME Shell 45 through 50.
- Home Assistant reachable from the desktop.
- A Home Assistant long-lived access token.
- The GNOME Secret Service and libsecret introspection package. These are
  installed by default on standard GNOME desktops.
- The optional immediate-start indicator additionally requires Python 3, GTK 3,
  AppIndicator 3, and their GObject-introspection bindings.

## Install from source

```console
git clone https://github.com/noah-be/gnome-home-assistant-sensor-indicator.git
cd gnome-home-assistant-sensor-indicator
make install
```

GNOME on Wayland does not support reloading Shell in place. Log out and back in
after the first installation, then enable the extension:

```console
make enable
```

Open its settings through the Extensions application or from a terminal:

```console
gnome-extensions prefs home-assistant-sensor-indicator@noah-be.github.io
```

### Start immediately without logging out

GNOME Wayland cannot load a newly installed native Shell extension into the
running session. If AppIndicator support is active, start the included temporary
indicator instead:

```console
./bin/home-assistant-sensor-tray
```

The temporary indicator uses the same GSettings values and GNOME-keyring token
as the native extension. Its menu contains **Preferences**, **Refresh now**, and
**Quit temporary indicator**, so it can be configured and used immediately. Quit
it after the native extension becomes available following a later login.

## Configure Home Assistant

1. In Home Assistant, open your profile and create a **Long-Lived Access Token**.
2. Open the extension preferences.
3. Enter the Home Assistant base URL, for example
   `https://homeassistant.example.com` or `http://192.168.1.10:8123`.
4. Enter an entity ID such as `sensor.outdoor_temperature`.
5. Enter the token and select the apply button inside the token field.

The default panel template is `{name}: {value} {unit}`. Leave **Attribute
path** empty to display the entity state. To display a nested attribute, enter
its dotted path.

The extension uses Home Assistant's documented
[`GET /api/states/<entity_id>` REST endpoint](https://developers.home-assistant.io/docs/api/rest/#get-apistatesentity_id)
and does not modify entity state.

Home Assistant must be reachable from the desktop. An `http://` URL sends the
access token without transport encryption, so use HTTPS outside a trusted local
network.

## Privacy and security

- The access token is stored in the user's GNOME keyring, not in GSettings or a
  project file.
- The token is sent only to the configured Home Assistant URL as a Bearer token.
- The extension performs only read-only `GET /api/states/<entity_id>` requests.
- No analytics or telemetry are collected.

See [Security](SECURITY.md) for vulnerability reporting and additional guidance.
See [Troubleshooting](docs/TROUBLESHOOTING.md) if the indicator cannot connect.

## Development

```console
make validate
make pack
```

See [Development](docs/DEVELOPMENT.md) and
[Architecture](docs/ARCHITECTURE.md) for more detail.

## License

[MIT](LICENSE)
