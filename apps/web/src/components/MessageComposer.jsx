import { useState } from "react";

export default function MessageComposer({
  onSend,
  disabled,
}) {
  const [text, setText] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (disabled || !text.trim()) {
      return;
    }

    if (onSend(text)) {
      setText("");
    }
  }

  return (
    <form className="message-composer" onSubmit={handleSubmit}>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={
          disabled
            ? "Waiting for the connection…"
            : "Write a message…"
        }
        maxLength={2000}
        rows={2}
        disabled={disabled}
        aria-label="Your message"
      />

      <div className="composer-footer">
        <span>{text.length}/2000 · Text is not saved by the app</span>

        <button
          className="send-button"
          type="submit"
          disabled={disabled || !text.trim()}
        >
          Send <span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  );
}