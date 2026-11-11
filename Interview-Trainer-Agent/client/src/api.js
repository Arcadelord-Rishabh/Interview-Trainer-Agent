/**
 * api.js — all communication with the Express proxy lives here.
 *
 * POST /api/chat
 *   body:    { mode, messages, resumeText? }
 *   returns: { reply: string }
 */
export async function sendMessage({ mode, messages, resumeText = "" }) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, messages, resumeText }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Server error ${res.status}`);
  }

  return res.json(); // { reply: string }
}
