import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {score} from '../fuzzy.js';

const MIN_QUERY = 2;  // Tek harfte plocate'i çalıştırma

// plocate ile dosya adı araması. Sonuçlar dosya adına göre puanlanır;
// Enter dosyayı varsayılan uygulamada, Ctrl+Enter içeren klasörü açar.
export class FilesProvider {
    id = 'files';

    constructor() {
        this._plocate = GLib.find_program_in_path('plocate') ?? GLib.find_program_in_path('locate');
    }

    // Async: plocate alt sürecini bloklamadan çalıştırır, Promise ile sonuç döndürür.
    searchAsync(query, limit) {
        return new Promise(resolve => {
            if (!this._plocate || query.length < MIN_QUERY) {
                resolve([]);
                return;
            }
            let proc;
            try {
                // -i: büyük/küçük harf duyarsız, -l: sınır. Sorgu argüman olarak geçirilir.
                proc = Gio.Subprocess.new(
                    [this._plocate, '-i', '-l', String(limit * 4), query],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
            } catch {
                resolve([]);
                return;
            }
            proc.communicate_utf8_async(null, null, (p, res) => {
                let out = '';
                try {
                    [, out] = p.communicate_utf8_finish(res);
                } catch {
                    resolve([]);
                    return;
                }
                resolve(this._toResults((out ?? '').split('\n').filter(l => l), query, limit));
            });
        });
    }

    _toResults(paths, query, limit) {
        const results = [];
        for (const path of paths) {
            const name = GLib.path_get_basename(path);
            const s = score(query, name);
            if (s <= 0)
                continue;
            const isDir = GLib.file_test(path, GLib.FileTest.IS_DIR);
            results.push({
                id: `files:${path}`,
                kind: isDir ? 'folder' : 'file',
                title: name,
                subtitle: GLib.path_get_dirname(path),
                createIcon: size => this._icon(path, isDir, size),
                score: s,
                activate: () => this._launch(path),
                activateAlt: isDir ? null : () => this._launch(GLib.path_get_dirname(path)),
            });
        }
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }

    _icon(path, isDir, size) {
        if (isDir)
            return new St.Icon({icon_name: 'folder-symbolic', icon_size: size});
        try {
            const info = Gio.File.new_for_path(path)
                .query_info('standard::icon', Gio.FileQueryInfoFlags.NONE, null);
            return new St.Icon({gicon: info.get_icon(), icon_size: size});
        } catch {
            return new St.Icon({icon_name: 'text-x-generic-symbolic', icon_size: size});
        }
    }

    _launch(path) {
        const uri = Gio.File.new_for_path(path).get_uri();
        Gio.AppInfo.launch_default_for_uri(uri, null);
    }
}
