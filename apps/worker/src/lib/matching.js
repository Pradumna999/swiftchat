
const VALID_MODES = new Set(["random", "interests"]);

/**
 * Normalize interests so that "AI", "ai", and " AI "
 * are treated as the same interest.
 */
export function normalizeInterests(interests) {
  if (!Array.isArray(interests)) {
    return [];
  }

  const normalized = new Set();

  for (const interest of interests) {
    if (typeof interest !== "string") {
      continue;
    }

    const value = interest.trim().toLowerCase();

    if (value) {
      normalized.add(value);
    }
  }

  return [...normalized];
}

/**
 * Calculate the Sørensen–Dice similarity score.
 *
 * 0 = no shared interests
 * 1 = identical interest sets
 */
export function calculateInterestScore(
  firstInterests,
  secondInterests
) {
  const first = new Set(normalizeInterests(firstInterests));
  const second = new Set(normalizeInterests(secondInterests));

  if (first.size === 0 || second.size === 0) {
    return 0;
  }

  let sharedCount = 0;

  for (const interest of first) {
    if (second.has(interest)) {
      sharedCount += 1;
    }
  }

  return (2 * sharedCount) / (first.size + second.size);
}

/**
 * Check whether two profiles are allowed to match.
 *
 * Profiles have the shape:
 * {
 *   id: "temporary-id",
 *   preferredName: "Alex",
 *   interests: ["AI", "Gaming"],
 *   mode: "interests"
 * }
 */
export function areProfilesCompatible(first, second) {
  if (!first || !second || first === second) {
    return false;
  }

  if (
    !VALID_MODES.has(first.mode) ||
    !VALID_MODES.has(second.mode)
  ) {
    return false;
  }

  if (
    first.id != null &&
    second.id != null &&
    first.id === second.id
  ) {
    return false;
  }

  const score = calculateInterestScore(
    first.interests,
    second.interests
  );

  // Both participants' preferences must be respected.
  if (first.mode === "interests" || second.mode === "interests") {
    return score > 0;
  }

  return true;
}

function randomIndex(length, random) {
  if (length <= 1) {
    return 0;
  }

  const value = Number(random());

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(
    length - 1,
    Math.max(0, Math.floor(value * length))
  );
}

/**
 * Select one eligible candidate.
 *
 * Interest mode: choose the highest similarity score.
 * Random mode: choose randomly among eligible candidates.
 *
 * The random function is injectable so tests can reproduce
 * the same result reliably.
 */
export function selectCandidate(
  requester,
  waitingProfiles,
  random = Math.random
) {
  if (!requester || !Array.isArray(waitingProfiles)) {
    return null;
  }

  const eligible = waitingProfiles.filter((candidate) =>
    areProfilesCompatible(requester, candidate)
  );

  if (eligible.length === 0) {
    return null;
  }

  if (requester.mode === "random") {
    return eligible[randomIndex(eligible.length, random)];
  }

  const scoredCandidates = eligible.map((candidate) => ({
    candidate,
    score: calculateInterestScore(
      requester.interests,
      candidate.interests
    ),
  }));

  const highestScore = Math.max(
    ...scoredCandidates.map((item) => item.score)
  );

  const bestCandidates = scoredCandidates
    .filter((item) => item.score === highestScore)
    .map((item) => item.candidate);

  return bestCandidates[randomIndex(bestCandidates.length, random)];
}
