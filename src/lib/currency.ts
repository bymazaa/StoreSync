// CLDR's English data has no narrow symbol for these currencies, so a shop on an en-* locale would
// print a bare code ("BDT 1,234.50" instead of "৳1,234.50"). The map supplies the symbol CLDR itself
// uses in the currency's home locale. XDR/XSU are accounting units without a printed symbol, so they
// are left out on purpose.
const currencySymbols: Record<string, string> = {
    AED: "د.إ.", ALL: "L", ANG: "NAf.", AWG: "Afl.", BGN: "лв.", BHD: "د.ب.", BIF: "FBu",
    BTN: "Nu.", BYN: "Br", CDF: "FC", CHF: "Fr.", CVE: "$", DJF: "Fdj", DZD: "د.ج.",
    ERN: "Nfk", ETB: "Br", GMD: "D", HTG: "G", IQD: "د.ع.", IRR: "﷼", JOD: "د.أ.",
    KES: "Ksh", KWD: "د.ك.", LSL: "L", LYD: "د.ل.", MAD: "د.م.", MDL: "L", MKD: "ден.",
    MOP: "MOP$", MRU: "أ.م.", MVR: "Rf", MWK: "MK", MZN: "MTn", OMR: "ر.ع.", PAB: "B/.",
    PEN: "S/", PGK: "K", QAR: "ر.ق.", RSD: "дин.", SAR: "ر.س.", SCR: "SR", SDG: "ج.س.",
    SLE: "Le", SLL: "Le", SOS: "S", SVC: "₡", SZL: "E", TJS: "сом.", TMT: "m",
    TND: "د.ت.", TZS: "TSh", UGX: "USh", UZS: "soʻm", VES: "Bs.S", VUV: "VT", WST: "WS$",
    YER: "ر.ي.", ZWG: "ZiG", ZWL: "Z$",
};

export type CurrencyMoneyOptions = { maximumFractionDigits?: number; notation?: "compact" };

// Every money figure on screen goes through here, so a taka amount reads "৳1,234.50", never "BDT".
export function formatCurrencyMoney(locale: string, currency: string, value: number, options: CurrencyMoneyOptions = {}) {
    const formatter = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: options.maximumFractionDigits ?? 2,
        ...(options.notation ? { notation: options.notation, compactDisplay: "short" } : {}),
    });
    const formatted = formatter.format(value);
    // Currency codes are always [A-Z]{3} (validated at the API), so the bare-code token only matches
    // when Intl actually printed the code instead of a real symbol.
    const symbol = currencySymbols[currency];
    return symbol ? formatted.replace(new RegExp(`\\b${currency}\\b`), symbol) : formatted;
}
