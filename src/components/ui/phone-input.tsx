"use client";

import { useMemo, type ChangeEvent, type FocusEvent } from "react";
import { AsYouType, getCountryCallingCode, isSupportedCountry, parsePhoneNumberFromString } from "libphonenumber-js";
import { inputClass } from "@/components/ui/page";

export function PhoneInput({ countryCode, value, onChange, placeholder = "Phone number", name, className = "", autoComplete }: {
  countryCode: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
  className?: string;
  autoComplete?: string;
}) {
  const country = isSupportedCountry(countryCode) ? countryCode : "US";
  const defaultCallingCode = getCountryCallingCode(country);
  const parsed = useMemo(() => value.startsWith("+") ? parsePhoneNumberFromString(value) : undefined, [value]);
  const displayCountry = parsed?.country && isSupportedCountry(parsed.country) ? parsed.country : country;
  const callingCode = parsed?.countryCallingCode ?? defaultCallingCode;
  const displayValue = parsed
    ? new AsYouType(displayCountry).input(parsed.nationalNumber)
    : new AsYouType(country).input(value);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    if (!next.trim()) { onChange(""); event.currentTarget.setCustomValidity(""); return; }
    onChange(next.trimStart().startsWith("+") ? next : new AsYouType(country).input(next));
    event.currentTarget.setCustomValidity("");
  }

  function validateOnBlur(event: FocusEvent<HTMLInputElement>) {
    if (!value.trim()) { event.currentTarget.setCustomValidity(""); return; }
    const parsedPhone = parsePhoneNumberFromString(value, country);
    event.currentTarget.setCustomValidity(parsedPhone?.isValid() ? "" : `Enter a valid phone number for +${callingCode}.`);
  }

  return <div className={`flex ${className}`}>
    <span className="inline-flex h-10 shrink-0 items-center rounded-l-xl border border-r-0 border-border bg-muted px-3 text-sm font-medium text-muted-foreground" aria-label={`Country calling code plus ${callingCode}`}>+{callingCode}</span>
    <input name={name} type="tel" inputMode="tel" autoComplete={autoComplete ?? "tel-national"} value={displayValue} onChange={handleChange} onBlur={validateOnBlur} placeholder={placeholder} className={`${inputClass} rounded-l-none`} />
  </div>;
}
