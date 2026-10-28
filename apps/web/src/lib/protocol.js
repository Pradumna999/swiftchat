
export function encodeEvent(type, payload = {}) {
  return JSON.stringify({
    v: 1,
    type,
    payload,
  });
}

export function parseEvent(raw) {
  if (typeof raw !== "string") {
    return null;
  }

  try {
    const event = JSON.parse(raw);

    if (
      !event ||
      typeof event !== "object" ||
      event === null ||
      Array.isArray(event) ||
      event.v !== 1 ||
      typeof event.type !== "string" ||
      !event.payload ||
      typeof event.payload !== "object" ||
      Array.isArray(event.payload)
    ) {
      return null;
    }

    return event;
  } catch {
    return null;
  }
}
