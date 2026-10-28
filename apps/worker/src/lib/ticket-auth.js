
const encoder = new TextEncoder();

function base64UrlEncode(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function importSigningKey(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("Room-ticket signing secret is missing or too short.");
  }

  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
}

export async function createRoomTicket(
  { roomId, slot, exp },
  secret
) {
  if (
    typeof roomId !== "string" ||
    !["a", "b"].includes(slot) ||
    !Number.isSafeInteger(exp)
  ) {
    throw new Error("Invalid room-ticket claims.");
  }

  const payload = JSON.stringify({
    roomId,
    slot,
    exp,
  });

  const encodedPayload = base64UrlEncode(
    encoder.encode(payload)
  );

  const key = await importSigningKey(secret);

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(encodedPayload)
  );

  return (
    encodedPayload +
    "." +
    base64UrlEncode(new Uint8Array(signature))
  );
}
