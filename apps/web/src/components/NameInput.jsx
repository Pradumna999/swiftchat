export default function NameInput({ value, onChange, error }) {
  return (
    <div className="field-group">
      <label className="field-label" htmlFor="preferred-name">
        Your preferred name
      </label>

      <input
        id="preferred-name"
        className="text-input"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="e.g. Alex"
        maxLength={24}
        autoComplete="off"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "name-error" : undefined}
      />

      <div className="field-footer">
        {error ? (
          <p className="field-error" id="name-error">
            {error}
          </p>
        ) : (
          <p className="field-hint">
            Just a display name. No account required.
          </p>
        )}

        <span className="character-count">{value.length}/24</span>
      </div>
    </div>
  );
}