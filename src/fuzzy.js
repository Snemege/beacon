// Basit bulanık eşleştirici. Sorgunun tüm harfleri sırayla geçmeli;
// baştan eşleşme, kelime başı ve ardışık harfler daha yüksek puan alır.
// Eşleşme yoksa 0 döner.

const fold = s => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i');

export function score(query, text) {
    if (!query)
        return 1;
    const q = fold(query);
    const t = fold(text);

    if (t === q)
        return 1000;
    if (t.startsWith(q))
        return 800 - t.length;

    const idx = t.indexOf(q);
    if (idx > 0) {
        const wordStart = /[\s\-_.]/.test(t[idx - 1]);
        return (wordStart ? 600 : 400) - idx;
    }

    let total = 0, ti = 0, run = 0;
    for (const ch of q) {
        const found = t.indexOf(ch, ti);
        if (found < 0)
            return 0;
        run = found === ti ? run + 1 : 0;
        const wordStart = found === 0 || /[\s\-_.]/.test(t[found - 1]);
        total += 1 + run * 2 + (wordStart ? 3 : 0);
        ti = found + 1;
    }
    // Harfleri metne serpiştirilmiş zayıf eşleşmeleri ele
    if (total < q.length * 3)
        return 0;
    return Math.min(total, 300);
}
