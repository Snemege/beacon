import St from 'gi://St';

import {formatNumber} from '../format.js';

// Küçük, güvenli aritmetik değerlendirici (eval YOK). Özyinelemeli iniş ayrıştırıcı:
//   expr   := term (('+'|'-') term)*
//   term   := factor (('*'|'/'|'%') factor)*
//   factor := unary ('^' factor)?            // sağ birleşmeli üs
//   unary  := ('+'|'-') unary | primary
//   primary:= number | const | func '(' expr ')' | '(' expr ')'
const FUNCS = {
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp,
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    log: Math.log10, ln: Math.log, round: Math.round, floor: Math.floor, ceil: Math.ceil,
};
const CONSTS = {pi: Math.PI, 'π': Math.PI, tau: 2 * Math.PI, e: Math.E};

// Sayı / işleç / tanımlayıcı / parantez
const TOKEN = /\s*(\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|[a-zπ]+|[-+*/%^()])/iy;

function tokenize(src) {
    const tokens = [];
    let pos = 0;
    while (pos < src.length) {
        TOKEN.lastIndex = pos;
        const m = TOKEN.exec(src);
        if (!m || m.index !== pos)
            throw new Error('beklenmeyen karakter');
        tokens.push(m[1]);
        pos = TOKEN.lastIndex;
    }
    return tokens;
}

function evaluate(src) {
    const tokens = tokenize(src);
    let i = 0;
    const peek = () => tokens[i];
    const eat = t => {
        if (tokens[i] !== t)
            throw new Error(`'${t}' bekleniyordu`);
        i++;
    };

    const expr = () => {
        let v = term();
        while (peek() === '+' || peek() === '-')
            v = tokens[i++] === '+' ? v + term() : v - term();
        return v;
    };
    const term = () => {
        let v = factor();
        while (peek() === '*' || peek() === '/' || peek() === '%') {
            const op = tokens[i++];
            const r = factor();
            v = op === '*' ? v * r : op === '/' ? v / r : v % r;
        }
        return v;
    };
    const factor = () => {
        const v = unary();
        if (peek() === '^') {
            i++;
            return v ** factor();
        }
        return v;
    };
    const unary = () => {
        if (peek() === '+') { i++; return unary(); }
        if (peek() === '-') { i++; return -unary(); }
        return primary();
    };
    const primary = () => {
        const t = peek();
        if (t === '(') {
            eat('(');
            const v = expr();
            eat(')');
            return v;
        }
        if (/^[a-zπ]+$/i.test(t)) {
            i++;
            const name = t.toLowerCase();
            if (name in FUNCS) {
                eat('(');
                const v = expr();
                eat(')');
                return FUNCS[name](v);
            }
            if (name in CONSTS)
                return CONSTS[name];
            throw new Error(`bilinmeyen '${t}'`);
        }
        if (t !== undefined && /^\d/.test(t)) {
            i++;
            return parseFloat(t);
        }
        throw new Error('ifade bekleniyordu');
    };

    const result = expr();
    if (i !== tokens.length)
        throw new Error('fazladan girdi');
    if (!Number.isFinite(result))
        throw new Error('tanımsız sonuç');
    return result;
}

// İşleç, parantez veya fonksiyon içeren girdileri hesap olarak değerlendir
const LOOKS_MATH = /[-+*/%^()]|\b(sqrt|cbrt|abs|exp|sin|cos|tan|asin|acos|atan|log|ln|round|floor|ceil)\b/i;

export class CalcProvider {
    id = 'calc';

    search(query) {
        if (!query || !LOOKS_MATH.test(query))
            return [];
        let value;
        try {
            value = evaluate(query);
        } catch {
            return [];
        }
        // Gösterim binlik ayırıcılı; panoya sade sayı kopyalanır
        const plain = Number(value.toPrecision(12)).toString();
        return [{
            id: 'calc:result',
            kind: 'calc',
            title: `= ${formatNumber(value)}`,
            subtitle: 'Enter ile sonucu panoya kopyala',
            createIcon: size => new St.Icon({icon_name: 'accessories-calculator-symbolic', icon_size: size}),
            score: 2000,
            activate: () => St.Clipboard.get_default()
                .set_text(St.ClipboardType.CLIPBOARD, plain),
        }];
    }
}
