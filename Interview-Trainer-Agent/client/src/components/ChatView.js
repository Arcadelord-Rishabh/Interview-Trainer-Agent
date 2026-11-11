import React from "react";
import { MODES } from "../modes";
import { useChat } from "../hooks/useChat";
import { MessageFeed } from "./MessageFeed";
import { InputBar } from "./InputBar";

// ── Resume panel (only shown in resume_review mode) ────────────────────────
function ResumePanel({ value, onChange }) {
  return (
    <div className="resume-panel">
      <p className="resume-panel__label">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        Paste your resume here
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste the full text of your resume. The agent will use it as context for every message."
        aria-label="Resume text"
      />
    </div>
  );
}

// ── Chat view ──────────────────────────────────────────────────────────────
export function ChatView({ modeId, onBack }) {
  const mode = MODES.find((m) => m.id === modeId);
  const { messages, isTyping, send } = useChat(modeId);
  const [resumeText, setResumeText] = React.useState("");

  const handleSend = (text) => send(text, resumeText);

  return (
    <div className="chat-view">
      <button className="back-btn" onClick={onBack} aria-label="Back to mode selection">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Change mode
      </button>

      {modeId === "resume_review" && (
        <ResumePanel value={resumeText} onChange={setResumeText} />
      )}

      <MessageFeed messages={messages} isTyping={isTyping} />

      <InputBar onSend={handleSend} disabled={isTyping} />
    </div>
  );
}
