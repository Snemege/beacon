import Shell from 'gi://Shell';

import {score} from '../fuzzy.js';

// Her sağlayıcı aynı arayüzü uygular:
//   id, search(query, limit) -> [{id, kind, title, subtitle, createIcon(size), score, activate(), activateAlt?()}]
//   recent(limit) (isteğe bağlı) -> sorgu boşken gösterilecek sonuçlar
export class AppsProvider {
    id = 'apps';

    constructor() {
        this._appSys = Shell.AppSystem.get_default();
        this._usage = Shell.AppUsage.get_default();
    }

    search(query, limit) {
        const results = [];
        for (const info of this._appSys.get_installed()) {
            if (!info.should_show())
                continue;
            const app = this._appSys.lookup_app(info.get_id());
            if (!app)
                continue;

            const fields = [
                [info.get_display_name() ?? '', 1],
                [info.get_generic_name?.() ?? '', 0.6],
                [(info.get_keywords?.() ?? []).join(' '), 0.5],
                [info.get_executable() ?? '', 0.4],
            ];
            const s = Math.max(...fields.map(([text, w]) => score(query, text) * w));
            if (s <= 0)
                continue;

            results.push({...this._result(app), score: s});
        }

        // Eşit puanda sık kullanılan önce gelsin
        results.sort((a, b) => b.score - a.score || this._usage.compare(a.app.get_id(), b.app.get_id()));
        return results.slice(0, limit);
    }

    // Sorgu boşken: en sık kullanılan uygulamalar
    recent(limit) {
        return this._usage.get_most_used().slice(0, Math.min(limit, 5))
            .map(app => ({...this._result(app), score: 0}));
    }

    _result(app) {
        return {
            id: `apps:${app.get_id()}`,
            kind: 'app',
            title: app.get_name(),
            subtitle: app.get_description() ?? '',
            createIcon: size => app.create_icon_texture(size),
            app,
            activate: () => app.activate(),
        };
    }
}
