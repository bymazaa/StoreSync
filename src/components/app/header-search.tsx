"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, LoaderCircle, Search, ShoppingBag, ShoppingCart, Truck, UsersRound } from "lucide-react";
import { formatCurrencyMoney } from "@/lib/currency";

type Suggestion = { type: string; id: string; title: string; subtitle: string; href: string; amount?: string };
type Group = { key: string; label: string; items: Suggestion[] };

const typeIcons: Record<string, typeof Boxes> = {
  product: Boxes,
  customer: UsersRound,
  supplier: Truck,
  sale: ShoppingCart,
  purchase: ShoppingBag,
};

export function HeaderSearch({ currencyCode, locale }: { currencyCode: string; locale: string }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const indexByKey = useMemo(() => new Map(items.map((item, position) => [`${item.type}-${item.id}`, position])), [items]);
  const currency = useMemo(() => (value: string | number) => formatCurrencyMoney(locale, currencyCode, Number(value)), [locale, currencyCode]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setOpen(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search failed.");
        const payload = (await response.json()) as { groups: Group[] };
        setGroups(payload.groups); setActive(0);
      } catch {
        if (!controller.signal.aborted) setGroups([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus(); inputRef.current?.select();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleShortcut);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  function changeQuery(value: string) {
    setQuery(value);
    if (value.trim().length < 2) { setGroups([]); setLoading(false); setOpen(false); }
  }

  function select(item: Suggestion) {
    setOpen(false); setQuery(""); setGroups([]);
    inputRef.current?.blur();
    router.push(item.href);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setOpen(false); inputRef.current?.blur(); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive((current) => Math.min(current + 1, items.length - 1)); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((current) => Math.max(current - 1, 0)); return; }
    if (event.key === "Enter" && open) {
      const item = items[active];
      if (!item) return;
      event.preventDefault();
      select(item);
    }
  }

  const term = query.trim();
  const showEmpty = open && !loading && groups.length === 0 && term.length >= 2;

  return (
    <div ref={rootRef} className="relative hidden w-[min(38vw,420px)] min-w-[260px] sm:block">
      <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary/80" />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => changeQuery(event.target.value)}
        onFocus={() => { if (term.length >= 2) setOpen(true); }}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls="header-search-results"
        aria-autocomplete="list"
        aria-activedescendant={open && items[active] ? `header-search-${items[active].type}-${items[active].id}` : undefined}
        className="h-11 w-full rounded-[14px] border border-shell-border/80 bg-card/90 pl-11 pr-16 text-sm text-foreground shadow-[0_2px_8px_rgba(17,54,47,0.055)] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/80 hover:border-primary/30 focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(10,159,148,0.12)] focus:ring-0 dark:shadow-none"
        placeholder="Search products, invoices..."
        aria-label="Search products, invoices, customers and suppliers"
      />
      {loading ? (
        <LoaderCircle size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-line bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">⌘ K</kbd>
      )}

      {open && (loading || items.length > 0 || showEmpty) && (
        <div id="header-search-results" role="listbox" className="absolute left-0 right-0 top-12 z-40 max-h-[70vh] overflow-y-auto rounded-[20px] border border-line bg-card p-2 shadow-2xl shadow-gray-100 dark:shadow-none">
          {showEmpty && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches for “{term}”.</p>}
          {groups.map((group) => (
            <div key={group.key} className="py-1">
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{group.label}</p>
              {group.items.map((item) => {
                const current = indexByKey.get(`${item.type}-${item.id}`) ?? -1;
                const Icon = typeIcons[item.type] ?? Search;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    id={`header-search-${item.type}-${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={active === current}
                    onMouseEnter={() => setActive(current)}
                    onClick={() => select(item)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${active === current ? "bg-muted" : "hover:bg-muted/60"}`}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Icon size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-foreground">{item.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {item.amount ? `${currency(item.amount)}${item.subtitle ? ` · ${item.subtitle}` : ""}` : item.subtitle}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
