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
    <Surface className="flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
        <span className={`grid size-9 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}><Icon size={17} strokeWidth={1.9} /></span>
      </div>
      <p className="mt-5 text-[clamp(2rem,3vw,2.5rem)] font-medium leading-none tracking-[-0.03em] text-foreground tabular-nums [overflow-wrap:anywhere]">{value}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-5">
        <p className="text-[13px] text-muted-foreground">{description}</p>
        {trend && TrendIcon ? (
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold tabular-nums ${trendStyles[trend.direction]}`}>
            <TrendIcon size={12} strokeWidth={2.2} />{trend.label}
          </span>
        ) : null}
      </div>
    </Surface>
  );
}
