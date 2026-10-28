export function createSocketUrl(path) {
  const configuredBase = import.meta.env.VITE_CHAT_API_URL;

  const defaultBase =
    ["5173", "4173"].includes(window.location.port) &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? "http://localhost:8787"
      : window.location.origin;

  const url = new URL(path, configuredBase || defaultBase);

  url.protocol =
    url.protocol === "https:" || url.protocol === "wss:"
      ? "wss:"
      : "ws:";

  return url.toString();
}

export function createSocket(path, protocols) {
  return new WebSocket(createSocketUrl(path), protocols);
}