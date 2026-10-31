
export function consumeRateLimit(
  state,
  {
    name,
    now = Date.now(),
    windowMs = 5000,
    maxEvents = 15,
  } = {}
) {
  if (
    typeof name !== "string" ||
    !/^[a-z][a-z0-9]*$/.test(name)
  ) {
    throw new TypeError("Invalid rate-limit bucket name.");
  }

  if (
    !Number.isSafeInteger(now) ||
    !Number.isSafeInteger(windowMs) ||
    windowMs < 1 ||
    !Number.isSafeInteger(maxEvents) ||
    maxEvents < 1
  ) {
    throw new TypeError("Invalid rate-limit configuration.");
  }

  const current =
    state &&
    typeof state === "object" &&
    !Array.isArray(state)
      ? state
      : {};

  const startKey = `${name}WindowStart`;
  const countKey = `${name}Count`;

  let windowStart = current[startKey];
  let count = current[countKey];

  if (
    !Number.isSafeInteger(windowStart) ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    now < windowStart ||
    now - windowStart >= windowMs
  ) {
    windowStart = now;
    count = 0;
  }

  count += 1;

  return {
    allowed: count <= maxEvents,
    count,
    remaining: Math.max(0, maxEvents - count),
    retryAfterMs: Math.max(
      0,
      windowMs - (now - windowStart)
    ),
    state: {
      ...current,
      [startKey]: windowStart,
      [countKey]: count,
    },
  };
}
