import React from "react";

export function TypingIndicator() {
  return (
    <div className="msg-row assist" role="status" aria-label="Agent is typing">
      <div className="msg-avatar" aria-hidden="true">IT</div>
      <div className="typing-indicator" aria-hidden="true">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}
