
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

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

function base64UrlDecode(value) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new Error("Invalid base64url value.");
  }

  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded =
    base64 + "=".repeat((4 - (base64.length % 4)) % 4);

  const binary = atob(padded);

  return Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0)
  );
}

async function importTicketKey(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("Room-ticket signing secret is invalid.");
  }

  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"]
  );
}

export async function createRoomTicket(
  { roomId, slot, exp, profile },
  secret
) {
  if (
    typeof roomId !== "string" ||
    !["a", "b"].includes(slot) ||
    !Number.isSafeInteger(exp) ||
    !profile ||
    typeof profile.preferredName !== "string" ||
    !Array.isArray(profile.interests)
  ) {
    throw new Error("Invalid room-ticket claims.");
  }

  const payload = JSON.stringify({
    roomId,
    slot,
    exp,
    profile: {
      preferredName: profile.preferredName,
      interests: profile.interests,
    },
  });

  const encodedPayload = base64UrlEncode(
    encoder.encode(payload)
  );

  const key = await importTicketKey(secret);

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

export async function verifyRoomTicket(ticket, secret) {
  try {
    if (
      typeof ticket !== "string" ||
      ticket.length > 2048
    ) {
      return null;
    }

    const parts = ticket.split(".");

    if (parts.length !== 2) {
      return null;
    }

    const [encodedPayload, encodedSignature] = parts;
    const signature = base64UrlDecode(encodedSignature);
    const key = await importTicketKey(secret);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(encodedPayload)
    );

    if (!isValid) {
      return null;
    }

    const payloadBytes = base64UrlDecode(encodedPayload);
    const claims = JSON.parse(decoder.decode(payloadBytes));

    if (
      typeof claims.roomId !== "string" ||
      !["a", "b"].includes(claims.slot) ||
      !Number.isSafeInteger(claims.exp) ||
      claims.exp <= Math.floor(Date.now() / 1000) ||
      !claims.profile ||
      typeof claims.profile.preferredName !== "string" ||
      !Array.isArray(claims.profile.interests) ||
      claims.profile.interests.length > 5 ||
      claims.profile.interests.some(
        (interest) => typeof interest !== "string"
      )
    ) {
      return null;
    }

    const preferredName = claims.profile.preferredName.trim();

    if (
      preferredName.length === 0 ||
      preferredName.length > 24
    ) {
      return null;
    }

    return {
      roomId: claims.roomId,
      slot: claims.slot,
      exp: claims.exp,
      profile: {
        preferredName,
        interests: claims.profile.interests,
      },
    };
  } catch {
    return null;
  }
}
