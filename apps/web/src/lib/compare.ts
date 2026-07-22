export const compareLimit = 6;

export function parseCompareIds(value: string | null | undefined) {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function stringifyCompareIds(ids: string[]) {
  return ids.filter(Boolean).slice(0, compareLimit).join(",");
}

export function toggleCompareId(ids: string[], id: string) {
  const next = ids.includes(id)
    ? ids.filter((item) => item !== id)
    : [...ids, id];
  return next.slice(0, compareLimit);
}
