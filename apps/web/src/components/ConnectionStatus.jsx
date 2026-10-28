const LABELS = {
  connecting: "Connecting to your conversation…",
  waiting: "Waiting for the other person to connect…",
  connected: "Connected · Messages are live",
  ending: "Ending conversation…",
  ended: "Conversation ended",
  error: "Connection problem",
};

export default function ConnectionStatus({ status }) {
  return (
    <div className={`connection-status status-${status}`}>
      <span className="connection-dot" aria-hidden="true" />
      <span>{LABELS[status] ?? "Preparing conversation…"}</span>
    </div>
  );
}