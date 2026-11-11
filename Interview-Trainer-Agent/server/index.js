require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

// ─── Env validation ───────────────────────────────────────────────────────────
// Trim every env var we care about so that accidental whitespace/newlines in
// the .env file never produce an "Invalid URL" at runtime.
const ORCHESTRATE_ENDPOINT = (process.env.ORCHESTRATE_API_ENDPOINT || "").trim();
const ORCHESTRATE_KEY      = (process.env.ORCHESTRATE_API_KEY      || "").trim();
const IAM_TOKEN_URL        = (process.env.IAM_TOKEN_URL || "https://iam.cloud.ibm.com/identity/token").trim();

const MISSING_PLACEHOLDER = [
  "https://your-orchestrate-agent-endpoint-here",
  "your_api_key_here",
];

(function validateEnv() {
  const errors = [];

  if (!ORCHESTRATE_ENDPOINT) {
    errors.push("  • ORCHESTRATE_API_ENDPOINT is not set in server/.env");
  } else if (MISSING_PLACEHOLDER.includes(ORCHESTRATE_ENDPOINT)) {
    errors.push("  • ORCHESTRATE_API_ENDPOINT is still the placeholder value — replace it with your real endpoint");
  } else {
    // Confirm it is a parseable URL before we ever try to call it
    try {
      new URL(ORCHESTRATE_ENDPOINT);
    } catch {
      errors.push(`  • ORCHESTRATE_API_ENDPOINT is not a valid URL: "${ORCHESTRATE_ENDPOINT}"`);
    }
  }

  if (!ORCHESTRATE_KEY) {
    errors.push("  • ORCHESTRATE_API_KEY is not set in server/.env");
  } else if (MISSING_PLACEHOLDER.includes(ORCHESTRATE_KEY)) {
    errors.push("  • ORCHESTRATE_API_KEY is still the placeholder value — replace it with your real key");
  }

  if (errors.length) {
    console.error("\n[Interview Trainer] ❌  Missing or invalid environment variables:\n");
    errors.forEach((e) => console.error(e));
    console.error("\n  → Copy server/.env.example to server/.env and fill in your credentials.\n");
    process.exit(1);
  }

  // Safe to log the endpoint (not the key) so you can confirm what was loaded
  console.log(`[Interview Trainer] ✅  Orchestrate endpoint: ${ORCHESTRATE_ENDPOINT}`);
})();

const app = express();
const PORT = process.env.PORT || 4000;

// ─── CORS ────────────────────────────────────────────────────────────────────
// Only accept requests from the React dev server (or your deployed frontend).
// Update FRONTEND_ORIGIN in .env when deploying.
const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
app.use(
  cors({
    origin: allowedOrigin,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

// ─── IAM token exchange ───────────────────────────────────────────────────────
// IBM Cloud API keys cannot be used directly as Bearer tokens — they must first
// be exchanged for a short-lived IAM access token via the token endpoint.
//
// The token is cached in memory and reused until 60 s before it expires,
// so we don't call IAM on every single chat request.
//
// Reference: https://cloud.ibm.com/docs/account?topic=account-iamtoken_from_apikey

let _iamCache = { token: null, expiresAt: 0 };

/**
 * Returns a valid IAM access token, fetching a fresh one when the cached
 * token is missing or within 60 seconds of expiry.
 *
 * @returns {Promise<string>} raw access token (no "Bearer" prefix)
 */
async function getIamToken() {
  const nowSec = Math.floor(Date.now() / 1000);
  const bufferSec = 60; // refresh this many seconds before actual expiry

  if (_iamCache.token && nowSec < _iamCache.expiresAt - bufferSec) {
    return _iamCache.token; // still valid — reuse
  }

  const params = new URLSearchParams({
    grant_type: "urn:ibm:params:oauth:grant-type:apikey",
    apikey: ORCHESTRATE_KEY,
  });

  const response = await axios.post(IAM_TOKEN_URL, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const { access_token, expires_in } = response.data;
  _iamCache = {
    token: access_token,
    // expires_in is seconds from now; fall back to 1 hour if not present
    expiresAt: nowSec + (expires_in ?? 3600),
  };

  console.log("[Interview Trainer] 🔑  IAM token refreshed");
  return _iamCache.token;
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── Orchestrate proxy ────────────────────────────────────────────────────────
// POST /api/chat
//
// Receives:  { mode, messages, resumeText? }
//   mode        – one of "mock_interview" | "resume_review" | "prep_roadmap" | "general_qa"
//   messages    – array of { role: "user"|"assistant", content: string }
//   resumeText  – (optional) plain-text resume, only sent in "resume_review" mode
//
// Returns:  { reply: string }
//
// ┌─────────────────────────────────────────────────────────────────────────────
// │  ⚠️  ORCHESTRATE API CONTRACT — EDIT THIS BLOCK WHEN YOU KNOW YOUR AGENT'S
// │  EXACT PAYLOAD / RESPONSE SHAPE.
// │
// │  1. buildRequestPayload() — shapes the JSON body sent to your agent.
// │  2. extractReply()        — extracts the assistant text from the response.
// │
// │  Check your agent's API docs / test it in the Orchestrate UI and update
// │  these two functions accordingly.  Nothing else in this file needs to change.
// └─────────────────────────────────────────────────────────────────────────────

/**
 * Build the JSON payload for the Orchestrate agent.
 *
 * @param {string}  mode        – active interview mode
 * @param {Array}   messages    – conversation history [{role, content}, ...]
 * @param {string}  resumeText  – raw resume text (may be empty string)
 * @returns {object} body sent to the agent endpoint
 */
function buildRequestPayload(mode, messages, resumeText) {
  // Build the system prompt from the active mode and optional resume text.
  const systemContent = [
    `You are an expert career coach running a session in "${mode}" mode.`,
    resumeText ? `The candidate's resume:\n\n${resumeText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    messages: [
      { role: "system", content: systemContent },
      // Spread the full conversation history so the agent has context.
      ...messages,
    ],
  };
}

/**
 * Parse an SSE stream (plain text) returned by Orchestrate and return the
 * assembled reply text.
 *
 * Orchestrate streams many `data: {...}` lines where each chunk has:
 *   { object: "thread.message.delta",    choices: [{ delta: { content: "..." } }] }
 *
 * The final line has:
 *   { object: "thread.message.completed", choices: [{ message: { content: "..." } }] }
 *
 * Strategy: use the completed event's choices[0].message.content (the fully
 * assembled string Orchestrate provides). Fall back to concatenating all
 * delta chunks if the completed event is absent.
 */
function extractReply(sseText) {
  const lines = sseText.split("\n");
  let completedContent = null;
  const deltaChunks = [];

  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const raw = line.slice(5).trim();
    if (!raw || raw === "[DONE]") continue;

    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      continue; // skip malformed lines
    }

    if (event.object === "thread.message.completed") {
      // Prefer the full assembled content from the completed event.
      completedContent =
        event.choices?.[0]?.message?.content ??
        event.data?.message?.content?.[0]?.text ??
        null;
    } else if (event.object === "thread.message.delta") {
      const chunk = event.choices?.[0]?.delta?.content;
      if (chunk) deltaChunks.push(chunk);
    }
  }

  return completedContent ?? deltaChunks.join("") ?? "No response from agent.";
}

// ─── Route ─────────────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { mode, messages, resumeText = "" } = req.body;

  if (!mode || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "mode and messages are required." });
  }

  try {
    // Exchange the API key for a short-lived IAM access token before each call.
    // getIamToken() caches the result so IAM is only hit when the token is
    // about to expire — not on every request.
    const iamToken = await getIamToken();

    // responseType: "text" keeps axios from trying to JSON.parse the SSE stream.
    const orchestrateResponse = await axios.post(
      ORCHESTRATE_ENDPOINT,
      buildRequestPayload(mode, messages, resumeText),
      {
        responseType: "text",
        headers: {
          "Content-Type": "application/json",
          // IAM access token — never exposed to the browser.
          Authorization: `Bearer ${iamToken}`,
          // Some Orchestrate deployments also require an instance ID header:
          // "X-IBM-Instance-Id": process.env.ORCHESTRATE_INSTANCE_ID?.trim(),
        },
      }
    );

    const reply = extractReply(orchestrateResponse.data);
    return res.json({ reply });
  } catch (err) {
    const status = err.response?.status ?? 500;
    const message =
      err.response?.data?.message ?? err.message ?? "Upstream error";
    // Log the full upstream response body so validation errors are visible.
    console.error("[Orchestrate proxy error]", status, message);
    if (err.response?.data) {
      console.error("[Orchestrate response body]", JSON.stringify(err.response.data, null, 2));
    }
    return res.status(status).json({ error: message });
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Interview Trainer server running on http://localhost:${PORT}`);
  console.log(`Accepting requests from: ${allowedOrigin}`);
});
