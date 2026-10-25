# Open Learning

**Universal learning app · MIT · Bring Your Own Everything**

A React/TypeScript browser app for languages, history and more. Organize subjects, create sets, photograph book pages, review suggested entries, write answers in both directions and keep study history.

## Quick start

```sh
npm install
cp .env.example .env
npm run dev
```

See [setup and OAuth instructions](docs/setup.md).

## Features in v0.2

- Subject and study-set management with 28 seed entries from French Unité 2
- Editable entries; import from tab/semicolon-separated text, with review before approval
- Photo upload + optional AI extraction via a local Node/OpenAI bridge
- Written-answer practice, two tries with hint, mistake review, and congratulations
- IndexedDB local saving, manual JSON backup and restore
- Google Drive appDataFolder and OneDrive app-root connection using OAuth PKCE and user-owned storage
- Attempts preserved by UUID and merged from cloud during explicit synchronization

## Project state and limits

This is an **early development prototype**, not yet production-ready. You must register your own Google/Microsoft OAuth applications before cloud login works. The AI photo import requires a separately launched, server-side OpenAI API bridge. This is not yet a general secure BYO-key service. We have not verified live cloud OAuth accounts or simultaneous writes; see [setup](docs/setup.md).

The existing ChatGPT flashcard deck is separate from this application's stored study attempts and is not automatically synchronized.

## Open source

MIT license. Contributions welcome. No key or secret should be committed to Git.

## AI photo import (bring your own key)

A small optional Cloudflare Worker (`worker/src/index.js`) accepts a per-session OpenAI API key and an image, returns proposed entries and never persists credentials. The learner must review every entry. The static app can run without this feature. Deploy the Worker yourself and paste its HTTPS URL in **Einstellungen → KI-Verbindung**. See [Worker setup](docs/ai-worker.md).

**Security:** A user-entered key is still accessible to scripts in that browser session and to the Worker operator. Use a limited project key, not a privileged credential. The Worker is not a centrally managed secure credential vault.
