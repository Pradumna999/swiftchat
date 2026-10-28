
import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeInterests,
  calculateInterestScore,
  areProfilesCompatible,
  selectCandidate,
} from "../lib/matching.js";

function profile(id, interests, mode = "random") {
  return {
    id,
    preferredName: id,
    interests,
    mode,
  };
}

test("normalizes interests and removes duplicates", () => {
  assert.deepEqual(
    normalizeInterests(["AI", " ai ", "Gaming", "", 42]),
    ["ai", "gaming"]
  );
});

test("identical interests produce a score of 1", () => {
  assert.equal(
    calculateInterestScore(
      ["AI", "Gaming"],
      ["gaming", "ai"]
    ),
    1
  );
});

test("two shared interests produce the expected score", () => {
  assert.equal(
    calculateInterestScore(
      ["AI", "Gaming", "Science"],
      ["AI", "Science"]
    ),
    0.8
  );
});

test("empty interests have a score of zero", () => {
  assert.equal(
    calculateInterestScore([], ["AI", "Gaming"]),
    0
  );
});

test("random users can match without shared interests", () => {
  assert.equal(
    areProfilesCompatible(
      profile("alex", ["AI"], "random"),
      profile("jordan", ["Music"], "random")
    ),
    true
  );
});

test("interest mode requires at least one shared interest", () => {
  assert.equal(
    areProfilesCompatible(
      profile("alex", ["AI"], "interests"),
      profile("jordan", ["Music"], "random")
    ),
    false
  );
});

test("a user cannot match with the same profile ID", () => {
  assert.equal(
    areProfilesCompatible(
      profile("alex", ["AI"]),
      profile("alex", ["AI"])
    ),
    false
  );
});

test("interest mode selects the best-scoring candidate", () => {
  const alex = profile(
    "alex",
    ["AI", "Gaming", "Science"],
    "interests"
  );

  const waiting = [
    profile("sam", ["AI"]),
    profile("jordan", ["Music", "Movies"]),
    profile("taylor", ["AI", "Gaming", "Science"]),
  ];

  const result = selectCandidate(alex, waiting);

  assert.equal(result.id, "taylor");
});

test("random mode selects randomly among eligible candidates", () => {
  const alex = profile("alex", ["AI"], "random");

  const waiting = [
    profile("sam", ["AI"], "random"),
    profile("jordan", ["Music"], "random"),
    profile("taylor", ["AI"], "interests"),
  ];

  // jordan is eligible because both users allow random matching.
  // The final candidate list is sam, jordan, taylor.
  const result = selectCandidate(alex, waiting, () => 0.5);

  assert.equal(result.id, "jordan");
});

test("returns null if nobody is eligible", () => {
  const alex = profile("alex", ["AI"], "interests");

  const waiting = [
    profile("jordan", ["Music"], "random"),
  ];

  assert.equal(selectCandidate(alex, waiting), null);
});
