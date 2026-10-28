const MAX_INTERESTS = 5;

export default function InterestPicker({
  options,
  selected,
  onChange,
  error,
}) {
  function toggleInterest(interest) {
    const alreadySelected = selected.includes(interest);

    if (alreadySelected) {
      onChange(selected.filter((item) => item !== interest));
      return;
    }

    if (selected.length >= MAX_INTERESTS) {
      return;
    }

    onChange([...selected, interest]);
  }

  return (
    <fieldset className="field-group interest-field">
      <div className="field-heading">
        <legend className="field-label">What are you into?</legend>
        <span className="selection-count">
          {selected.length}/{MAX_INTERESTS}
        </span>
      </div>

      <p className="field-hint">
        Pick up to five interests to help find a conversation.
      </p>

      <div className="interest-grid">
        {options.map((interest) => {
          const isSelected = selected.includes(interest);

          return (
            <button
              key={interest}
              type="button"
              className={`interest-chip ${
                isSelected ? "selected" : ""
              }`}
              aria-pressed={isSelected}
              disabled={
                selected.length >= MAX_INTERESTS && !isSelected
              }
              onClick={() => toggleInterest(interest)}
            >
              <span aria-hidden="true">
                {isSelected ? "✓" : "+"}
              </span>
              {interest}
            </button>
          );
        })}
      </div>

      {error && <p className="field-error">{error}</p>}
    </fieldset>
  );
}