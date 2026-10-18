import Icon, { type IconName } from "@/components/Icon";

interface StatCardProps {
  label: string;
  value: number | string | null;
  icon: IconName;
  hint?: string;
  tone?: "neutral" | "success" | "danger" | "primary";
}

const TONES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "bg-slate-100 text-slate-600",
  primary: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  danger: "bg-red-50 text-red-700",
};

export default function StatCard({ label, value, icon, hint, tone = "neutral" }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
            {value === null ? <span className="inline-block h-7 w-12 animate-pulse rounded bg-slate-100" /> : value}
          </p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${TONES[tone]}`}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
      </div>
      {hint && <p className="mt-3 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
