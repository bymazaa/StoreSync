"use client";

import { useEffect, useId, useRef, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { inputClass } from "@/components/ui/page";

type AddressSuggestion = { id: string; label: string };

export function AddressInput({ value, onChange, countryCode, name = "address", placeholder = "Start typing an address", className = "", suggestions = true }: {
  value: string;
  onChange: (value: string) => void;
  countryCode: string;
  name?: string;
  placeholder?: string;
  className?: string;
  suggestions?: boolean;
}) {
  const [suggestionsList, setSuggestionsList] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const suggestionListId = useId();
  const selectedValue = useRef<string | null>(null);

  useEffect(() => {
    if (!suggestions) return;
    const query = value.trim();
    if (selectedValue.current === value) { selectedValue.current = null; return; }
    if (query.length < 3) { const clear = window.setTimeout(() => { setSuggestionsList([]); setLoading(false); }, 0); return () => window.clearTimeout(clear); }
    const controller = new AbortController();
    const currentRequest = ++requestId.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void apiRequest<{ suggestions: AddressSuggestion[] }>(`/api/address-search?q=${encodeURIComponent(query)}&country=${encodeURIComponent(countryCode)}`, { signal: controller.signal })
        .then((result) => { if (requestId.current === currentRequest) { setSuggestionsList(result.suggestions); setOpen(true); } })
        .catch(() => { if (!controller.signal.aborted && requestId.current === currentRequest) setSuggestionsList([]); })
        .finally(() => { if (requestId.current === currentRequest) setLoading(false); });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [countryCode, value, suggestions]);

  function chooseAddress(suggestion: AddressSuggestion) {
    selectedValue.current = suggestion.label;
    onChange(suggestion.label);
    setSuggestionsList([]);
    setOpen(false);
  }

  return <div className={`relative ${className}`}>
    <input name={name} autoComplete={suggestions ? "street-address" : "off"} value={value} onChange={(event) => { onChange(event.target.value); setOpen(true); }} onFocus={() => { if (suggestionsList.length) setOpen(true); }} onBlur={() => window.setTimeout(() => setOpen(false), 120)} className={inputClass} placeholder={placeholder} role="combobox" aria-haspopup="listbox" aria-autocomplete="list" aria-expanded={open && suggestionsList.length > 0} aria-controls={open && suggestionsList.length > 0 ? suggestionListId : undefined} />
    {open && suggestionsList.length > 0 && <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg"><ul role="listbox" id={suggestionListId} className="max-h-64 overflow-y-auto py-1">
      {suggestionsList.map((suggestion) => <li key={suggestion.id} role="option" aria-selected="false"><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseAddress(suggestion)} className="w-full px-3 py-2.5 text-left text-sm leading-5 hover:bg-muted">{suggestion.label}</button></li>)}
    </ul><p className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">Address data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap contributors</a> · Search by <a href="https://github.com/komoot/photon" target="_blank" rel="noreferrer" className="underline">Photon</a></p></div>}
    {loading && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Searching…</span>}
  </div>;
}
