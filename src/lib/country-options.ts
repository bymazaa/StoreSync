import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });

export const countryOptions = getCountries()
  .map((code) => ({ code, name: regionNames.of(code) ?? code, callingCode: getCountryCallingCode(code) }))
  .sort((a, b) => a.name.localeCompare(b.name));

const countryCurrencies: Partial<Record<CountryCode, string>> = {
  AE: "AED", AF: "AFN", AL: "ALL", AM: "AMD", AR: "ARS", AU: "AUD", AZ: "AZN", BA: "BAM", BD: "BDT", BG: "BGN", BH: "BHD", BI: "BIF", BN: "BND", BO: "BOB", BR: "BRL", BY: "BYN", BZ: "BZD",
  CA: "CAD", CH: "CHF", CL: "CLP", CN: "CNY", CO: "COP", CR: "CRC", CZ: "CZK", DK: "DKK", DO: "DOP", DZ: "DZD", EG: "EGP", ET: "ETB", GB: "GBP", GE: "GEL", GH: "GHS", HK: "HKD", HN: "HNL", HR: "EUR", HU: "HUF",
  ID: "IDR", IL: "ILS", IN: "INR", IQ: "IQD", IR: "IRR", IS: "ISK", JP: "JPY", KE: "KES", KG: "KGS", KH: "KHR", KR: "KRW", KW: "KWD", KZ: "KZT", LA: "LAK", LK: "LKR", MA: "MAD", MM: "MMK", MN: "MNT", MO: "MOP", MX: "MXN", MY: "MYR",
  NG: "NGN", NP: "NPR", NZ: "NZD", NO: "NOK", OM: "OMR", PE: "PEN", PH: "PHP", PK: "PKR", PL: "PLN", QA: "QAR", RO: "RON", RS: "RSD", RU: "RUB", SA: "SAR", SE: "SEK", SG: "SGD", TH: "THB", TN: "TND", TR: "TRY", TW: "TWD", TZ: "TZS", UA: "UAH", UG: "UGX", US: "USD", UY: "UYU", UZ: "UZS", VE: "VES", VN: "VND", ZA: "ZAR", ZM: "ZMW",
  AD: "EUR", AT: "EUR", BE: "EUR", CY: "EUR", DE: "EUR", EE: "EUR", ES: "EUR", FI: "EUR", FR: "EUR", GR: "EUR", IE: "EUR", IT: "EUR", LT: "EUR", LU: "EUR", LV: "EUR", MC: "EUR", ME: "EUR", MT: "EUR", NL: "EUR", PT: "EUR", SI: "EUR", SK: "EUR", SM: "EUR", VA: "EUR",
  AG: "XCD", DM: "XCD", GD: "XCD", KN: "XCD", LC: "XCD", VC: "XCD", BJ: "XOF", BF: "XOF", CI: "XOF", GW: "XOF", ML: "XOF", NE: "XOF", SN: "XOF", TG: "XOF", CM: "XAF", CF: "XAF", CG: "XAF", GA: "XAF", GQ: "XAF", TD: "XAF", CD: "CDF", JM: "JMD", PA: "PAB", PR: "USD", SV: "USD", EC: "USD",
  AC: "SHP", AI: "XCD", AO: "AOA", AS: "USD", AW: "AWG", AX: "EUR", BB: "BBD", BL: "EUR", BM: "BMD", BQ: "USD", BS: "BSD", BT: "BTN", BW: "BWP", CC: "AUD", CK: "NZD", CU: "CUP", CV: "CVE", CW: "ANG", CX: "AUD", DJ: "DJF", EH: "MAD", ER: "ERN", FJ: "FJD", FK: "FKP", FM: "USD", FO: "DKK", GF: "EUR", GG: "GBP", GI: "GIP", GL: "DKK", GM: "GMD", GN: "GNF", GP: "EUR", GT: "GTQ", GU: "USD", GY: "GYD", HT: "HTG", IM: "GBP", IO: "USD", JE: "GBP", JO: "JOD", KY: "KYD", KI: "AUD", KM: "KMF", KP: "KPW", LB: "LBP", LI: "CHF", LS: "LSL", LR: "LRD", LY: "LYD", MF: "EUR", MG: "MGA", MH: "USD", MD: "MDL", MK: "MKD", MP: "USD", MQ: "EUR", MR: "MRU", MS: "XCD", MU: "MUR", MV: "MVR", MW: "MWK", MZ: "MZN", NA: "NAD", NC: "XPF", NF: "AUD", NI: "NIO", NR: "AUD", NU: "NZD", PM: "EUR", PF: "XPF", PG: "PGK", PW: "USD", PS: "ILS", PY: "PYG", RE: "EUR", RW: "RWF", SB: "SBD", SC: "SCR", SD: "SDG", SH: "SHP", SX: "ANG", SJ: "NOK", SL: "SLE", SO: "SOS", SR: "SRD", SS: "SSP", ST: "STN", SY: "SYP", SZ: "SZL", TA: "SHP", TC: "USD", TJ: "TJS", TK: "NZD", TL: "USD", TM: "TMT", TO: "TOP", TT: "TTD", TV: "AUD", VG: "USD", VI: "USD", VU: "VUV", WF: "XPF", WS: "WST", XK: "EUR", YE: "YER", YT: "EUR", ZW: "ZWG",
};

const currencyCodes = typeof Intl.supportedValuesOf === "function"
  ? Intl.supportedValuesOf("currency")
  : ["AED", "AUD", "BDT", "CAD", "CNY", "EUR", "GBP", "INR", "JPY", "PKR", "SAR", "USD"];

export const currencyOptions = [...new Set([...currencyCodes, ...Object.values(countryCurrencies).filter((code): code is string => Boolean(code))])]
  .sort()
  .map((code) => ({ code, name: currencyNames.of(code) ?? code }));

export function currencyForCountry(countryCode: string) {
  return countryCurrencies[countryCode as CountryCode];
}

const countryTimeZones: Partial<Record<CountryCode, string>> = {
  AE: "Asia/Dubai", AF: "Asia/Kabul", AL: "Europe/Tirane", AM: "Asia/Yerevan", AR: "America/Argentina/Buenos_Aires", AT: "Europe/Vienna", AU: "Australia/Sydney",
  AZ: "Asia/Baku", BA: "Europe/Sarajevo", BD: "Asia/Dhaka", BE: "Europe/Brussels", BG: "Europe/Sofia", BH: "Asia/Bahrain", BO: "America/La_Paz", BR: "America/Sao_Paulo",
  BY: "Europe/Minsk", CA: "America/Toronto", CH: "Europe/Zurich", CL: "America/Santiago", CN: "Asia/Shanghai", CO: "America/Bogota", CR: "America/Costa_Rica", CY: "Asia/Nicosia",
  CZ: "Europe/Prague", DE: "Europe/Berlin", DK: "Europe/Copenhagen", DO: "America/Santo_Domingo", DZ: "Africa/Algiers", EC: "America/Guayaquil", EE: "Europe/Tallinn", EG: "Africa/Cairo",
  ES: "Europe/Madrid", ET: "Africa/Addis_Ababa", FI: "Europe/Helsinki", FJ: "Pacific/Fiji", FR: "Europe/Paris", GB: "Europe/London", GE: "Asia/Tbilisi", GH: "Africa/Accra",
  GR: "Europe/Athens", HK: "Asia/Hong_Kong", HR: "Europe/Zagreb", HU: "Europe/Budapest", ID: "Asia/Jakarta", IE: "Europe/Dublin", IL: "Asia/Jerusalem", IN: "Asia/Kolkata",
  IQ: "Asia/Baghdad", IR: "Asia/Tehran", IS: "Atlantic/Reykjavik", IT: "Europe/Rome", JM: "America/Jamaica", JO: "Asia/Amman", JP: "Asia/Tokyo", KE: "Africa/Nairobi",
  KG: "Asia/Bishkek", KH: "Asia/Phnom_Penh", KR: "Asia/Seoul", KW: "Asia/Kuwait", KZ: "Asia/Almaty", LA: "Asia/Vientiane", LB: "Asia/Beirut", LK: "Asia/Colombo",
  LT: "Europe/Vilnius", LU: "Europe/Luxembourg", LV: "Europe/Riga", MA: "Africa/Casablanca", MD: "Europe/Chisinau", ME: "Europe/Podgorica", MM: "Asia/Yangon", MN: "Asia/Ulaanbaatar",
  MO: "Asia/Macau", MX: "America/Mexico_City", MY: "Asia/Kuala_Lumpur", NG: "Africa/Lagos", NL: "Europe/Amsterdam", NO: "Europe/Oslo", NP: "Asia/Kathmandu", NZ: "Pacific/Auckland",
  OM: "Asia/Muscat", PA: "America/Panama", PE: "America/Lima", PH: "Asia/Manila", PK: "Asia/Karachi", PL: "Europe/Warsaw", PT: "Europe/Lisbon", PY: "America/Asuncion",
  QA: "Asia/Qatar", RO: "Europe/Bucharest", RS: "Europe/Belgrade", RU: "Europe/Moscow", SA: "Asia/Riyadh", SE: "Europe/Stockholm", SG: "Asia/Singapore", SI: "Europe/Ljubljana",
  SK: "Europe/Bratislava", TH: "Asia/Bangkok", TJ: "Asia/Dushanbe", TM: "Asia/Ashgabat", TN: "Africa/Tunis", TR: "Europe/Istanbul", TW: "Asia/Taipei", TZ: "Africa/Dar_es_Salaam",
  UA: "Europe/Kyiv", US: "America/New_York", UY: "America/Montevideo", UZ: "Asia/Tashkent", VE: "America/Caracas", VN: "Asia/Ho_Chi_Minh", ZA: "Africa/Johannesburg", ZM: "Africa/Lusaka",
};

export function timeZoneForCountry(countryCode: string) {
  return countryTimeZones[countryCode as CountryCode] ?? "Etc/UTC";
}

export function localeForCountry(countryCode: string) {
  return `en-${countryCode}`;
}
