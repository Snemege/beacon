# Beacon

GNOME Shell için Albert tarzı hızlı başlatıcı. Kısayola basınca arama kutusu
**mouse hangi monitördeyse orada** açılır.

## Durum (v0.1 iskelet)
- [x] Global kısayol (varsayılan `Alt+Space`)
- [x] Mouse'un olduğu monitörde açılan panel, `Esc` / dışarı tıklama ile kapanma
- [x] Klavye gezinme: `↑`/`↓`/`Tab`, `Enter` ile aç
- [x] Uygulama araması (bulanık eşleşme, eşit puanda sık kullanılan önce)
- [x] Ayarlar penceresi (kısayol, sonuç sayısı, tema, cam efekti, kaynaklar)
- [x] Liquid Glass görünüm: arka plan bulanıklığı, koyu/açık tema (sistemi izler), sistem vurgu rengi
- [x] Sorgu boşken en sık kullanılan uygulamalar, eşleşen harfler vurgulu, alt bilgi çubuğu
- [x] GNOME ayar panelleri araması
- [x] Dosya adı araması (plocate, async + debounce, varsayılan kapalı)
- [x] Hesap makinesi (`12*(3+4)` → Enter ile panoya kopyala)
- [x] Web'de arama / URL açma
- [x] `$` ile kabuk komutu çalıştırma (varsayılan kapalı; Ctrl+Enter terminalde)
- [x] Döviz çevirme (`40 usd to tl`, `1500 tl to usd`, `40000 euro to tl`), güncel kur, 1 saat önbellek
- [x] Sayıları binlik ayırıcıyla gösterme (hesap/döviz); biçim **aktif klavye düzenini** izler (tr → `50.000`, gb → `50,000`)

## Geliştirme
```bash
./install.sh        # src/ klasörünü extension dizinine symlink'ler
./nested.sh         # oturumu kapatmadan iç içe shell'de test
gnome-extensions prefs beacon@vex.local
journalctl -f -o cat /usr/bin/gnome-shell   # loglar
```

## Notlar
- `Shell.BlurEffect` sadece dikdörtgen bulanıklaştırır; yuvarlak köşeler için panel
  içine sığan basamaklı dikdörtgenler kullanılıyor (`popup.js` → `_layoutBlur`).
- Headless test yaparken `HOME`/`XDG_*` değişkenleri `dbus-run-session`'dan **önce**
  verilmeli; yoksa dconf servisi gerçek kullanıcı ayarlarına yazar.

- **Tuş bağı adları mutter'da global.** `Main.wm.addKeybinding(isim, ...)` ile
  kaydedilen isim tüm eklentiler arasında tek olmalı. Eskiden anahtarın adı
  `toggle-shortcut` idi; Caffeine de aynı adı kullandığı ve önce yüklendiği için
  Beacon'ın kaydı reddediliyor, Alt+Space hiç çalışmıyordu. Logda belirtisi:
  `Trying to re-add keybinding "toggle-shortcut"`. Çözüm: anahtar `beacon-toggle`
  olarak yeniden adlandırıldı. Yeni tuş bağı eklerken `beacon-` öneki kullanın.
- Kısayol çalışmıyorsa kontrol listesi:
  1. `journalctl -b -o cat /usr/bin/gnome-shell | grep -i keybinding` → "re-add" uyarısı var mı?
  2. `grep -rl "<anahtar-adı>" ~/.local/share/gnome-shell/extensions/` → aynı adı kullanan başka eklenti var mı?
  3. `dconf dump / | grep -i "alt>space"` → aynı tuşa bağlı başka bir kısayol var mı?
  4. Wayland'da kod değişikliği ancak yeni oturumda (veya `./nested.sh`) yüklenir;
     `gnome-extensions disable/enable` modülleri yeniden yüklemez.

## Yapı
- `src/extension.js` – giriş noktası, kısayol, sağlayıcıların yüklenmesi
- `src/popup.js` – arama paneli arayüzü
- `src/providers/` – arama kaynakları (`search(query, limit)` ya da async için `searchAsync`)
  - `apps.js` uygulamalar · `settings.js` ayar panelleri · `files.js` plocate · `calc.js` hesap · `currency.js` döviz · `web.js` web/URL · `command.js` `$` komut
- `src/format.js` – sayı biçimleme; yereli aktif klavye düzeninden (`org.gnome.desktop.input-sources`) alır
- `src/fuzzy.js` – bulanık eşleştirme puanı
- `src/prefs.js` – ayarlar penceresi (libadwaita)
