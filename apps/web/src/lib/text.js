
export function normalizeDisplayName(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 24);
}

export function normalizeInterests(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [
    ...new Set(
      values
        .filter((value) => typeof value === "string")
        .map((value) =>
          value
            .normalize("NFKC")
            .trim()
            .slice(0, 30)
        )
        .filter(Boolean),
    ),
  ].slice(0, 5);
}
