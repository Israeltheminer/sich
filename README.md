# Sitch — Self-Improvement Communication Harness

Sitch sits between an application and an LLM. It doesn't answer the user's
question itself — it decides *how* the underlying LLM should say it, learns
that style from real interaction feedback, and gets better at it over time
without anyone hand-editing a prompt.

> AI should adapt to how people communicate — not the other way around.

## The problem this targets

A generic LLM defaults to one register: moderately formal, moderately
verbose, the same for a Lagos market chat as for a compliance email. Real
audiences don't all communicate the same way, and what counts as
appropriate tone shifts by demographic, culture, and over time. Hand-coding
a prompt per audience doesn't scale and never stays current. Sitch is a
layer that watches feedback on its own responses and updates its
communication guidance from that, automatically.

## Architecture

```
        message                         guided response
User ───────────► [ Sitch Harness ] ──────────────────► LLM (Groq)
                         │  ▲
                         │  │ communication profile
                         ▼  │ (traits + learned patterns)
                  [ Profile Store ]
                         ▲
                         │ proposed update (human-approved)
                         │
                [ Learning Agent ] ◄──── interactions + feedback
                                          [ Interaction Store ]
```

- **Harness** (`lib/sitch/harness.ts`) — turns a `CommunicationProfile`
  into a system prompt and calls the LLM. This is the part a developer
  integrates instead of talking to the LLM directly.
- **Profile Store** (`lib/sitch/profileStore.ts`, `data/profiles.json`) —
  persists each audience's traits, learned patterns, and full version
  history.
- **Interaction Store** (`lib/sitch/interactionStore.ts`,
  `data/interactions.json`) — logs every message/response pair and the
  feedback (👍/👎, a note, and/or "what it should have said instead")
  attached to it.
- **Learning Agent** (`lib/sitch/learningAgent.ts`) — the self-improvement
  loop. Given the interactions with feedback that haven't been analyzed
  yet, it prompts the LLM to act as a communication analyst: detect
  patterns, judge whether the evidence is strong enough to matter, and
  propose an updated profile. This is a **proposal**, not an automatic
  write — a human approves it (`/api/sitch/learn/apply`) before it takes
  effect. That's the one human-in-the-loop checkpoint the harness keeps;
  everything upstream of it (pattern detection, evidence weighing, drafting
  the new guidance) is agentic.
- **Reliability fallback**: if the LLM analyst call fails or returns
  unparseable output, the learning agent falls back to a small heuristic
  (`heuristicFallbackAnalysis` in `learningAgent.ts`) that compares
  response length and scans for informal/local phrasing in
  human-corrected examples, so the loop still completes instead of
  silently doing nothing. Every proposal reports whether this fallback
  ran (`usedFallbackHeuristic`).

## Running it

```bash
npm install
cp .env.example .env.local   # add a free Groq key from console.groq.com, or leave blank for mock mode
npm run seed                 # writes data/profiles.json + data/interactions.json
npm run dev
```

Open <http://localhost:3000>. Without `GROQ_API_KEY` set, every LLM call
returns a clearly-labeled mock response instead of failing — the whole
loop (respond → feedback → learn → apply) still works end-to-end so the
app is demoable with zero setup.

## The developer API

Sitch exposes itself as an API, not just a UI — the point is that another
application integrates the communication layer instead of rebuilding it.

```
POST /api/sitch/respond
{ "message": "Abeg, is this phone still available?", "profileId": "naija-marketplace" }

→ { "interactionId": "...", "response": "...", "profile": { "traits": {...}, "learnedPatterns": [...] }, "meta": {...} }
```

```
POST /api/sitch/feedback
{ "interactionId": "...", "verdict": "bad", "preferredResponse": "It's available, you want to order?" }
```

```
POST /api/sitch/learn        { "profileId": "naija-marketplace" }   → { "proposal": {...} }
POST /api/sitch/learn/apply  { "proposal": {...} }                  → { "profile": {...} }
GET  /api/sitch/profiles
GET  /api/sitch/profiles/:id  → profile + its full interaction history
```

`POST /api/sitch/compare` is playground-only: it runs the same message
through a generic baseline prompt *and* the Sitch-guided harness so the
before/after contrast can be shown side by side. A real integration would
only ever call `/respond`.

## Two seeded profiles

- **`default`** — cold start, no learned patterns. This is what Sitch
  sounds like before it has seen any feedback.
- **`naija-marketplace`** — a small online seller's chat audience, already
  through one learning cycle (`data/interactions.json` has the 5 example
  interactions/feedback that produced it — see `scripts/seed.ts`). This is
  what "after Sitch has learned" looks like, seeded so the demo doesn't
  depend on a live LLM call succeeding on stage.

You can also run the loop live: pick a profile, send a message, give
feedback, click **Run learning cycle**, review the agent's proposal, and
approve it.

## What's real vs. what's seeded

Every part of the loop — harness, feedback logging, agentic pattern
detection, profile versioning — runs live. The two things that are
deliberately pre-baked for demo reliability: the `naija-marketplace`
profile's starting learned patterns (so there's an "after" state to show
even if the network is bad on stage) and the mock-mode LLM fallback (so a
missing/rate-limited API key degrades gracefully instead of breaking the
demo). Both are called out explicitly in the UI (mock responses are
prefixed `[Sitch mock mode…]`; fallback-heuristic proposals say so).

## Repo layout

```
app/api/sitch/…        API routes (respond, compare, feedback, learn, learn/apply, profiles)
app/page.tsx            Playground page
components/             Playground UI (profile card, learning activity panel, etc.)
lib/sitch/               harness, learning agent, LLM client, JSON stores, types
data/                    profiles.json / interactions.json (seeded + demo-mutated at runtime)
scripts/seed.ts          resets data/ to the demo starting state
```

## Next steps

- Swap the JSON file store for a real database once this needs to run
  multi-tenant or survive a redeploy.
- Let a business define its own audience profile from scratch instead of
  only the two seeded ones (the API already supports arbitrary
  `profileId`s — `createProfile` in `lib/sitch/profileStore.ts` just isn't
  wired to a UI yet).
- Add an automatic trigger for learning cycles (e.g. every N feedback
  events) instead of the manual "Run learning cycle" button, once the
  proposal quality has been validated over more real traffic.
