export function isAllowedOrigin(origin, configuredOrigins) {
  if (!origin || typeof configuredOrigins !== "string") {
    return false;
  }

  const allowedOrigins = new Set(
    configuredOrigins
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

  return allowedOrigins.has(origin);
}