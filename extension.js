import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup?version=3.0';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {buildDisplay} from './format.js';
import {lookupToken} from './secret.js';

const MIN_REFRESH_SECONDS = 5;
const REQUEST_TIMEOUT_SECONDS = 15;

const HomeAssistantSensorIndicator = GObject.registerClass(
class HomeAssistantSensorIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, extension.metadata.name, false);

        this._extension = extension;
        this._settings = extension.getSettings();
        this._session = new Soup.Session({
            timeout: REQUEST_TIMEOUT_SECONDS,
            user_agent: `${extension.metadata.name}/${extension.metadata.version}`,
        });
        this._timeoutId = 0;
        this._settingsRefreshId = 0;
        this._settingsChangedId = 0;
        this._running = false;
        this._refreshPending = false;
        this._destroyed = false;
        this._cancellable = null;
        this._lastEntity = null;

        this._box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        this._icon = new St.Icon({
            icon_name: 'user-home-symbolic',
            style_class: 'system-status-icon',
        });
        this._label = new St.Label({
            text: 'Home Assistant …',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._box.add_child(this._icon);
        this._box.add_child(this._label);
        this.add_child(this._box);

        this._nameItem = this._addInformationalItem('Entity: —');
        this._valueItem = this._addInformationalItem('Value: —');
        this._changedItem = this._addInformationalItem('Changed: —');
        this._updatedItem = this._addInformationalItem('Updated: —');

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._openItem = new PopupMenu.PopupMenuItem('Open Home Assistant');
        this._openItem.connect('activate', () => this._openHomeAssistant());
        this.menu.addMenuItem(this._openItem);

        const refreshItem = new PopupMenu.PopupMenuItem('Refresh now');
        refreshItem.connect('activate', () => this.refresh());
        this.menu.addMenuItem(refreshItem);

        const preferencesItem = new PopupMenu.PopupMenuItem('Preferences');
        preferencesItem.connect('activate', () => this._extension.openPreferences());
        this.menu.addMenuItem(preferencesItem);

        this._settingsChangedId = this._settings.connect('changed',
            (_settings, key) => this._onSettingChanged(key));

        this._applyVisualSettings();
        this._scheduleRefresh();
        this.refresh();
    }

    _addInformationalItem(text) {
        const item = new PopupMenu.PopupMenuItem(text, {
            reactive: false,
            can_focus: false,
        });
        this.menu.addMenuItem(item);
        return item;
    }

    _onSettingChanged(key) {
        if (key === 'refresh-interval') {
            this._scheduleRefresh();
            return;
        }

        const visualKeys = new Set([
            'attribute',
            'decimal-places',
            'display-name',
            'label-template',
            'show-icon',
        ]);
        if (visualKeys.has(key))
            this._applyVisualSettings();

        if (key === 'base-url' || key === 'entity-id' ||
            key === 'credential-revision')
            this._queueRefresh();
    }

    _applyVisualSettings() {
        this._icon.visible = this._settings.get_boolean('show-icon');
        if (this._lastEntity)
            this._showEntity(this._lastEntity);
    }

    _scheduleRefresh() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }

        const configured = this._settings.get_uint('refresh-interval');
        const interval = Math.max(MIN_REFRESH_SECONDS, configured);
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this.refresh();
                return GLib.SOURCE_CONTINUE;
            });
        GLib.Source.set_name_by_id(
            this._timeoutId,
            '[home-assistant-sensor-indicator] refresh');
    }

    _queueRefresh() {
        if (this._settingsRefreshId)
            GLib.source_remove(this._settingsRefreshId);

        this._settingsRefreshId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            500,
            () => {
                this._settingsRefreshId = 0;
                this.refresh();
                return GLib.SOURCE_REMOVE;
            });
        GLib.Source.set_name_by_id(
            this._settingsRefreshId,
            '[home-assistant-sensor-indicator] settings refresh');
    }

    refresh() {
        if (this._destroyed)
            return;
        if (this._running) {
            this._refreshPending = true;
            return;
        }

        const baseUrl = this._settings.get_string('base-url').trim();
        const entityId = this._settings.get_string('entity-id').trim();
        if (!baseUrl || !entityId) {
            this._showError('Open Preferences and configure the Home Assistant URL and entity ID.');
            return;
        }

        this._running = true;
        this._label.text = 'Home Assistant …';
        this._cancellable = new Gio.Cancellable();

        lookupToken(this._cancellable, (token, error) => {
            if (this._destroyed)
                return;
            if (error) {
                this._finishWithError(`Could not access the keyring: ${error.message}`);
                return;
            }
            if (!token) {
                this._finishWithError('No access token is stored. Open Preferences to add one.');
                return;
            }

            this._requestEntity(baseUrl, entityId, token);
        });
    }

    _requestEntity(baseUrl, entityId, token) {
        const url = `${baseUrl.replace(/\/+$/, '')}/api/states/${encodeURIComponent(entityId)}`;
        const message = Soup.Message.new('GET', url);
        if (!message) {
            this._finishWithError('The Home Assistant URL is invalid.');
            return;
        }

        message.request_headers.append('Authorization', `Bearer ${token}`);
        message.request_headers.append('Accept', 'application/json');

        this._session.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            this._cancellable,
            (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    const body = new TextDecoder().decode(bytes.get_data());

                    if (message.status_code === Soup.Status.UNAUTHORIZED)
                        throw new Error('Home Assistant rejected the access token.');
                    if (message.status_code === Soup.Status.NOT_FOUND)
                        throw new Error(`Entity “${entityId}” was not found.`);
                    if (message.status_code < 200 || message.status_code >= 300)
                        throw new Error(`Home Assistant returned HTTP ${message.status_code}.`);

                    const entity = JSON.parse(body);
                    if (!entity || typeof entity.state !== 'string' || !entity.entity_id)
                        throw new Error('Home Assistant returned an unexpected response.');

                    if (!this._destroyed)
                        this._showEntity(entity);
                } catch (error) {
                    if (!this._destroyed &&
                        !error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        this._showError(error.message);
                } finally {
                    this._endRefresh();
                }
            });
    }

    _finishWithError(message) {
        this._showError(message);
        this._endRefresh();
    }

    _endRefresh() {
        this._running = false;
        this._cancellable = null;
        if (this._refreshPending && !this._destroyed) {
            this._refreshPending = false;
            this._queueRefresh();
        }
    }

    _showEntity(entity) {
        let display;
        try {
            display = buildDisplay(entity, {
                attribute: this._settings.get_string('attribute'),
                decimalPlaces: this._settings.get_int('decimal-places'),
                displayName: this._settings.get_string('display-name'),
                template: this._settings.get_string('label-template'),
            });
        } catch (error) {
            this._lastEntity = entity;
            this._showError(error.message, true);
            return;
        }

        this._lastEntity = entity;
        this._label.text = display.label || display.value || entity.entity_id;
        this._label.remove_style_class_name('home-assistant-indicator-error');
        this._nameItem.label.text = `Entity: ${display.name} (${entity.entity_id})`;
        this._valueItem.label.text = display.attribute
            ? `Attribute ${display.attribute}: ${display.value}`
            : `State: ${display.value}${display.unit ? ` ${display.unit}` : ''}`;
        this._changedItem.label.text = `Changed: ${this._formatTimestamp(entity.last_changed)}`;
        this._updatedItem.label.text = `Updated: ${this._formatTimestamp(entity.last_updated)}`;
    }

    _showError(message, preserveEntity = false) {
        if (!preserveEntity)
            this._lastEntity = null;
        this._label.text = 'Home Assistant !';
        this._label.add_style_class_name('home-assistant-indicator-error');
        this._nameItem.label.text = 'Sensor unavailable';
        this._valueItem.label.text = message || 'Unknown error';
        this._changedItem.label.text = 'Check the connection settings and entity ID.';
        this._updatedItem.label.text = 'Use “Refresh now” to retry.';
    }

    _formatTimestamp(timestamp) {
        if (!timestamp)
            return 'unknown';
        const date = GLib.DateTime.new_from_iso8601(timestamp, null);
        if (!date)
            return timestamp;
        const local = date.to_local();
        return local.format('%c') ?? timestamp;
    }

    _openHomeAssistant() {
        const baseUrl = this._settings.get_string('base-url').trim();
        if (!baseUrl)
            return;

        const entityId = this._settings.get_string('entity-id').trim();
        const path = entityId
            ? `/config/entities/entity/${encodeURIComponent(entityId)}`
            : '';
        try {
            Gio.AppInfo.launch_default_for_uri(
                `${baseUrl.replace(/\/+$/, '')}${path}`,
                global.create_app_launch_context(0, -1));
        } catch (error) {
            this._showError(`Could not open Home Assistant: ${error.message}`);
        }
    }

    destroy() {
        this._destroyed = true;

        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._settingsRefreshId) {
            GLib.source_remove(this._settingsRefreshId);
            this._settingsRefreshId = 0;
        }
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }
        if (this._cancellable)
            this._cancellable.cancel();

        this._session?.abort();
        this._session = null;
        this._settings = null;
        this._extension = null;
        super.destroy();
    }
});

export default class HomeAssistantSensorIndicatorExtension extends Extension {
    enable() {
        this._indicator = new HomeAssistantSensorIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
