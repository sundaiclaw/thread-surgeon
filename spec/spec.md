# Thread Surgeon

## What it does
Thread Surgeon turns messy chat logs into a clear decision brief. A user pastes a chaotic team thread and gets:
- core decisions already made
- unresolved questions and contradictions
- owners / missing owners
- a heat score for urgency and conflict
- a ready-to-send next message to unblock the thread

## Tech stack
- React + Vite frontend
- Node.js + Express backend
- OpenRouter chat completions using a free model from env
- marked + DOMPurify-style safe render pattern for markdown output

## AI requirements
- Use OpenRouter env vars only
- Make a real model call in the main user flow
- Return structured JSON plus markdown draft message
- Render the AI output as human-friendly cards and formatted text

## Demo flow
1. Paste a chaotic thread.
2. Click Operate.
3. View decisions, risks, contradictions, suggested reply, and escalation score.
