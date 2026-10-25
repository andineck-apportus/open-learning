# Setup

## Local development

Node.js 22+ recommended.

```sh
npm install
cp .env.example .env
npm run dev
```

For optional photo-to-entry extraction, run `npm run dev:ai` in a separate terminal with `OPENAI_API_KEY` set **server-side** in its environment. The Vite dev proxy routes `/api/extract` to localhost:8787. This API example has **no authentication or rate limits**: **never** expose it to the public internet.

## Publish

See [GitHub Pages deployment](deployment.md). Cloud login requires OAuth registrations; Pages itself does not provide an AI backend.

## Register Google OAuth

1. Create a Google Cloud project and enable the Google Drive API.
2. Configure Google Auth Platform consent screen and test users for development.
3. Create an OAuth client of type Web application and register:
   - Local origin `http://localhost:5173`, redirect `http://localhost:5173/`.
   - Production origin `https://andineck-apportus.github.io`, redirect `https://andineck-apportus.github.io/open-learning/`.
4. Add the public client ID to `VITE_GOOGLE_CLIENT_ID` locally or the `GOOGLE_CLIENT_ID` GitHub Actions repository variable for Pages.
5. Consent to the `drive.appdata` scope. Open Settings in the app, connect and explicitly synchronize.

The application attempts to use the hidden `appDataFolder`; files will **not** appear in ordinary Google Drive folders.

## Register Microsoft OAuth

1. Register an application in Microsoft Entra with **personal Microsoft accounts** supported.
2. Add platform **Single-page application (SPA)** with redirect:
   - `http://localhost:5173/`
   - `https://andineck-apportus.github.io/open-learning/`
3. Enable delegated Graph scopes `Files.ReadWrite.AppFolder` and `User.Read`. Confirm consent availability for the account type.
4. Add its **Application (client) ID** to `VITE_MICROSOFT_CLIENT_ID` locally or the `MICROSOFT_CLIENT_ID` repository variable.
5. Connect and explicitly sync from Settings. Data target: Graph `/me/drive/special/approot`.

## Known limitations and safety

- Saving always happens locally first using IndexedDB; cloud sync is currently manual.
- OAuth tokens are in memory only: reconnect on reload or expiry.
- Google Drive sync uses a version check, **not guaranteed atomic**; concurrent writes can lose changes. OneDrive tries conditional writes.
- Synchronization merges attempts by unique ID, and chooses newer set versions. If two devices edit the same set simultaneously, some changes can be lost.
- The demo seeded Unité 2; it does not import ChatGPT's own saved flashcard reviews.
- No production-ready BYOAI implementation: the example Node bridge uses its operator's API key and must be secured before use on a public site.
- Back up regularly through Settings → JSON export.
- Production readiness needs authorization testing, improved synchronization, account and privacy UX, tests and security review, particularly because children may use it.
