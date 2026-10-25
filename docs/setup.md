# Setup and operations

## Run

Node.js 22+ recommended.

```sh
npm install
cp .env.example .env
npm run dev
```

For photo recognition, open a second shell with `OPENAI_API_KEY` loaded as a **server environment variable** and run `npm run dev:ai`. The Vite development proxy routes `/api/extract` to port 8787. Never expose this unauthenticated bridge directly to the public internet. Before public deployment, add authentication, rate limiting, per-user quotas and abuse protection.

## Google Drive

1. Create project in Google Cloud Console, enable **Google Drive API**.
2. Configure OAuth consent screen and, if in testing, add test users. Public launch may require app review.
3. Create OAuth **Web application** client; authorized JavaScript origin `http://localhost:5173`, redirect URI `http://localhost:5173/`. Add your production origin and redirect separately.
4. Put the client ID in `VITE_GOOGLE_CLIENT_ID`, restart Vite.
5. Sign in and press **Cloud synchronisieren**. Data are stored as `open-learning.json` in private `appDataFolder` using `drive.appdata` scope, not in ordinary visible Drive folders.

## Microsoft OneDrive

1. Register an app in Microsoft Entra ID, select personal Microsoft accounts as a supported account type.
2. Configure SPA redirect URI `http://localhost:5173/` and your production redirect.
3. Add delegated Microsoft Graph permission `Files.ReadWrite.AppFolder` and `User.Read`. Check consent and app-folder availability on target tenant/account.
4. Set `VITE_MICROSOFT_CLIENT_ID`, restart Vite.
5. Sign in and press **Cloud synchronisieren**. The app uses Microsoft Graph `/me/drive/special/approot`.

## Data and limitations

- Personal cloud storage is opt-in; data always save first to IndexedDB, then to cloud only on explicit sync.
- OAuth access tokens live only in React memory, not persistent browser storage. Reconnect after reload or expiry.
- OneDrive upload enforces ETag/If-Match checks. Google version checks reduce, but do not fully eliminate concurrent edits. For production implement a robust per-document compare-and-swap or immutable event synchronization.
- With many devices writing simultaneously, sync can conflict. Back up JSON regularly.
- Subjects, sets and study attempts sync as one JSON document. Attempts have immutable UUIDs so merge deduplicates them.
- User-supplied sources are not uploaded until reviewed entries are approved; in photo extraction the image is sent temporarily to the selected AI bridge/provider.
- Current backend supports OpenAI using the operator's server-side key; genuine per-user BYO API provider credentials remain a future security design. Do not publish a shared unauthenticated proxy.
- For public deployment, secure account-to-storage isolation, CSRF protections, CSP, audit logging, abuse controls and privacy disclosures.
- Do not depend on a ChatGPT subscription for API credits; API billing is separate.
- The demo seeds Unité 2 for new browsers. It does not automatically import the independent ChatGPT flashcard review history.
- For local backup, use Export in Settings.

## Production checklist

Security review, OAuth app verification, auth token expiry/relogin UX, cloud concurrency stress tests, mobile offline tests, AI extract quality evaluation, backup/restore validation, privacy/legal review for minors, app hosting, HTTPS and CI smoke tests.
