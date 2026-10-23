import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {score} from '../fuzzy.js';

// gnome-control-center panelleri. Panel listesi kurulu sürümden okunur,
// başlık/anahtar kelime/simge aşağıdaki tablodan zenginleştirilir.
const META = {
    applications:      {title: 'Uygulamalar',        icon: 'preferences-desktop-apps-symbolic',          keywords: 'izin varsayılan default permission'},
    background:        {title: 'Arka Plan',           icon: 'preferences-desktop-wallpaper-symbolic',     keywords: 'duvar kağıdı wallpaper masaüstü'},
    bluetooth:         {title: 'Bluetooth',           icon: 'bluetooth-symbolic',                         keywords: 'cihaz eşleştir device'},
    color:             {title: 'Renk',                icon: 'preferences-color-symbolic',                 keywords: 'profil color ekran'},
    display:           {title: 'Ekranlar',            icon: 'preferences-desktop-display-symbolic',       keywords: 'monitör çözünürlük resolution gece night'},
    keyboard:          {title: 'Klavye',              icon: 'preferences-desktop-keyboard-symbolic',      keywords: 'kısayol shortcut dil input tuş'},
    mouse:             {title: 'Fare ve Dokunmatik',  icon: 'input-mouse-symbolic',                       keywords: 'touchpad imleç hız'},
    multitasking:      {title: 'Çoklu Görev',         icon: 'preferences-system-symbolic',                keywords: 'workspace çalışma alanı köşe hot corner'},
    network:           {title: 'Ağ',                  icon: 'network-wired-symbolic',                     keywords: 'kablolu ethernet vpn proxy'},
    wifi:              {title: 'Wi-Fi',               icon: 'network-wireless-symbolic',                  keywords: 'kablosuz wireless ağ internet'},
    notifications:     {title: 'Bildirimler',         icon: 'preferences-system-notifications-symbolic',  keywords: 'rahatsız etme banner uyarı'},
    'online-accounts': {title: 'Çevrimiçi Hesaplar',  icon: 'goa-panel-symbolic',                         keywords: 'google microsoft e-posta takvim'},
    power:             {title: 'Güç',                 icon: 'battery-symbolic',                           keywords: 'pil batarya uyku güç tasarrufu'},
    printers:          {title: 'Yazıcılar',           icon: 'printer-symbolic',                           keywords: 'yazdır print'},
    privacy:           {title: 'Gizlilik',            icon: 'preferences-system-privacy-symbolic',        keywords: 'kamera mikrofon konum ekran kilidi lock'},
    search:            {title: 'Arama',               icon: 'edit-find-symbolic',                         keywords: 'konum sonuç'},
    sharing:           {title: 'Paylaşım',            icon: 'preferences-system-sharing-symbolic',        keywords: 'uzak masaüstü remote medya'},
    sound:             {title: 'Ses',                 icon: 'audio-volume-high-symbolic',                 keywords: 'hoparlör mikrofon ses seviyesi volume'},
    system:            {title: 'Sistem',              icon: 'preferences-system-symbolic',                keywords: 'tarih saat dil bölge kullanıcı hakkında about'},
    'universal-access':{title: 'Erişilebilirlik',     icon: 'preferences-desktop-accessibility-symbolic', keywords: 'büyüteç kontrast okuyucu accessibility'},
    wacom:             {title: 'Wacom Tableti',        icon: 'input-tablet-symbolic',                      keywords: 'kalem stylus çizim'},
    wellbeing:         {title: 'Dijital Sağlık',       icon: 'alarm-symbolic',                             keywords: 'ekran süresi mola wellbeing'},
    wwan:              {title: 'Mobil Geniş Bant',     icon: 'network-cellular-symbolic',                  keywords: 'hücresel cellular sim mobil'},
};

export class SettingsProvider {
    id = 'settings';

    constructor() {
        this._panels = this._listPanels();
    }

    search(query, limit) {
        const results = [];
        for (const panel of this._panels) {
            const m = META[panel] ?? {title: panel, icon: 'preferences-system-symbolic', keywords: ''};
            const s = Math.max(
                score(query, m.title),
                score(query, m.keywords) * 0.5,
                score(query, panel) * 0.4);
            if (s <= 0)
                continue;
            results.push({
                id: `settings:${panel}`,
                kind: 'setting',
                title: m.title,
                subtitle: 'Sistem Ayarları',
                createIcon: size => new St.Icon({icon_name: m.icon, icon_size: size}),
                score: s,
                activate: () => this._open(panel),
            });
        }
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }

    _open(panel) {
        const proc = Gio.Subprocess.new(
            ['gnome-control-center', panel], Gio.SubprocessFlags.NONE);
        proc.wait_async(null, null);
    }

    // `gnome-control-center --list` çıktısındaki panel kimliklerini döndürür;
    // komut yoksa bilinen panellere düşer.
    _listPanels() {
        try {
            const [ok, out] = GLib.spawn_command_line_sync('gnome-control-center --list');
            if (ok && out) {
                const text = new TextDecoder().decode(out);
                const panels = text.split('\n').map(l => l.trim())
                    .filter(l => l && !l.endsWith(':'));
                if (panels.length)
                    return panels;
            }
        } catch {
            // komut bulunamadı / çalışmadı: tabloya düş
        }
        return Object.keys(META);
    }
}
