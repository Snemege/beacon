import Gio from 'gi://Gio';
import St from 'gi://St';

const SEARCH_URL = 'https://duckduckgo.com/?q=';
const MIN_QUERY = 2;

// host.tld veya şemalı URL (boşluksuz); e-posta değil
const URL_RE = /^(https?:\/\/\S+|[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?)$/i;

// Hiçbir sağlayıcı iyi eşleşmediğinde dibe düşen yedek: URL'yi aç veya web'de ara.
export class WebProvider {
    id = 'web';

    search(query) {
        if (query.length < MIN_QUERY || query.startsWith('$'))
            return [];
        const results = [];

        if (URL_RE.test(query) && !query.includes('@')) {
            const url = /^https?:\/\//i.test(query) ? query : `https://${query}`;
            results.push(this._result('web:url', `Aç: ${query}`, 'Tarayıcıda adresi aç',
                'web-browser-symbolic', 50, url));
        }

        results.push(this._result('web:search', `Web'de ara: ${query}`, 'DuckDuckGo',
            'edit-find-symbolic', 10, SEARCH_URL + encodeURIComponent(query)));
        return results;
    }

    _result(id, title, subtitle, icon, score, uri) {
        return {
            id, kind: 'web', title, subtitle, score,
            createIcon: size => new St.Icon({icon_name: icon, icon_size: size}),
            activate: () => Gio.AppInfo.launch_default_for_uri(uri, null),
        };
    }
}
