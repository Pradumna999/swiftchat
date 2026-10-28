export default function ChatHeader({ peer }) {
  return (
    <header className="chat-header">
      <div className="peer-avatar" aria-hidden="true">
        {(peer?.preferredName || "?").charAt(0).toUpperCase()}
      </div>

      <div className="peer-details">
        <p className="card-eyebrow">YOUR CONVERSATION</p>
        <h2>{peer?.preferredName || "Stranger"}</h2>

        {peer?.interests?.length > 0 && (
          <div className="peer-interests">
            {peer.interests.map((interest) => (
              <span key={interest}>{interest}</span>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}