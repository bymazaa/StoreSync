"use client";

import { LaptopMinimal, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { THEME_OPTIONS } from "@/lib/constants/app";

const themeOptions = [
  { value: THEME_OPTIONS[0], label: "Light", icon: Sun },
  { value: THEME_OPTIONS[1], label: "Dark", icon: Moon },
  { value: THEME_OPTIONS[2], label: "System", icon: LaptopMinimal },
] as const;

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);

  if (!mounted) return <div aria-hidden className="h-10 w-[104px] rounded-[12px] bg-muted" />;

  return (
    <div className="inline-flex items-center rounded-[12px] border border-line bg-card p-1" aria-label="Appearance">
      {themeOptions.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          aria-label={`${label} theme`}
          aria-pressed={theme === value}
          className={`grid size-8 place-items-center rounded-[9px] transition-colors ${theme === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          onClick={() => setTheme(value)}
          title={label}
          type="button"
        >
          <Icon size={15} strokeWidth={1.9} />
        </button>
      ))}
    </div>
  );
}
