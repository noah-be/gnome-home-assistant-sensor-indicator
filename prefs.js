import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {clearToken, lookupToken, storeToken} from './secret.js';

function addTextRow(group, settings, key, title, subtitle) {
    const row = new Adw.EntryRow({title});
    row.text = settings.get_string(key);
    row.connect('changed', entry => settings.set_string(key, entry.text.trim()));
    if (subtitle)
        row.add_prefix(new Gtk.Image({
            icon_name: 'dialog-information-symbolic',
            tooltip_text: subtitle,
        }));
    group.add(row);
    return row;
}

export default class HomeAssistantSensorIndicatorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings;
        window.set_default_size(680, 720);
        window.search_enabled = true;

        const page = new Adw.PreferencesPage({
            title: 'Home Assistant Sensor Indicator',
            icon_name: 'user-home-symbolic',
        });

        const connectionGroup = new Adw.PreferencesGroup({
            title: 'Connection',
            description: 'Connect to the same URL you use to open Home Assistant.',
        });
        addTextRow(
            connectionGroup,
            settings,
            'base-url',
            'Home Assistant URL',
            'For example: https://homeassistant.example.com or http://192.168.1.10:8123');

        const tokenRow = new Adw.PasswordEntryRow({
            title: 'Long-lived access token',
            show_apply_button: true,
        });
        connectionGroup.add(tokenRow);

        const statusRow = new Adw.ActionRow({
            title: 'Credential status',
            subtitle: 'Checking the GNOME keyring…',
        });
        const removeButton = new Gtk.Button({
            label: 'Remove token',
            valign: Gtk.Align.CENTER,
            sensitive: false,
        });
        removeButton.connect('clicked', () => {
            removeButton.sensitive = false;
            statusRow.subtitle = 'Removing token…';
            clearToken((_removed, error) => {
                statusRow.subtitle = error
                    ? `Could not remove token: ${error.message}`
                    : 'No token is stored.';
                removeButton.sensitive = Boolean(error);
                tokenRow.text = '';
                if (!error)
                    this._bumpCredentialRevision(settings);
            });
        });
        statusRow.add_suffix(removeButton);
        connectionGroup.add(statusRow);
        tokenRow.connect('apply', row =>
            this._saveToken(row, statusRow, removeButton, settings));

        lookupToken(null, (token, error) => {
            statusRow.subtitle = error
                ? `Could not access the keyring: ${error.message}`
                : token
                    ? 'A token is stored securely in the GNOME keyring.'
                    : 'No token is stored.';
            removeButton.sensitive = Boolean(token) && !error;
        });

        const sensorGroup = new Adw.PreferencesGroup({
            title: 'Sensor',
            description: 'Select any Home Assistant entity state or one of its attributes.',
        });
        addTextRow(
            sensorGroup,
            settings,
            'entity-id',
            'Entity ID',
            'For example: sensor.outdoor_temperature');
        addTextRow(
            sensorGroup,
            settings,
            'attribute',
            'Attribute path (optional)',
            'Leave empty for the state. Dotted paths such as forecast.today.temperature are supported.');

        const displayGroup = new Adw.PreferencesGroup({
            title: 'Panel display',
            description: 'Customize how the value appears in the GNOME top panel.',
        });
        addTextRow(
            displayGroup,
            settings,
            'display-name',
            'Display name (optional)',
            'Overrides the friendly name returned by Home Assistant');
        addTextRow(
            displayGroup,
            settings,
            'label-template',
            'Label template',
            'Available placeholders: {name}, {value}, {unit}, and {entity}');

        const decimalValues = [-1, 0, 1, 2, 3, 4, 5, 6];
        const decimalRow = new Adw.ComboRow({
            title: 'Decimal places',
            subtitle: 'Applies when the selected value is numeric',
            model: Gtk.StringList.new([
                'As provided', '0', '1', '2', '3', '4', '5', '6',
            ]),
        });
        decimalRow.selected = Math.max(
            0,
            decimalValues.indexOf(settings.get_int('decimal-places')));
        decimalRow.connect('notify::selected', row => {
            settings.set_int('decimal-places', decimalValues[row.selected]);
        });
        displayGroup.add(decimalRow);

        const iconRow = new Adw.SwitchRow({
            title: 'Show icon',
            subtitle: 'Display a symbolic home icon beside the sensor value',
        });
        settings.bind('show-icon', iconRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        displayGroup.add(iconRow);

        const refreshRow = new Adw.SpinRow({
            title: 'Refresh interval (seconds)',
            subtitle: 'Time between automatic updates (5 seconds to 1 hour)',
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 3600,
                step_increment: 5,
                page_increment: 30,
                value: settings.get_uint('refresh-interval'),
            }),
            digits: 0,
            numeric: true,
        });
        refreshRow.connect('notify::value', row => {
            settings.set_uint('refresh-interval', Math.round(row.value));
        });
        displayGroup.add(refreshRow);

        page.add(connectionGroup);
        page.add(sensorGroup);
        page.add(displayGroup);
        window.add(page);
    }

    _saveToken(tokenRow, statusRow, removeButton, settings) {
        const token = tokenRow.text.trim();
        if (!token) {
            statusRow.subtitle = 'Enter a token before applying.';
            return;
        }

        statusRow.subtitle = 'Saving token in the GNOME keyring…';
        storeToken(token, (_stored, error) => {
            statusRow.subtitle = error
                ? `Could not save token: ${error.message}`
                : 'The token is stored securely in the GNOME keyring.';
            if (!error) {
                tokenRow.text = '';
                removeButton.sensitive = true;
                this._bumpCredentialRevision(settings);
            }
        });
    }

    _bumpCredentialRevision(settings) {
        const revision = settings.get_uint('credential-revision');
        settings.set_uint('credential-revision', (revision + 1) >>> 0);
    }
}
