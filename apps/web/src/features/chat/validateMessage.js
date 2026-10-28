export function validateMessage(value) {
  if (typeof value !== "string") {
    return { ok: false, error: "Message must be text." };
  }

  const text = value.trim();

  if (!text) {
    return { ok: false, error: "Message cannot be empty." };
  }

  if (text.length > 2000) {
    return { ok: false, error: "Messages are limited to 2,000 characters." };
  }

  return { ok: true, text };
}