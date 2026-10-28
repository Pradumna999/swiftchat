export default function EndChatButton({
  onClick,
  disabled = false,
}) {
  return (
    <button
      className="end-chat-button"
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      End chat
    </button>
  );
}