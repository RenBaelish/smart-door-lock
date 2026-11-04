export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "--";
  const date = typeof value === "string" ? new Date(value) : value;
  if (isNaN(date.getTime())) return "--";

  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  return `${formatted} WIB`;
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "--";
  const date = typeof value === "string" ? new Date(value) : value;
  if (isNaN(date.getTime())) return "--";

  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  return `${formatted} WIB`;
}

export function formatScore(value: number | null | undefined, digits = 3): string {
  return value === null || value === undefined ? "--" : value.toFixed(digits);
}

