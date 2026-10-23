import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Surface } from "@/components/ui/surface";

type Tone = "teal" | "blue" | "amber" | "violet";

type StatCardProps = {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone: Tone;
  trend?: { label: string; direction: "up" | "down" | "flat" };
};

const tones: Record<Tone, string> = {
  teal: "bg-teal-soft text-teal-strong",
  blue: "bg-blue-soft text-blue-strong",
  amber: "bg-amber-soft text-amber-strong",
  violet: "bg-violet-soft text-violet-strong",
};

const trendStyles = {
  up: "bg-teal-soft text-teal-strong",
  down: "bg-danger/10 text-danger",
  flat: "bg-muted text-muted-foreground",
};

const trendIcons = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };

export function StatCard({ title, value, description, icon: Icon, tone, trend }: StatCardProps) {
  const TrendIcon = trend ? trendIcons[trend.direction] : null;
  return (
    <Surface className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${tones[tone]}`}><Icon size={17} strokeWidth={1.9} /></span>
      </div>
      <p className="mt-4 text-[clamp(1.375rem,2.4vw,1.75rem)] font-semibold leading-none tracking-tight text-foreground tabular-nums [overflow-wrap:anywhere]">{value}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3.5">
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && TrendIcon ? (
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold tabular-nums ${trendStyles[trend.direction]}`}>
            <TrendIcon size={12} strokeWidth={2.2} />{trend.label}
          </span>
        ) : null}
      </div>
    </Surface>
  );
}
