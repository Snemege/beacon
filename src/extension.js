import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {BeaconPopup} from './popup.js';
import {AppsProvider} from './providers/apps.js';
import {SettingsProvider} from './providers/settings.js';
import {FilesProvider} from './providers/files.js';
import {CalcProvider} from './providers/calc.js';
import {WebProvider} from './providers/web.js';
import {CommandProvider} from './providers/command.js';
import {CurrencyProvider} from './providers/currency.js';

export default class BeaconExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._providers = [];
        this._popup = new BeaconPopup(this._settings, this._providers);
        Main.layoutManager.uiGroup.add_child(this._popup);

        this._loadProviders();
        this._settingsId = this._settings.connect('changed', (_s, key) => {
            if (key.startsWith('enable-'))
                this._loadProviders();
        });

        // Tuş bağı adları mutter'da global; başka eklentilerle çakışmasın diye önekli
        Main.wm.addKeybinding('beacon-toggle', this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
            () => this._popup.toggle());
    }

    disable() {
        Main.wm.removeKeybinding('beacon-toggle');
        this._settings.disconnect(this._settingsId);
        this._popup.close();
        this._popup.destroy();
        this._popup = null;
        this._providers = null;
        this._settings = null;
    }

    // Sağlayıcı listesi popup ile paylaşılır, yerinde güncellenir
    _loadProviders() {
        this._providers.length = 0;
        if (this._settings.get_boolean('enable-apps'))
            this._providers.push(new AppsProvider());
        if (this._settings.get_boolean('enable-settings'))
            this._providers.push(new SettingsProvider());
        if (this._settings.get_boolean('enable-files'))
            this._providers.push(new FilesProvider());
        if (this._settings.get_boolean('enable-calc'))
            this._providers.push(new CalcProvider());
        if (this._settings.get_boolean('enable-currency'))
            this._providers.push(new CurrencyProvider());
        if (this._settings.get_boolean('enable-command'))
            this._providers.push(new CommandProvider());
        if (this._settings.get_boolean('enable-web'))
            this._providers.push(new WebProvider());
    }
}
