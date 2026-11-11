import React, { useState } from "react";
import { MODES } from "./modes";
import { ChatView } from "./components/ChatView";
import "./styles/index.css";

// ── Header ─────────────────────────────────────────────────────────────────
function Header({ activeMode }) {
  const mode = MODES.find((m) => m.id === activeMode);
  return (
    <header className="header">
      <span className="header__brand">
        Interview <span>Trainer</span>
      </span>
      {mode && (
        <span className="header__mode-badge">{mode.label}</span>
      )}
    </header>
  );
}

// ── Landing page ───────────────────────────────────────────────────────────
function Landing({ onStart }) {
  const [selected, setSelected] = useState(null);

  return (
    <main className="landing">
      <p className="landing__eyebrow">Powered by IBM watsonx Orchestrate</p>
      <h1 className="landing__title">Your personal interview coach, available 24 / 7.</h1>
      <p className="landing__subtitle">
        Practice answers, polish your resume, build a preparation roadmap, or ask
        anything about your job search — in one conversational session.
      </p>

      <div className="mode-grid" role="listbox" aria-label="Select a mode">
        {MODES.map((mode) => (
          <div
            key={mode.id}
            className={`mode-card${selected === mode.id ? " active" : ""}`}
            role="option"
            aria-selected={selected === mode.id}
            tabIndex={0}
            onClick={() => setSelected(mode.id)}
            onKeyDown={(e) => e.key === "Enter" && setSelected(mode.id)}
          >
            <div className="mode-card__icon">{mode.icon}</div>
            <p className="mode-card__title">{mode.label}</p>
            <p className="mode-card__desc">{mode.description}</p>
          </div>
        ))}
      </div>

      <button
        className="landing__cta"
        disabled={!selected}
        onClick={() => selected && onStart(selected)}
      >
        Start session →
      </button>
    </main>
  );
}

// ── App root ───────────────────────────────────────────────────────────────
export default function App() {
  const [activeMode, setActiveMode] = useState(null);

  return (
    <div className="app">
      <Header activeMode={activeMode} />
      {activeMode ? (
        <ChatView modeId={activeMode} onBack={() => setActiveMode(null)} />
      ) : (
        <Landing onStart={setActiveMode} />
      )}
    </div>
  );
}
