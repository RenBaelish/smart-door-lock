import Icon, { type IconName } from "@/components/Icon";

interface StatCardProps {
  label: string;
  value: number | string | null;
  icon: IconName;
  hint?: string;
  tone?: "neutral" | "success" | "danger" | "primary" | "warning";
}

const TONES: Record<NonNullable<StatCardProps["tone"]>, { icon: string; bar: string }> = {
  neutral: { icon: "bg-primary-100 text-neutral-800", bar: "bg-primary-300" },
  primary: { icon: "bg-secondary-500 text-neutral-950", bar: "bg-secondary-500" },
  success: { icon: "bg-mint-50 text-mint-700", bar: "bg-mint" },
  danger: { icon: "bg-red-50 text-red-600", bar: "bg-error" },
  warning: { icon: "bg-accent-100 text-accent-700", bar: "bg-accent-500" },
};

export default function StatCard({ label, value, icon, hint, tone = "neutral" }: StatCardProps) {
  const t = TONES[tone];
  return (
    <div className="card group relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <span className={`absolute inset-x-0 top-0 h-1 ${t.bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="caps text-[11px] text-sage">{label}</p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-neutral-950">
            {value === null ? <span className="inline-block h-8 w-14 animate-pulse rounded-sm bg-primary-100" /> : value}
          </p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${t.icon}`}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
      </div>
      {hint && <p className="mt-3 text-xs text-graphite">{hint}</p>}
    </div>
  );
}
