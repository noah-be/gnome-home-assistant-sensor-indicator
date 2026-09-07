# Architecture

The extension consists of four small modules:

- `extension.js` owns the panel indicator, menu, refresh timer, and asynchronous
  Home Assistant REST request.
- `prefs.js` provides the Libadwaita preferences UI.
- `secret.js` is the single boundary for storing and retrieving the access token
  through libsecret.
- `format.js` selects attributes and converts Home Assistant responses into panel
  labels. It also validates numeric values and selects threshold colors. It has
  no GNOME dependencies and is covered by unit tests.
- `bin/home-assistant-sensor-tray` provides a temporary AppIndicator with its own
  GTK preferences dialog for use before GNOME loads a newly installed extension.
  It shares the native extension's settings schema and keyring item.

## Refresh flow

1. The timer or **Refresh now** starts an update.
2. The extension reads the access token from the GNOME keyring.
3. libsoup sends an asynchronous, read-only request to
   `GET /api/states/<entity_id>`.
4. The response is validated and passed to the formatting module.
5. The panel label, optional numeric threshold color, and detail menu are updated.

Only one refresh can run at a time. Disabling the extension cancels the active
request, aborts the HTTP session, disconnects settings signals, and removes the
timer.
