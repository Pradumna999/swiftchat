export default function MessageBubble({ message }) {
  return (
    <article
      className={`message-row ${
        message.mine ? "message-mine" : "message-theirs"
      }`}
    >
      <div className="message-content">
        {!message.mine && (
          <span className="message-sender">
            {message.senderName}
          </span>
        )}

        <div className="message-bubble">
          {message.text}
        </div>

        {message.mine && (
          <span className="message-receipt">
            {message.status === "sending" ? "Sending…" : "Sent"}
          </span>
        )}
      </div>
    </article>
  );
}