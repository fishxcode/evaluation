export function dash(value: unknown) {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
}

export function compactNumber(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

export function price(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return `$${new Intl.NumberFormat("en", { maximumFractionDigits: 4 }).format(value)}`;
}

export function date(value: string | undefined) {
  if (!value) return "-";
  return value;
}

export function csvEscape(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
