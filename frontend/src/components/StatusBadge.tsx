export default function StatusBadge({
  status,
  reason,
}: {
  status: string;
  reason?: string | null;
}) {
  const isTailgating = status === "tailgating" || (reason && reason.toLowerCase().includes("tailgating"));
  const granted = status === "success";

  if (isTailgating) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        Tailgating
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        granted ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${granted ? "bg-emerald-500" : "bg-red-500"}`} />
      {granted ? "Granted" : "Denied"}
    </span>
  );
}
