
const ALLOWED_INTERESTS = new Set([
  "technology",
  "ai",
  "science",
  "gaming",
  "music",
  "movies",
  "anime",
  "philosophy",
  "books",
  "art",
  "startups",
  "travel",
  "fitness",
  "languages",
  "sports",
]);

const VALID_MODES = new Set(["random", "interests"]);

export function validateJoinPayload(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return { ok: false, error: "Invalid preferences." };
  }

  if (typeof payload.preferredName !== "string") {
    return { ok: false, error: "A preferred name is required." };
  }

  const preferredName = payload.preferredName.trim();

  if (
    preferredName.length === 0 ||
    preferredName.length > 24 ||
    /[\u0000-\u001F\u007F]/.test(preferredName)
  ) {
    return { ok: false, error: "Invalid preferred name." };
  }

  if (!VALID_MODES.has(payload.mode)) {
    return { ok: false, error: "Invalid matching mode." };
  }

  if (
    !Array.isArray(payload.interests) ||
    payload.interests.length > 5
  ) {
    return { ok: false, error: "Choose up to five interests." };
  }

  const interests = [];

  for (const item of payload.interests) {
    if (typeof item !== "string") {
      return { ok: false, error: "Invalid interest." };
    }

    const normalized = item.trim().toLowerCase();

    if (!ALLOWED_INTERESTS.has(normalized)) {
      return { ok: false, error: "Unsupported interest." };
    }

    if (!interests.includes(normalized)) {
      interests.push(normalized);
    }
  }

  if (payload.mode === "interests" && interests.length === 0) {
    return {
      ok: false,
      error: "Choose an interest for interest-based matching.",
    };
  }

  return {
    ok: true,
    profile: {
      preferredName,
      interests,
      mode: payload.mode,
    },
  };
}
