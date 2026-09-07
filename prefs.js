import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {clearToken, lookupToken, storeToken} from './secret.js';
import {
    DEFAULT_COLOR_THRESHOLDS,
    numericValue,
    parseColorThresholds,
} from './format.js';

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

function colorToHex(color) {
    const component = value => Math.round(value * 255)
        .toString(16).padStart(2, '0');
    return `#${component(color.red)}${component(color.green)}${component(color.blue)}`;
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
        const entityRow = addTextRow(
            sensorGroup,
            settings,
            'entity-id',
            'Entity ID',
            'For example: sensor.outdoor_temperature');
        const attributeRow = addTextRow(
            sensorGroup,
            settings,
            'attribute',
            'Attribute path (optional)',
            'Leave empty for the state. Dotted paths such as forecast.today.temperature are supported.');
        const invalidateNumericValue = () => {
            settings.set_boolean('selected-value-is-numeric', false);
            settings.set_boolean('color-thresholds-enabled', false);
        };
        entityRow.connect('changed', invalidateNumericValue);
        attributeRow.connect('changed', invalidateNumericValue);

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

        const colorGroup = new Adw.PreferencesGroup({
            title: 'Value colors',
            description: 'Color numeric panel values according to configurable thresholds.',
        });
        const colorEnabledRow = new Adw.SwitchRow({
            title: 'Enable threshold colors',
        });
        settings.bind(
            'color-thresholds-enabled',
            colorEnabledRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind(
            'selected-value-is-numeric',
            colorEnabledRow,
            'sensitive',
            Gio.SettingsBindFlags.GET);
        colorGroup.add(colorEnabledRow);

        const updateColorAvailability = () => {
            const available = settings.get_boolean('selected-value-is-numeric');
            colorEnabledRow.subtitle = available
                ? 'The panel label uses the color of the matching threshold.'
                : 'Available after the selected state or attribute returns a numeric value.';
            if (!available)
                settings.set_boolean('color-thresholds-enabled', false);
        };
        settings.connect(
            'changed::selected-value-is-numeric',
            updateColorAvailability);
        updateColorAvailability();

        let thresholds = parseColorThresholds(
            settings.get_string('color-thresholds'));
        if (thresholds.length === 0)
            thresholds = DEFAULT_COLOR_THRESHOLDS.map(threshold => ({...threshold}));

        const editors = [];
        let addThresholdRow = null;
        const saveThresholds = () => {
            settings.set_string('color-thresholds', JSON.stringify(
                editors.map(editor => editor.threshold)));
        };
        const updateThresholdRows = () => {
            for (const [index, editor] of editors.entries()) {
                editor.row.title = `Threshold ${index + 1}`;
                editor.removeButton.sensitive = editors.length > 1;
            }
        };
        const addThresholdEditor = threshold => {
            const editorThreshold = {...threshold};
            const row = new Adw.EntryRow({
                title: `Threshold ${editors.length + 1}`,
                input_purpose: Gtk.InputPurpose.NUMBER,
            });
            row.text = String(editorThreshold.value);

            const color = new Gdk.RGBA();
            color.parse(editorThreshold.color);
            const colorButton = new Gtk.ColorButton({
                rgba: color,
                use_alpha: false,
                valign: Gtk.Align.CENTER,
                tooltip_text: 'Choose threshold color',
            });
            row.add_suffix(colorButton);

            const removeButton = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: 'Remove threshold',
                css_classes: ['flat'],
            });
            row.add_suffix(removeButton);

            const editor = {row, removeButton, threshold: editorThreshold};
            editors.push(editor);
            row.connect('changed', entry => {
                const value = numericValue(entry.text);
                if (value === null) {
                    entry.add_css_class('error');
                    return;
                }
                entry.remove_css_class('error');
                editorThreshold.value = value;
                saveThresholds();
            });
            colorButton.connect('color-set', button => {
                editorThreshold.color = colorToHex(button.rgba);
                saveThresholds();
            });
            removeButton.connect('clicked', () => {
                if (editors.length === 1)
                    return;
                editors.splice(editors.indexOf(editor), 1);
                colorGroup.remove(row);
                updateThresholdRows();
                saveThresholds();
            });

            if (addThresholdRow)
                colorGroup.remove(addThresholdRow);
            colorGroup.add(row);
            if (addThresholdRow)
                colorGroup.add(addThresholdRow);
            updateThresholdRows();
        };

        for (const threshold of thresholds)
            addThresholdEditor(threshold);

        addThresholdRow = new Adw.ActionRow({
            title: 'Add threshold',
            subtitle: 'The highest threshold at or below the sensor value determines its color.',
            activatable: true,
        });
        addThresholdRow.add_suffix(new Gtk.Image({
            icon_name: 'list-add-symbolic',
        }));
        addThresholdRow.connect('activated', () => {
            const highestValue = Math.max(
                ...editors.map(editor => editor.threshold.value));
            const lastColor = editors.at(-1)?.threshold.color ?? '#2ec27e';
            addThresholdEditor({value: highestValue + 50, color: lastColor});
            saveThresholds();
        });
        colorGroup.add(addThresholdRow);

        page.add(connectionGroup);
        page.add(sensorGroup);
        page.add(displayGroup);
        page.add(colorGroup);
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
