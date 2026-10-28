import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble.jsx";

export default function MessageList({ messages, ownName }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  return (
    <div className="message-list" aria-live="polite">
      {messages.length === 0 ? (
        <div className="chat-empty">
          <div className="chat-empty-icon" aria-hidden="true">
            ↗
          </div>

          <h3>You're connected.</h3>

          <p>
            Say hello, ask a question, or start with something you
            both find interesting.
          </p>
        </div>
      ) : (
        messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={{
              ...message,
              senderName: message.mine
                ? ownName || "You"
                : message.senderName,
            }}
          />
        ))
      )}

      <div ref={bottomRef} />
    </div>
  );
}