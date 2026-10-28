export default function SafetyNotice() {
  return (
    <aside className="safety-notice">
      <span className="safety-icon" aria-hidden="true">
        !
      </span>

      <div>
        <strong>Keep your identity private</strong>
        <p>
          Never share passwords, financial details, or your precise
          address with strangers.
        </p>
      </div>
    </aside>
  );
}