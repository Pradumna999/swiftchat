import { useState } from "react";

import JoinForm from "./components/JoinForm.jsx";
import SafetyNotice from "./components/SafetyNotice.jsx";
import QueueStatus from "./components/QueueStatus.jsx";
import ChatHeader from "./components/ChatHeader.jsx";
import ConnectionStatus from "./components/ConnectionStatus.jsx";
import MessageList from "./components/MessageList.jsx";
import MessageComposer from "./components/MessageComposer.jsx";
import EndChatButton from "./components/EndChatButton.jsx";

import { useMatchmaking } from "./features/matchmaking/useMatchmaking.js";
import { useChatSocket } from "./features/chat/useChatSocket.js";

import "./styles/chat.css";

export default function App() {
  const [profile, setProfile] = useState(null);

  const {
    status: matchStatus,
    match,
    error: matchError,
    startMatching,
    cancelMatching,
    resetSession,
  } = useMatchmaking();

  const {
    status: chatStatus,
    peer,
    messages,
    notice,
    sendMessage,
    endChat,
  } = useChatSocket(match, profile?.preferredName);

  function handleStart(preferences) {
    setProfile(preferences);
    startMatching(preferences);
  }

  function handleReset() {
    resetSession();
    setProfile(null);
  }

  const isSearching = ["connecting", "waiting"].includes(matchStatus);

  const isActiveChat =
    matchStatus === "matched" &&
    ["idle", "connecting", "waiting", "connected", "ending"].includes(
      chatStatus
    );

  const isFinishedChat =
    matchStatus === "matched" &&
    ["ended", "error"].includes(chatStatus);

  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="brand" href="/" aria-label="SwiftChat home">
          <span className="brand-mark" aria-hidden="true">
            s.
          </span>
          <span>swiftchat</span>
        </a>

        <span className="topbar-note">Anonymous by design</span>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" />
            TWO PEOPLE. ONE CONVERSATION.
          </p>

          <h1>
            Skip the profiles.
            <br />
            <span>Start a conversation.</span>
          </h1>

          <p className="hero-description">
            Meet someone new, find common ground, or simply talk
            about something unexpected. No account, no social pressure.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-number">01</span>
              <div>
                <strong>No sign-up</strong>
                <p>Choose a display name and get started.</p>
              </div>
            </div>

            <div className="feature-item">
              <span className="feature-number">02</span>
              <div>
                <strong>Your choice</strong>
                <p>Meet anyone or prioritize shared interests.</p>
              </div>
            </div>

            <div className="feature-item">
              <span className="feature-number">03</span>
              <div>
                <strong>Ephemeral chats</strong>
                <p>Designed without saved conversation history.</p>
              </div>
            </div>
          </div>

          <p className="demo-note">
            Live text chat · No user accounts
          </p>
        </div>

        <section className="join-card" aria-labelledby="join-title">
          {isSearching && (
            <QueueStatus
              status={matchStatus}
              error={matchError}
              onCancel={cancelMatching}
            />
          )}

          {(matchStatus === "idle" || matchStatus === "error") && (
            <>
              <div className="card-heading">
                <p className="card-eyebrow">YOUR NEXT CONVERSATION</p>
                <h2 id="join-title">Who should you meet?</h2>
                <p>
                  Set your preferences before entering the queue.
                </p>
              </div>

              {matchError && (
                <p className="app-error" role="alert">
                  {matchError}
                </p>
              )}

              <JoinForm onStart={handleStart} />
              <SafetyNotice />
            </>
          )}

          {isActiveChat && (
            <div className="chat-panel">
              <ChatHeader peer={peer ?? match?.peer} />

              <ConnectionStatus status={chatStatus} />

              {notice && (
                <p className="chat-notice" role="status">
                  {notice}
                </p>
              )}

              <MessageList
                messages={messages}
                ownName={profile?.preferredName}
              />

              <MessageComposer
                onSend={sendMessage}
                disabled={chatStatus !== "connected"}
              />

              <div className="chat-actions">
                <span className="ephemeral-note">
                  Messages are held in memory for this session.
                </span>

                <EndChatButton
                  onClick={endChat}
                  disabled={
                    ["ending", "ended", "error"].includes(chatStatus)
                  }
                />
              </div>
            </div>
          )}

          {isFinishedChat && (
            <div className="ended-panel" aria-live="polite">
              <div className="ended-icon" aria-hidden="true">
                ✓
              </div>

              <p className="card-eyebrow">SESSION CLOSED</p>

              <h2>
                {chatStatus === "error"
                  ? "Connection interrupted"
                  : "Conversation ended"}
              </h2>

              <p>
                {notice ||
                  "Your live message list has been cleared. You can start a fresh conversation."}
              </p>

              <button
                className="start-button"
                type="button"
                onClick={handleReset}
              >
                Find someone else <span aria-hidden="true">↗</span>
              </button>
            </div>
          )}
        </section>
      </section>

      <footer className="site-footer">
        <span>swiftchat · live text chat</span>
        <span>Talk freely. Protect your identity.</span>
      </footer>
    </main>
  );
}