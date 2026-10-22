import type { LucideIcon } from "lucide-react";
import { Surface } from "@/components/ui/surface";

type StatCardProps = {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone: "teal" | "blue" | "amber" | "violet";
};

const tones = {
  teal: "bg-teal-soft text-teal-strong",
  blue: "bg-blue-soft text-blue-strong",
  amber: "bg-amber-soft text-amber-strong",
  violet: "bg-violet-soft text-violet-strong",
};

export function StatCard({ title, value, description, icon: Icon, tone }: StatCardProps) {
  return (
    <Surface className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-3 text-[clamp(1.25rem,3vw,1.875rem)] font-semibold leading-tight tracking-tight text-foreground [overflow-wrap:anywhere]">{value}</p>
        </div>
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon size={20} strokeWidth={1.8} /></span>
      </div>
      <div className="mt-5 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">{description}</span>
      </div>
    </Surface>
  );
}
