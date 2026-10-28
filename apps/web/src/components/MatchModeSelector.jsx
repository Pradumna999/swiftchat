const MATCH_MODES = [
  {
    value: "random",
    title: "Random chat",
    description: "Meet anyone who is available.",
  },
  {
    value: "interests",
    title: "Shared interests",
    description: "Prioritize people with similar interests.",
  },
];

export default function MatchModeSelector({ value, onChange }) {
  return (
    <fieldset className="field-group">
      <legend className="field-label">How should we match you?</legend>

      <div className="mode-list">
        {MATCH_MODES.map((mode) => (
          <label
            key={mode.value}
            className={`mode-option ${
              value === mode.value ? "active" : ""
            }`}
          >
            <input
              type="radio"
              name="match-mode"
              value={mode.value}
              checked={value === mode.value}
              onChange={() => onChange(mode.value)}
            />

            <span className="mode-radio" aria-hidden="true" />

            <span className="mode-copy">
              <span className="mode-title">{mode.title}</span>
              <span className="mode-description">
                {mode.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}