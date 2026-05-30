export function startOfToday(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfToday(date = new Date()) {
  const value = startOfToday(date);
  value.setDate(value.getDate() + 1);
  value.setMilliseconds(value.getMilliseconds() - 1);
  return value;
}

export function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

export function formatDate(value?: Date | string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function isDueToday(value?: Date | string | null) {
  if (!value) return false;
  const date = new Date(value);
  return date >= startOfToday() && date <= endOfToday();
}

export function isOverdue(value?: Date | string | null) {
  if (!value) return false;
  return new Date(value) < startOfToday();
}
