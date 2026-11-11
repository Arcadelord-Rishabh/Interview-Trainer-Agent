import React, { useEffect, useRef } from "react";
import { TypingIndicator } from "./TypingIndicator";

export function MessageFeed({ messages, isTyping }) {
  const bottomRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="message-feed" role="log" aria-live="polite" aria-label="Conversation">
      {messages.length === 0 && !isTyping && (
        <div className="feed-empty">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Send a message to get started.</span>
        </div>
      )}

      {messages.map((msg, i) => (
        <div
          key={i}
          className={`msg-row ${msg.role === "user" ? "user" : "assist"}`}
        >
          <div className="msg-avatar" aria-hidden="true">
            {msg.role === "user" ? "You" : "IT"}
          </div>
          <div
            className={`msg-bubble${msg.isError ? " error-bubble" : ""}`}
            role={msg.isError ? "alert" : undefined}
          >
            {msg.content}
          </div>
        </div>
      ))}

      {isTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
