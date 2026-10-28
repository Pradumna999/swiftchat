import { useState } from "react";

import JoinForm from "./components/JoinForm.jsx";
import SafetyNotice from "./components/SafetyNotice.jsx";

export default function App() {
  const [submittedProfile, setSubmittedProfile] = useState(null);

  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="brand" href="/" aria-label="Offscript home">
          <span className="brand-mark" aria-hidden="true">
            o.
          </span>
          <span>offscript</span>
        </a>

        <span className="topbar-note">
          Anonymous by design
        </span>
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
            about something unexpected. No account, no social
            pressure.
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
            Preview build · Live matching is not connected yet
          </p>
        </div>

        <section className="join-card" aria-labelledby="join-title">
          <div className="card-heading">
            <p className="card-eyebrow">YOUR NEXT CONVERSATION</p>
            <h2 id="join-title">Who should you meet?</h2>
            <p>Set your preferences before entering the queue.</p>
          </div>

          <JoinForm onStart={setSubmittedProfile} />

          {submittedProfile && (
            <section className="preview-result" role="status">
              <div className="result-heading">
                <span className="result-check" aria-hidden="true">
                  ✓
                </span>

                <div>
                  <h3>Preferences validated</h3>
                  <p>
                    Hey, {submittedProfile.preferredName}!
                    Your form is ready.
                  </p>
                </div>
              </div>

              <dl className="profile-summary">
                <div>
                  <dt>Matching mode</dt>
                  <dd>
                    {submittedProfile.mode === "random"
                      ? "Random chat"
                      : "Shared interests"}
                  </dd>
                </div>

                <div>
                  <dt>Interests</dt>
                  <dd>
                    {submittedProfile.interests.length > 0
                      ? submittedProfile.interests.join(", ")
                      : "None selected"}
                  </dd>
                </div>
              </dl>

              <p className="preview-message">
                This is a local preview only. No partner has been
                matched, and no data has been sent to a backend.
              </p>
            </section>
          )}

          <SafetyNotice />
        </section>
      </section>

      <footer className="site-footer">
        <span>offscript · early build</span>
        <span>Talk freely. Protect your identity.</span>
      </footer>
    </main>
  );
}