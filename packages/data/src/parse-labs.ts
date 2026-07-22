import type { ParsedLab } from "./types.js";

function parseJsonSearchIndex(html: string): unknown[] {
  const script = html.match(
    /<script id="search-index" type="application\/json">([\s\S]*?)<\/script>/i,
  )?.[1];
  if (!script) return [];
  try {
    const parsed = JSON.parse(script);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseLabsFromHtml(
  html: string,
  fetchedAt = new Date().toISOString(),
): ParsedLab[] {
  const rows = parseJsonSearchIndex(html)
    .filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object",
    )
    .filter((entry) => entry.type === "lab");

  return rows.map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.title ?? ""),
    ...(typeof row.id === "string" ? { slug: row.id } : {}),
    ...(typeof row.href === "string" ? { href: row.href } : {}),
    ...(typeof row.logo === "string" ? { logo: row.logo } : {}),
    ...(typeof row.description === "string"
      ? { description: row.description }
      : {}),
    ...(typeof row.modelCount === "number"
      ? { modelCount: row.modelCount }
      : {}),
    ...(typeof row.providerCount === "number"
      ? { providerCount: row.providerCount }
      : {}),
    ...(typeof row.releaseDate === "string"
      ? { releaseDate: row.releaseDate }
      : {}),
    ...(typeof row.updated === "string" ? { updatedAt: row.updated } : {}),
    ...(Array.isArray(row.tokens) ? { tokens: row.tokens.map(String) } : {}),
    sources: [
      {
        source: "models.dev/labs",
        fetchedAt,
        url: "https://models.dev/labs/",
      },
    ],
  }));
}
