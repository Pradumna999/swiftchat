
export function encodeEvent(type, payload = {}) {
  return JSON.stringify({
    v: 1,
    type,
    payload,
  });
}

export function parseEvent(raw) {
  if (typeof raw !== "string" || raw.length > 16_384) {
    return null;
  }

  try {
    const event = JSON.parse(raw);

    if (
      !event ||
      typeof event !== "object" ||
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

export function sendEvent(socket, type, payload = {}) {
  if (socket.readyState !== 1) {
    return false;
  }

  try {
    socket.send(encodeEvent(type, payload));
    return true;
  } catch {
    return false;
  }
}
