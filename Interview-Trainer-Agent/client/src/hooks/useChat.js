import { useState, useCallback } from "react";
import { sendMessage } from "../api";

export function useChat(mode) {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping]  = useState(false);
  const [error,    setError]     = useState(null);

  const send = useCallback(
    async (userText, resumeText = "") => {
      if (!userText.trim()) return;

      const updated = [...messages, { role: "user", content: userText.trim() }];
      setMessages(updated);
      setIsTyping(true);
      setError(null);

      try {
        const data = await sendMessage({ mode, messages: updated, resumeText });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      } catch (err) {
        setError(err.message);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: err.message, isError: true },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [messages, mode]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setIsTyping(false);
  }, []);

  return { messages, isTyping, error, send, reset };
}
