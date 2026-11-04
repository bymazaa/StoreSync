'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function formatDateKey(key: string): string {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const POPOVER_WIDTH = 256;
const POPOVER_HEIGHT = 320;

type DateFieldProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  dense?: boolean;
  className?: string;
};

// The native picker popup cannot be styled, so the field draws its own calendar:
// the invisible real input keeps form/validation semantics, and the whole box
// opens a custom popover (ported to body, so overflow containers never clip it)
// where the picked day fills with the brand color.
// `new Date()` is kept out of the render path (handlers/effects only) so the
// page shell can still be prerendered without an unstable-value error.
export function DateField({
  value,
  defaultValue,
  onChange,
  name,
  required,
  disabled,
  ariaLabel,
  placeholder = 'Any date',
  dense,
  className,
}: DateFieldProps) {
  const [internal, setInternal] = useState(defaultValue ?? '');
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [view, setView] = useState<{ y: number; m: number } | null>(null);
  const [today, setToday] = useState('');
  const rootRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  const controlled = value !== undefined;
  const shown = controlled ? value : internal;

  useEffect(() => {
    if (!open) return;
    setToday(toKey(new Date()));
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  function openCalendar() {
    if (disabled) return;
    const base = shown || toKey(new Date());
    const [y, m] = base.split('-').map(Number);
    setView({ y: y || new Date().getFullYear(), m: (m || 1) - 1 });
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      let left = rect.left;
      if (left + POPOVER_WIDTH > window.innerWidth - 8) left = Math.max(8, rect.right - POPOVER_WIDTH);
      let top = rect.bottom + 6;
      if (top + POPOVER_HEIGHT > window.innerHeight - 8) top = rect.top - POPOVER_HEIGHT - 6;
      setAnchor({ top: Math.max(8, top), left });
    } else {
      setAnchor(null);
    }
    setOpen(true);
  }

  function pick(day: number) {
    if (!view) return;
    const key = toKey(new Date(view.y, view.m, day));
    if (!controlled) setInternal(key);
    onChange?.(key);
    setOpen(false);
  }

  function clear() {
    if (!controlled) setInternal('');
    onChange?.('');
    setOpen(false);
  }

  function move(step: number) {
    setView((v) => {
      if (!v) return v;
      const d = new Date(v.y, v.m + step, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const popover = view
    ? (() => {
        const startDow = new Date(view.y, view.m, 1).getDay();
        const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
        const cells: (number | null)[] = [
          ...Array<null>(startDow).fill(null),
          ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
        ];
        while (cells.length % 7 !== 0) cells.push(null);
        return (
          <span
            ref={popRef}
            role="dialog"
            aria-label="Choose date"
            style={{
              position: 'fixed',
              top: anchor?.top ?? 0,
              left: anchor?.left ?? 0,
              width: POPOVER_WIDTH,
            }}
            className="z-[60] rounded-xl border border-border bg-card p-3 shadow-2xl"
          >
            <span className="flex items-center justify-between">
              <button type="button" aria-label="Previous month" onClick={() => move(-1)} className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm font-semibold">
                {new Date(view.y, view.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </span>
              <button type="button" aria-label="Next month" onClick={() => move(1)} className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <ChevronRight size={15} />
              </button>
            </span>
            <span className="mt-2 grid grid-cols-7 text-center">
              {WEEKDAYS.map((day, index) => (
                <span key={index} className="py-1 text-[10px] font-semibold uppercase text-muted-foreground">{day}</span>
              ))}
            </span>
            <span className="grid grid-cols-7 gap-y-0.5 text-center">
              {cells.map((day, index) => {
                if (day === null) return <span key={index} />;
                const key = toKey(new Date(view.y, view.m, day));
                const selected = key === shown;
                const isToday = key === today;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => pick(day)}
                    aria-pressed={selected}
                    className={`mx-auto grid size-8 place-items-center rounded-lg text-[13px] transition-colors ${selected ? 'bg-primary font-semibold text-primary-foreground' : isToday ? 'border border-primary/50 text-primary' : 'text-foreground hover:bg-primary-soft hover:text-teal-strong'}`}
                  >
                    {day}
                  </button>
                );
              })}
            </span>
            {shown && !required && (
              <button type="button" onClick={clear} className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                Clear
              </button>
            )}
          </span>
        );
      })()
    : null;

  return (
    <>
      <span
        ref={rootRef}
        onClick={(event) => {
          event.preventDefault();
          openCalendar();
        }}
        className={`group relative flex w-full cursor-pointer items-center gap-2.5 rounded-[12px] border border-border bg-input px-3 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 hover:border-primary/40 ${dense ? 'h-9 text-xs' : 'h-10 text-sm'} ${disabled ? 'pointer-events-none opacity-60' : ''} ${className ?? ''}`}
      >
        <CalendarDays size={dense ? 14 : 15} className="shrink-0 text-teal-strong" aria-hidden />
        <span className={`min-w-0 flex-1 truncate ${shown ? 'tabular-nums text-foreground' : 'text-muted-foreground'}`}>
          {shown ? formatDateKey(shown) : placeholder}
        </span>
        <input
          type="date"
          className="date-field-input"
          name={name}
          required={required && !disabled}
          disabled={disabled}
          aria-label={ariaLabel}
          value={shown}
          onChange={(event) => {
            if (!controlled) setInternal(event.target.value);
            onChange?.(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
              event.preventDefault();
              openCalendar();
            }
            if (event.key === 'Escape') setOpen(false);
          }}
        />
      </span>
      {/*
        The popover must be a sibling of the field in the React tree: React bubbles
        synthetic events along the fiber tree, so a click on a popover button would
        otherwise also trigger the field's onClick (reopening/resetting the month).
      */}
      {open && popover && createPortal(popover, document.body)}
    </>
  );
}
