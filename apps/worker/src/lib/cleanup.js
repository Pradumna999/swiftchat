
export function clearTemporaryState(state) {
  if (!state || typeof state !== "object") {
    return;
  }

  // Clear in-memory collections when they support clear().
  for (const value of Object.values(state)) {
    if (value instanceof Map || value instanceof Set) {
      value.clear();
    } else if (Array.isArray(value)) {
      value.length = 0;
    }
  }
}

export function closeSockets(sockets, code = 1000, reason = "Session ended") {
  for (const socket of sockets) {
    try {
      if (socket.readyState === 1) {
        socket.close(code, reason);
      } else if (socket.readyState === 0) {
        socket.close();
      }
    } catch {
      // Continue cleanup even if an individual socket fails.
    }
  }
}
