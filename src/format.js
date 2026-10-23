import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// xkb klavye düzeni -> sayı biçimi için yerel (BCP-47). Bilinmeyen düzen sistem diline düşer.
const LAYOUT_LOCALE = {
    us: 'en-US', gb: 'en-GB', ca: 'en-CA', au: 'en-AU', ie: 'en-IE',
    tr: 'tr-TR', de: 'de-DE', at: 'de-AT', ch: 'de-CH', fr: 'fr-FR', be: 'nl-BE',
    es: 'es-ES', it: 'it-IT', pt: 'pt-PT', br: 'pt-BR', nl: 'nl-NL',
    ru: 'ru-RU', ua: 'uk-UA', pl: 'pl-PL', cz: 'cs-CZ', sk: 'sk-SK', hu: 'hu-HU',
    ro: 'ro-RO', bg: 'bg-BG', gr: 'el-GR', hr: 'hr-HR', rs: 'sr-RS',
    se: 'sv-SE', no: 'nb-NO', dk: 'da-DK', fi: 'fi-FI',
    jp: 'ja-JP', kr: 'ko-KR', cn: 'zh-CN', in: 'hi-IN', il: 'he-IL', ar: 'ar',
};

let _inputSettings = null;
function inputSettings() {
    return (_inputSettings ??= new Gio.Settings({schema_id: 'org.gnome.desktop.input-sources'}));
}

// Aktif klavye düzeninin yereli; okunamazsa sistem diline, o da olmazsa en-US'e düşer.
export function currentLocale() {
    try {
        const s = inputSettings();
        const sources = s.get_value('sources').deep_unpack();
        const src = sources[s.get_uint('current')];
        if (src) {
            const id = src[1].split('+')[0];  // 'us+intl' -> 'us'
            if (id in LAYOUT_LOCALE)
                return LAYOUT_LOCALE[id];
        }
    } catch {
        // input-sources okunamadı: sisteme düş
    }
    for (const l of GLib.get_language_names()) {
        const m = /^([a-z]{2,3})(?:_([A-Z]{2}))?/.exec(l);
        if (m)
            return m[2] ? `${m[1]}-${m[2]}` : m[1];
    }
    return 'en-US';
}

// Sayıyı aktif klavye diline göre binlik ayırıcıyla biçimler
// (ör. tr: "50.000", en: "50,000").
export function formatNumber(n, maxFrac = 10) {
    if (!Number.isFinite(n))
        return String(n);
    const opts = {maximumFractionDigits: maxFrac};
    try {
        return new Intl.NumberFormat(currentLocale(), opts).format(n);
    } catch {
        return new Intl.NumberFormat('en-US', opts).format(n);
    }
}
