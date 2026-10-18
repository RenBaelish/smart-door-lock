const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatDateTime(value: string | Date): string {
  return dateTimeFormat.format(typeof value === "string" ? new Date(value) : value);
}

export function formatTime(value: string | Date): string {
  return timeFormat.format(typeof value === "string" ? new Date(value) : value);
}

export function formatScore(value: number | null | undefined, digits = 3): string {
  return value === null || value === undefined ? "--" : value.toFixed(digits);
}
