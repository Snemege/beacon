import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class BeaconPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({title: 'Genel', icon_name: 'preferences-system-symbolic'});
        window.add(page);

        // Kısayol
        const general = new Adw.PreferencesGroup({title: 'Genel'});
        page.add(general);

        const shortcut = new Adw.EntryRow({
            title: 'Kısayol (ör. <Alt>space, <Super>r)',
            show_apply_button: true,
            text: settings.get_strv('beacon-toggle')[0] ?? '',
        });
        shortcut.connect('apply', () => {
            const accel = shortcut.text.trim();
            const [ok] = Gtk.accelerator_parse(accel);
            if (ok) {
                settings.set_strv('beacon-toggle', [accel]);
                shortcut.remove_css_class('error');
            } else {
                shortcut.add_css_class('error');
            }
        });
        general.add(shortcut);

        const maxResults = new Adw.SpinRow({
            title: 'En fazla sonuç',
            adjustment: new Gtk.Adjustment({lower: 3, upper: 30, step_increment: 1}),
        });
        settings.bind('max-results', maxResults, 'value', Gio.SettingsBindFlags.DEFAULT);
        general.add(maxResults);

        // Görünüm
        const look = new Adw.PreferencesGroup({title: 'Görünüm'});
        page.add(look);

        const themes = ['auto', 'dark', 'light'];
        const theme = new Adw.ComboRow({
            title: 'Tema',
            model: Gtk.StringList.new(['Sistemi izle', 'Koyu', 'Açık']),
            selected: Math.max(0, themes.indexOf(settings.get_string('theme'))),
        });
        theme.connect('notify::selected', () => settings.set_string('theme', themes[theme.selected]));
        look.add(theme);

        const blur = new Adw.SwitchRow({title: 'Cam efekti', subtitle: 'Panelin arkasını bulanıklaştır'});
        settings.bind('enable-blur', blur, 'active', Gio.SettingsBindFlags.DEFAULT);
        look.add(blur);

        const blurRadius = new Adw.SpinRow({
            title: 'Bulanıklık miktarı',
            adjustment: new Gtk.Adjustment({lower: 5, upper: 80, step_increment: 5}),
        });
        settings.bind('blur-radius', blurRadius, 'value', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('enable-blur', blurRadius, 'sensitive', Gio.SettingsBindFlags.GET);
        look.add(blurRadius);

        // Arama kaynakları
        const sources = new Adw.PreferencesGroup({title: 'Arama kaynakları'});
        page.add(sources);

        const apps = new Adw.SwitchRow({title: 'Uygulamalar', subtitle: 'Yüklü uygulamalar'});
        settings.bind('enable-apps', apps, 'active', Gio.SettingsBindFlags.DEFAULT);
        sources.add(apps);

        const settingsRow = new Adw.SwitchRow({title: 'Ayarlar', subtitle: 'GNOME ayar panelleri'});
        settings.bind('enable-settings', settingsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        sources.add(settingsRow);

        const files = new Adw.SwitchRow({title: 'Dosyalar', subtitle: 'Dosya adı araması (plocate)'});
        settings.bind('enable-files', files, 'active', Gio.SettingsBindFlags.DEFAULT);
        sources.add(files);

        const calc = new Adw.SwitchRow({title: 'Hesap makinesi', subtitle: 'Örn. 12*(3+4) → sonucu kopyala'});
        settings.bind('enable-calc', calc, 'active', Gio.SettingsBindFlags.DEFAULT);
        sources.add(calc);

        const currency = new Adw.SwitchRow({title: 'Döviz', subtitle: 'Güncel kurla çevir, ör. 40 usd to tl'});
        settings.bind('enable-currency', currency, 'active', Gio.SettingsBindFlags.DEFAULT);
        sources.add(currency);

        const web = new Adw.SwitchRow({title: 'Web', subtitle: "Web'de ara veya URL aç"});
        settings.bind('enable-web', web, 'active', Gio.SettingsBindFlags.DEFAULT);
        sources.add(web);

        const command = new Adw.SwitchRow({title: 'Komut', subtitle: '$ ile kabuk komutu çalıştır'});
        settings.bind('enable-command', command, 'active', Gio.SettingsBindFlags.DEFAULT);
        sources.add(command);
    }
}
