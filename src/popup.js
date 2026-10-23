import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const PANEL_WIDTH = 700;
const PANEL_RADIUS = 30;  // stylesheet.css içindeki .beacon-panel border-radius ile aynı olmalı
const ICON_SIZE = 36;
const BLUR_STEPS = 4;

const KIND_LABELS = {
    app: 'Uygulama', setting: 'Ayar', file: 'Dosya', folder: 'Klasör',
    calc: 'Hesap', command: 'Komut', web: 'Web', currency: 'Döviz',
};

// Tüm sahneyi kaplayan şeffaf katman + mouse'un olduğu monitörde ortalanmış cam panel.
// Katmana (panel dışına) tıklamak paneli kapatır.
export const BeaconPopup = GObject.registerClass(
class BeaconPopup extends St.Widget {
    _init(settings, providers) {
        super._init({reactive: true, visible: false});
        this._settings = settings;
        this._providers = providers;
        this._interface = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        this._grab = null;
        this._results = [];
        this._rows = [];
        this._selected = -1;
        this._query = '';
        this._searchTimer = 0;
        this._searchToken = 0;

        // Shell.BlurEffect sadece dikdörtgen bulanıklaştırır. Yuvarlak köşelerden taşmaması
        // için panelin içine sığan, köşe yayını basamaklarla izleyen dikdörtgenler kullanılır.
        this._blurActors = [];
        for (let i = 0; i <= BLUR_STEPS; i++) {
            const actor = new St.Widget({reactive: false});
            actor.add_effect(new Shell.BlurEffect({mode: Shell.BlurMode.BACKGROUND, brightness: 1}));
            this.add_child(actor);
            this._blurActors.push(actor);
        }

        this._panel = new St.BoxLayout({
            style_class: 'beacon-panel',
            orientation: Clutter.Orientation.VERTICAL,
            pivot_point: new Graphene.Point({x: 0.5, y: 0.5}),
        });
        this._panel.connect('notify::height', () => this._layoutBlur());
        this.add_child(this._panel);

        this._buildEntry();

        this._heading = new St.Label({style_class: 'beacon-heading', text: 'Son kullanılanlar', visible: false});
        this._panel.add_child(this._heading);

        this._list = new St.BoxLayout({
            style_class: 'beacon-results',
            orientation: Clutter.Orientation.VERTICAL,
        });
        this._scroll = new St.ScrollView({
            style_class: 'beacon-scroll',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            child: this._list,
            visible: false,
        });
        this._panel.add_child(this._scroll);

        this._empty = new St.Label({style_class: 'beacon-empty', text: 'Sonuç yok', visible: false});
        this._panel.add_child(this._empty);

        this._buildFooter();

        this.connect('button-press-event', (_a, event) => {
            const target = global.stage.get_event_actor(event);
            if (!this._panel.contains(target))
                this.close();
            return Clutter.EVENT_PROPAGATE;
        });

        this._settingsIds = [
            this._settings.connect('changed', () => this._applyStyle()),
            this._interface.connect('changed::color-scheme', () => this._applyStyle()),
        ];
        this._applyStyle();
        this.connect('destroy', () => this._onDestroy());
    }

    _buildEntry() {
        const box = new St.BoxLayout({style_class: 'beacon-entry-box', x_expand: true});
        box.add_child(new St.Icon({
            icon_name: 'edit-find-symbolic',
            style_class: 'beacon-entry-icon',
            y_align: Clutter.ActorAlign.CENTER,
        }));

        this._entry = new St.Entry({
            style_class: 'beacon-entry',
            hint_text: 'Uygulama, ayar veya dosya ara…',
            can_focus: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(this._entry);

        this._shortcutChip = new St.Label({style_class: 'beacon-chip', y_align: Clutter.ActorAlign.CENTER});
        box.add_child(this._shortcutChip);
        this._panel.add_child(box);

        const text = this._entry.clutter_text;
        text.connect('text-changed', () => this._search());
        text.connect('key-press-event', (_a, event) => this._onKeyPress(event));
    }

    _buildFooter() {
        this._footer = new St.BoxLayout({style_class: 'beacon-footer', x_expand: true});
        const hint = (key, label) => {
            const box = new St.BoxLayout({style_class: 'beacon-hint'});
            box.add_child(new St.Label({style_class: 'beacon-kbd', text: key}));
            const text = new St.Label({style_class: 'beacon-hint-text', text: label, y_align: Clutter.ActorAlign.CENTER});
            box.add_child(text);
            this._footer.add_child(box);
            return {box, text};
        };
        this._enterHint = hint('⏎', 'Aç');
        this._altHint = hint('Ctrl ⏎', 'Klasörü aç');
        hint('↑ ↓', 'Gezin');
        hint('Esc', 'Kapat');
        this._panel.add_child(this._footer);
    }

    _applyStyle() {
        const theme = this._settings.get_string('theme');
        const light = theme === 'light' ||
            (theme === 'auto' && this._interface.get_string('color-scheme') !== 'prefer-dark');
        const blur = this._settings.get_boolean('enable-blur');

        this._panel.style_class = 'beacon-panel';
        if (light)
            this._panel.add_style_class_name('beacon-light');
        if (!blur)
            this._panel.add_style_class_name('beacon-solid');

        const radius = this._settings.get_int('blur-radius');
        for (const actor of this._blurActors) {
            actor.visible = blur;
            actor.get_effects()[0].radius = radius * this._scale;
        }

        const accel = this._settings.get_strv('toggle-shortcut')[0] ?? '';
        this._shortcutChip.text = accel.replace(/<(\w+)>/g, '$1 + ').replace(/space$/i, 'Space');
        this._shortcutChip.visible = accel !== '';
    }

    get _scale() {
        return St.ThemeContext.get_for_stage(global.stage).scale_factor;
    }

    _layoutBlur() {
        const {x, y, width: w, height: h} = this._panel;
        const r = PANEL_RADIUS * this._scale;
        this._blurActors.forEach((actor, i) => {
            // Köşe yayı üzerindeki nokta: her dikdörtgenin köşesi tam yayın üstüne denk gelir
            const theta = (Math.PI / 2) * (i / BLUR_STEPS);
            const ix = Math.ceil(r * (1 - Math.cos(theta)));
            const iy = Math.ceil(r * (1 - Math.sin(theta)));
            actor.set_position(x + ix, y + iy);
            actor.set_size(Math.max(0, w - 2 * ix), Math.max(0, h - 2 * iy));
        });
    }

    get isOpen() {
        return this._grab !== null;
    }

    open() {
        if (this.isOpen)
            return;

        // Katman tüm sahneyi kaplar, panel mouse'un bulunduğu monitöre yerleşir
        this.set_position(0, 0);
        this.set_size(global.stage.width, global.stage.height);
        const mon = Main.layoutManager.currentMonitor;
        const width = Math.min(PANEL_WIDTH * this._scale, mon.width - 40);
        this._panel.width = width;
        this._panel.set_position(
            mon.x + Math.floor((mon.width - width) / 2),
            mon.y + Math.floor(mon.height * 0.18));
        this._applyStyle();

        this.visible = true;
        this._grab = Main.pushModal(this, {actionMode: Shell.ActionMode.POPUP});
        this._entry.grab_key_focus();
        this._entry.set_text('');
        this._search();
        this._layoutBlur();

        this._panel.remove_all_transitions();
        this._panel.set({opacity: 0, scale_x: 0.96, scale_y: 0.96});
        this._panel.ease({
            opacity: 255,
            scale_x: 1,
            scale_y: 1,
            duration: 140,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    close() {
        if (!this.isOpen)
            return;
        Main.popModal(this._grab);
        this._grab = null;
        if (this._searchTimer) {
            GLib.source_remove(this._searchTimer);
            this._searchTimer = 0;
        }
        this._searchToken++;  // bekleyen async sonuçları geçersiz kıl
        this._panel.remove_all_transitions();
        this.visible = false;
    }

    toggle() {
        if (this.isOpen)
            this.close();
        else
            this.open();
    }

    // Tuş vuruşlarını topla: her vuruşta değil, kısa bir duraktan sonra ara
    _search() {
        if (this._searchTimer)
            GLib.source_remove(this._searchTimer);
        this._searchTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
            this._searchTimer = 0;
            this._runSearch();
            return GLib.SOURCE_REMOVE;
        });
    }

    _runSearch() {
        this._query = this._entry.get_text().trim();
        const limit = this._settings.get_int('max-results');
        const token = ++this._searchToken;

        // Senkron sağlayıcılar hemen; async olanlar (dosya) sonradan birleştirilir
        const results = [];
        const asyncProviders = [];
        for (const provider of this._providers) {
            try {
                if (!this._query) {
                    if (provider.recent)
                        results.push(...provider.recent(limit));
                } else if (provider.searchAsync) {
                    asyncProviders.push(provider);
                } else {
                    results.push(...provider.search(this._query, limit));
                }
            } catch (e) {
                console.error(`Beacon: ${provider.id} sağlayıcısı hata verdi`, e);
            }
        }
        this._render(results, limit);

        for (const provider of asyncProviders) {
            provider.searchAsync(this._query, limit).then(extra => {
                if (token !== this._searchToken)
                    return;  // sorgu değişti; bu sonuç bayat
                results.push(...extra);
                this._render(results, limit);
            }).catch(e => console.error(`Beacon: ${provider.id} sağlayıcısı hata verdi`, e));
        }
    }

    _render(results, limit) {
        const ordered = this._query
            ? [...results].sort((a, b) => b.score - a.score)
            : results;
        this._setResults(ordered.slice(0, limit));
    }

    _setResults(results) {
        this._list.destroy_all_children();
        this._results = results;
        this._rows = results.map((result, i) => this._buildRow(result, i));

        this._heading.visible = !this._query && results.length > 0;
        this._scroll.visible = results.length > 0;
        this._empty.visible = !!this._query && results.length === 0;
        this._selected = -1;
        this._select(results.length > 0 ? 0 : -1);
    }

    _buildRow(result, i) {
        const button = new St.Button({
            style_class: 'beacon-row',
            x_expand: true,
            can_focus: false,
            track_hover: true,
        });
        const box = new St.BoxLayout({style_class: 'beacon-row-box', x_expand: true});
        const icon = result.createIcon(ICON_SIZE);
        icon.y_align = Clutter.ActorAlign.CENTER;
        box.add_child(icon);

        const labels = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        const title = new St.Label({style_class: 'beacon-title'});
        title.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        labels.add_child(title);
        if (result.subtitle) {
            const sub = new St.Label({text: result.subtitle, style_class: 'beacon-subtitle'});
            sub.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            labels.add_child(sub);
        }
        box.add_child(labels);

        box.add_child(new St.Label({
            style_class: 'beacon-badge',
            text: KIND_LABELS[result.kind] ?? '',
            y_align: Clutter.ActorAlign.CENTER,
        }));
        const enter = new St.Label({
            text: '⏎',
            style_class: 'beacon-enter-icon',
            y_align: Clutter.ActorAlign.CENTER,
            opacity: 0,
        });
        box.add_child(enter);
        button.set_child(box);

        button.connect('clicked', () => this._activate(i, false));
        button.connect('notify::hover', () => {
            if (button.hover)
                this._select(i);
        });
        this._list.add_child(button);

        const row = {button, title, enter};
        this._setTitleMarkup(row, result, false);
        return row;
    }

    // Sorgunun başlıkta geçtiği kısmı kalın ve renkli göster
    _setTitleMarkup(row, result, selected) {
        const title = result.title;
        const at = this._query
            ? title.toLocaleLowerCase('tr').indexOf(this._query.toLocaleLowerCase('tr')) : -1;
        if (at < 0) {
            row.title.clutter_text.set_markup(GLib.markup_escape_text(title, -1));
            return;
        }
        const esc = s => GLib.markup_escape_text(s, -1);
        const end = at + this._query.length;
        const color = selected ? '' : ` foreground="${this._highlightColor()}"`;
        row.title.clutter_text.set_markup(
            `${esc(title.slice(0, at))}<span weight="bold"${color}>${esc(title.slice(at, end))}</span>${esc(title.slice(end))}`);
    }

    _highlightColor() {
        return this._panel.has_style_class_name('beacon-light') ? '#1c64c8' : '#9ec5ff';
    }

    _select(index) {
        const old = this._rows[this._selected];
        if (old) {
            old.button.remove_style_pseudo_class('selected');
            old.enter.opacity = 0;
            this._setTitleMarkup(old, this._results[this._selected], false);
        }

        this._selected = index;
        const row = this._rows[index];
        const result = this._results[index];
        this._enterHint.text.text = result?.kind === 'setting' ? 'Ayarı aç' : 'Aç';
        this._altHint.box.visible = !!result?.activateAlt;
        if (!row)
            return;
        row.button.add_style_pseudo_class('selected');
        row.enter.opacity = 255;
        this._setTitleMarkup(row, result, true);

        // Seçili satırı görünür tut
        const adj = this._scroll.vadjustment;
        const box = row.button.get_allocation_box();
        if (box.y1 < adj.value)
            adj.value = box.y1;
        else if (box.y2 > adj.value + adj.page_size)
            adj.value = box.y2 - adj.page_size;
    }

    _activate(index, alt) {
        const result = this._results[index];
        if (!result)
            return;
        const action = alt && result.activateAlt ? result.activateAlt : result.activate;
        this.close();
        try {
            action();
        } catch (e) {
            console.error('Beacon: sonuç açılamadı', e);
        }
    }

    _onKeyPress(event) {
        const n = this._results.length;
        const ctrl = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) !== 0;
        switch (event.get_key_symbol()) {
        case Clutter.KEY_Escape:
            this.close();
            return Clutter.EVENT_STOP;
        case Clutter.KEY_Return:
        case Clutter.KEY_KP_Enter:
        case Clutter.KEY_ISO_Enter:
            this._activate(this._selected, ctrl);
            return Clutter.EVENT_STOP;
        case Clutter.KEY_Down:
        case Clutter.KEY_Tab:
            if (n)
                this._select((this._selected + 1) % n);
            return Clutter.EVENT_STOP;
        case Clutter.KEY_Up:
        case Clutter.KEY_ISO_Left_Tab:
            if (n)
                this._select((this._selected - 1 + n) % n);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onDestroy() {
        if (this._searchTimer) {
            GLib.source_remove(this._searchTimer);
            this._searchTimer = 0;
        }
        const [settingsId, interfaceId] = this._settingsIds;
        this._settings.disconnect(settingsId);
        this._interface.disconnect(interfaceId);
    }
});
