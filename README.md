# Open Learning

Open-source, subject-independent learning app. MIT licensed. Designed for **Bring Your Own Everything**: identity, cloud storage and AI provider.

## Run locally

```bash
npm install
npm run dev
```

## Current prototype

- React + TypeScript + Vite
- 28 French/German entries from Unité 2 as seed data (review before use)
- Bidirectional writing practice, two attempts, hints, results and retry round
- Editable entries, local browser persistence and JSON export

**Important:** This is a local prototype, not a production cloud application. Photo-to-content AI, Google Drive/OneDrive OAuth and sync, true offline PWA, multiuser accounts, persistent cross-device results, advanced error highlighting, subject-agnostic import and FSRS are not yet implemented.

## Principles

1. User owns data; support export and provider migration.
2. Human approval of AI-extracted material before saving.
3. Keep source documents, reviewed learning items and attempt events separate.
4. Do not expose API keys in frontend code.
5. Protect children's data; least-privilege OAuth and minimal data collection.
6. Keep storage and AI providers behind replaceable interfaces.

See `docs/adr/0001-byoe.md`.
