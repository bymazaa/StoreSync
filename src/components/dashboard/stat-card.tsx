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
    <Surface className="flex h-full min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p title={title} className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
        <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon size={16} strokeWidth={1.9} /></span>
      </div>
      <p title={value} className="mt-3 min-w-0 text-[clamp(1rem,2vw,1.65rem)] font-semibold leading-tight tracking-[-0.035em] text-foreground tabular-nums [overflow-wrap:anywhere]">{value}</p>
      <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="min-w-0 flex-1 text-[11px] leading-4 text-muted-foreground">{description}</p>
        {trend && TrendIcon ? (
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold tabular-nums ${trendStyles[trend.direction]}`}>
            <TrendIcon size={11} strokeWidth={2.2} />{trend.label}
          </span>
        ) : null}
      </div>
    </Surface>
  );
}
