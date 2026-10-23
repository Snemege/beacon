import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import St from 'gi://St';

import {formatNumber} from '../format.js';

const API = 'https://open.er-api.com/v6/latest/USD';  // anahtarsız; USD tabanlı kurlar
const TTL = 60 * 60 * 1000;  // kur önbelleği: 1 saat

// Yaygın adlar/simgeler -> ISO kodu. 3 harfli bilinmeyenler büyük harfe çevrilip denenir.
const CODES = {
    usd: 'USD', dollar: 'USD', dollars: 'USD', dolar: 'USD', $: 'USD',
    eur: 'EUR', euro: 'EUR', avro: 'EUR', '€': 'EUR',
    try: 'TRY', tl: 'TRY', lira: 'TRY', '₺': 'TRY',
    gbp: 'GBP', pound: 'GBP', sterlin: 'GBP', '£': 'GBP',
    jpy: 'JPY', yen: 'JPY', chf: 'CHF', cad: 'CAD', aud: 'AUD', rub: 'RUB',
};

// <miktar> <kaynak> to|in|-> <hedef>
const QUERY_RE = /^([\d.,]+)\s*([a-zμ$€£₺]{1,12})\s+(?:to|in|->|=>)\s+([a-z$€£₺]{1,12})$/i;

function parseAmount(s) {
    const hasDot = s.includes('.');
    const hasComma = s.includes(',');
    if (hasDot && hasComma) {
        // Son görülen ayırıcı ondalık kabul edilir
        s = s.lastIndexOf(',') > s.lastIndexOf('.')
            ? s.replace(/\./g, '').replace(',', '.')
            : s.replace(/,/g, '');
    } else if (hasComma) {
        const parts = s.split(',');
        s = parts.length === 2 && parts[1].length <= 2
            ? s.replace(',', '.')        // 12,5 -> ondalık
            : s.replace(/,/g, '');       // 1,500 -> binlik
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
}

function toCode(tok) {
    const t = tok.toLowerCase();
    if (t in CODES)
        return CODES[t];
    if (/^[a-z]{3}$/.test(t))
        return t.toUpperCase();
    return null;
}

// Canlı döviz çevirici: "40 usd to tl", "1500 tl to usd", "40000 euro to tl"
export class CurrencyProvider {
    id = 'currency';

    constructor() {
        this._session = new Soup.Session();
        this._rates = null;
        this._fetchedAt = 0;
        this._inflight = null;
    }

    async searchAsync(query) {
        const m = QUERY_RE.exec(query.trim());
        if (!m)
            return [];
        const amount = parseAmount(m[1]);
        const from = toCode(m[2]);
        const to = toCode(m[3]);
        if (amount === null || !from || !to)
            return [];

        let rates;
        try {
            rates = await this._rates_();
        } catch {
            return [];  // ağ yok / API hatası: sessizce atla
        }
        if (!(from in rates) || !(to in rates))
            return [];

        const value = amount / rates[from] * rates[to];
        const unit = 1 / rates[from] * rates[to];
        const plain = Number(value.toFixed(2));
        return [{
            id: 'currency:result',
            kind: 'currency',
            title: `${formatNumber(value, 2)} ${to}`,
            subtitle: `${formatNumber(amount, 2)} ${from} · 1 ${from} = ${formatNumber(unit, 4)} ${to} · güncel kur`,
            createIcon: size => new St.Icon({icon_name: 'accessories-calculator-symbolic', icon_size: size}),
            score: 2100,
            activate: () => St.Clipboard.get_default()
                .set_text(St.ClipboardType.CLIPBOARD, String(plain)),
        }];
    }

    // Önbellekli kur; taze değilse bir kez çeker, eşzamanlı istekleri tek fetch'te birleştirir
    _rates_() {
        if (this._rates && Date.now() - this._fetchedAt < TTL)
            return Promise.resolve(this._rates);
        if (this._inflight)
            return this._inflight;
        this._inflight = this._fetch().then(rates => {
            this._rates = rates;
            this._fetchedAt = Date.now();
            this._inflight = null;
            return rates;
        }).catch(e => {
            this._inflight = null;
            throw e;
        });
        return this._inflight;
    }

    _fetch() {
        return new Promise((resolve, reject) => {
            const msg = Soup.Message.new('GET', API);
            this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (session, res) => {
                try {
                    const bytes = session.send_and_read_finish(res);
                    if (msg.get_status() !== Soup.Status.OK)
                        throw new Error(`HTTP ${msg.get_status()}`);
                    const data = JSON.parse(new TextDecoder().decode(bytes.get_data()));
                    if (data.result !== 'success' || !data.rates)
                        throw new Error('kur verisi alınamadı');
                    resolve(data.rates);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}
