const MAX_INTERESTS = 5;
const VALID_MODES = ["random", "interests"];

export function validateJoinForm({ preferredName, interests, mode }) {
  const errors = {};
  const name = preferredName.trim();

  if (!name) {
    errors.preferredName = "Enter a preferred name.";
  } else if (name.length > 24) {
    errors.preferredName = "Your name must be 24 characters or fewer.";
  } else if (/[\r\n]/.test(name)) {
    errors.preferredName = "Your name must fit on one line.";
  }

  if (!VALID_MODES.includes(mode)) {
    errors.mode = "Choose a valid matching mode.";
  }

  if (interests.length > MAX_INTERESTS) {
    errors.interests = "Choose no more than five interests.";
  }

  if (mode === "interests" && interests.length === 0) {
    errors.interests = "Choose at least one interest for this mode.";
  }

  return errors;
}