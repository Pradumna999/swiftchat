import { useState } from "react";

import NameInput from "./NameInput.jsx";
import InterestPicker from "./InterestPicker.jsx";
import MatchModeSelector from "./MatchModeSelector.jsx";

import { validateJoinForm } from "../features/matchmaking/validateJoinForm.js";
import "../styles/form.css";

const INTEREST_OPTIONS = [
  "Technology",
  "AI",
  "Science",
  "Gaming",
  "Music",
  "Movies",
  "Anime",
  "Philosophy",
  "Books",
  "Art",
  "Startups",
  "Travel",
  "Fitness",
  "Languages",
  "Sports",
];

export default function JoinForm({ onStart }) {
  const [preferredName, setPreferredName] = useState("");
  const [interests, setInterests] = useState([]);
  const [mode, setMode] = useState("random");
  const [errors, setErrors] = useState({});

  function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validateJoinForm({
      preferredName,
      interests,
      mode,
    });

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onStart({
      preferredName: preferredName.trim(),
      interests: [...interests],
      mode,
    });
  }

  function handleNameChange(nextName) {
    setPreferredName(nextName);

    setErrors((previous) => ({
      ...previous,
      preferredName: "",
    }));
  }

  function handleInterestsChange(nextInterests) {
    setInterests(nextInterests);

    setErrors((previous) => ({
      ...previous,
      interests: "",
    }));
  }

  function handleModeChange(nextMode) {
    setMode(nextMode);

    setErrors((previous) => ({
      ...previous,
      interests: "",
      mode: "",
    }));
  }

  return (
    <form className="join-form" onSubmit={handleSubmit}>
      <NameInput
        value={preferredName}
        onChange={handleNameChange}
        error={errors.preferredName}
      />

      <InterestPicker
        options={INTEREST_OPTIONS}
        selected={interests}
        onChange={handleInterestsChange}
        error={errors.interests}
      />

      <MatchModeSelector
        value={mode}
        onChange={handleModeChange}
      />

      {errors.mode && (
        <p className="field-error">{errors.mode}</p>
      )}

      <button className="start-button" type="submit">
        <span>Start a conversation</span>
        <span aria-hidden="true">↗</span>
      </button>

      <p className="form-caption">
        No sign-up. No public profile. Just a conversation.
      </p>
    </form>
  );
}