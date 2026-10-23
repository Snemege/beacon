import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

// '$' ile başlayan girdiyi kabuk komutu olarak çalıştırır (Alt+F2 benzeri).
// Enter arka planda, Ctrl+Enter bir terminalde çalıştırır.
export class CommandProvider {
    id = 'command';

    search(query) {
        if (!query.startsWith('$'))
            return [];
        const cmd = query.slice(1).trim();
        if (!cmd)
            return [];
        return [{
            id: 'command:run',
            kind: 'command',
            title: cmd,
            subtitle: 'Komutu çalıştır — Ctrl+Enter ile terminalde',
            createIcon: size => new St.Icon({icon_name: 'utilities-terminal-symbolic', icon_size: size}),
            score: 2000,
            activate: () => this._run(['/bin/sh', '-c', cmd]),
            activateAlt: () => this._runInTerminal(cmd),
        }];
    }

    _run(argv) {
        try {
            Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE).wait_async(null, null);
        } catch (e) {
            console.error('Beacon: komut çalıştırılamadı', e);
        }
    }

    _runInTerminal(cmd) {
        // Komut bitince kabuk açık kalsın diye exec $SHELL eklenir
        const line = `${cmd}; exec "$SHELL"`;
        const term = GLib.find_program_in_path('kgx') ??          // GNOME Console
            GLib.find_program_in_path('gnome-terminal') ??
            GLib.find_program_in_path('xterm');
        if (!term) {
            this._run(['/bin/sh', '-c', cmd]);
            return;
        }
        const argv = term.endsWith('gnome-terminal')
            ? [term, '--', '/bin/sh', '-c', line]
            : [term, '-e', '/bin/sh', '-c', line];
        this._run(argv);
    }
}
