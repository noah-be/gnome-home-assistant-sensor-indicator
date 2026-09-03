# Changelog

All notable changes to this project will be documented in this file.

## 1.1.1 - 2026-09-03

- Use a private runtime temporary directory so the GTK preferences dialog still
  opens when the shared `/tmp` user quota is exhausted.

## 1.1.0 - 2026-09-03

- Add a temporary AppIndicator with a standalone preferences dialog for immediate
  use without logging out of a Wayland session.

## 1.0.0 - 2026-09-03

- Add support for displaying any Home Assistant entity state.
- Add nested attribute selection and customizable panel templates.
- Add numeric formatting and configurable refresh intervals.
- Store access tokens securely in the GNOME keyring.
- Add GNOME Shell 45 through 50 support.
