# Interview Trainer Agent — Frontend + Backend

A React + Node.js/Express application that provides a professional career-coaching chat interface, backed by your IBM watsonx Orchestrate agent.

---

## Project structure

```
interview-trainer/
├── client/          # React frontend (Create React App)
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── ChatView.js        – chat shell, includes resume panel
│       │   ├── InputBar.js        – auto-growing textarea + send button
│       │   ├── MessageFeed.js     – scrollable message list
│       │   └── TypingIndicator.js – animated "agent is typing" dots
│       ├── hooks/
│       │   └── useChat.js         – conversation state & API calls
│       ├── styles/
│       │   └── index.css          – design tokens + all component styles
│       ├── api.js                 – fetch wrapper (talks to Express proxy)
│       ├── App.js                 – landing page + mode selector
│       ├── index.js               – React entry point
│       └── modes.js               – mode definitions (id, label, description)
└── server/
    ├── index.js                   – Express proxy server  ← API contract here
    ├── package.json
    └── .env.example               – copy to .env and fill in your credentials
```

---

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9

---

## Quick start

### 1 — Set up the backend

```bash
cd interview-trainer/server
npm install
cp .env.example .env
```

Open `server/.env` and fill in your Orchestrate credentials:

```
ORCHESTRATE_API_ENDPOINT=https://your-orchestrate-agent-endpoint
ORCHESTRATE_API_KEY=your_api_key_here
FRONTEND_ORIGIN=http://localhost:3000   # must match wherever CRA runs
PORT=4000
```

Start the server (development — auto-restarts on save):

```bash
npm run dev
```

Or for production:

```bash
npm start
```

The server listens on **http://localhost:4000**.

---

### 2 — Set up the frontend

In a **separate terminal**:

```bash
cd interview-trainer/client
npm install
npm start
```

The React dev server starts on **http://localhost:3000** and proxies all
`/api/*` requests to the Express server automatically (configured via the
`"proxy"` field in `client/package.json`).

---

## Updating the Orchestrate API contract

> **You only need to touch one file:** `server/index.js`

Look for the banner comment:

```
⚠️  ORCHESTRATE API CONTRACT — EDIT THIS BLOCK WHEN YOU KNOW YOUR AGENT'S
    EXACT PAYLOAD / RESPONSE SHAPE.
```

Two clearly-named functions sit right below it:

| Function | What to update |
|---|---|
| `buildRequestPayload(mode, messages, resumeText)` | Shape the JSON **sent** to your agent |
| `extractReply(responseData)` | Pull the assistant text **out of** the response |

### Example — if your agent expects `{ prompt, session_id }` and returns `{ output: string }`:

```js
function buildRequestPayload(mode, messages, resumeText) {
  return {
    prompt: messages[messages.length - 1]?.content ?? "",
    session_id: "interview-trainer",
  };
}

function extractReply(responseData) {
  return responseData.output ?? "No response from agent.";
}
```

Nothing else in `server/index.js` needs changing.

---

## Environment variables reference

| Variable | Where | Description |
|---|---|---|
| `ORCHESTRATE_API_ENDPOINT` | `server/.env` | Full URL to your Orchestrate agent's chat endpoint |
| `ORCHESTRATE_API_KEY` | `server/.env` | API key / IAM bearer token |
| `ORCHESTRATE_INSTANCE_ID` | `server/.env` (optional) | Instance ID header, if required by your agent |
| `PORT` | `server/.env` | Express server port (default `4000`) |
| `FRONTEND_ORIGIN` | `server/.env` | Allowed CORS origin (default `http://localhost:3000`) |

> **Security note:** `ORCHESTRATE_API_KEY` is read only by the Express server.  
> It is never embedded in the React build or sent to the browser.

---

## Production build

```bash
# Build the React app
cd interview-trainer/client
npm run build

# Serve the build folder with any static host, or let Express serve it:
# (add express.static('client/build') to server/index.js)
```

---

## Adding a new interview mode

1. Add an entry to [`client/src/modes.js`](client/src/modes.js) — `id`, `label`, `description`, `icon`.
2. The mode `id` is automatically passed to the backend as the `mode` field — use it in `buildRequestPayload` to steer the agent.
3. If the new mode needs a special input panel (like the resume text area), add it to [`client/src/components/ChatView.js`](client/src/components/ChatView.js).
