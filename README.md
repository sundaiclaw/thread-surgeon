# Thread Surgeon

Thread Surgeon turns chaotic team threads into a clear decision brief. Paste a messy launch, product, or ops conversation and it extracts decisions, contradictions, unresolved questions, named owners, missing owners, and a ready-to-send reply that can unblock the team.

## What it does

- analyzes a pasted thread with a real OpenRouter model
- scores urgency with a heat level
- surfaces contradictions and ownership gaps
- drafts a concise reply in markdown you can paste back into chat
- gives teams a shared reality check when a thread is spiraling

## How to Run (from zero)

### Prerequisites

- Node.js 22+
- an OpenRouter API key
- a free OpenRouter model name

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/sundaiclaw/thread-surgeon.git
   ```
2. Enter the project:
   ```bash
   cd thread-surgeon/app
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create an env file:
   ```bash
   cp .env.example .env
   ```
5. Set these variables in `.env`:
   ```bash
   OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
   OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free
   OPENROUTER_API_KEY=your_key_here
   PORT=8787
   ```
6. Start the app:
   ```bash
   npm run dev
   ```
7. Open the local URL:
   ```
   http://localhost:5173
   ```

## Limitations / known gaps

- Results are only as good as the pasted thread context.
- The app does not yet ingest screenshots, email chains, or uploaded files.
- It currently focuses on one thread at a time rather than cross-thread memory.
- Output quality depends on the selected OpenRouter free model.

## Stack

- React + Vite
- Express
- OpenRouter chat completions
- Cloud Run

Build on Sundai Club on March 29, 2026  
Sundai Project: https://www.sundai.club/projects/ea99ef89-8467-48d1-bae4-aae3f7dc6f87
