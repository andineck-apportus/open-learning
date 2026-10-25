# Persistent Google Drive connection

The existing `open-learning-ai` Worker handles Google OAuth as well as AI extraction.

## Deployed configuration

- D1: `open-learning-auth`, ID `03be99c4-9101-4f5b-8e45-aba484113144`, EU jurisdiction.
- Binding: `AUTH_DB` (tracked in `worker/wrangler.jsonc`).
- Tables: apply `worker/schema.sql` once with the D1 console or Wrangler.
- Secret `TOKEN_ENCRYPTION_KEY`: cryptographically random 32 bytes, base64url encoded.
- Secret `GOOGLE_CLIENT_SECRET`: the existing Google Web application OAuth client's secret; never commit it.
- Client ID, app URL and redirect URI are non-secret Wrangler variables.
- Register `https://open-learning-ai.andineck.workers.dev/auth/google/callback` in the Google client's authorized redirect URIs.
- `/auth/health` reports configuration readiness without revealing secrets.

## Flow and storage

The app starts a server authorization-code flow with `drive.appdata` and offline access. Google PKCE plus single-use server state protects the callback. A short-lived, single-use ticket in the return URL fragment can only be exchanged with the initiating browser's verifier. The fragment is removed immediately.

Google refresh tokens are AES-256-GCM encrypted in D1. Device session tokens are random, stored only as SHA-256 hashes in D1, valid for 180 days, and stored in the browser's localStorage. Google access tokens are obtained at startup and before each manual sync and remain in memory. The app data continues to be read/written directly to the user's Google Drive appDataFolder. No study content or OpenAI keys are stored in D1.

Disconnect deletes this device's session on the server. It does not revoke other devices or the Google app grant. Users can revoke the whole grant in their Google account. Revoked/expired Google refresh tokens require login again. Browser session tokens are accessible to scripts/extensions in that browser profile, so use trusted devices. Deleting browser storage does not revoke the corresponding server session; it expires automatically.

A daily scheduled job purges expired states, tickets and device sessions. Do not enable request URL logging for OAuth callbacks. Never log tokens or request bodies. Rotating TOKEN_ENCRYPTION_KEY invalidates all encrypted refresh tokens unless a migration is implemented.

## Validation

`node --test worker/auth.test.js` exercises the real SQL schema with SQLite and mocked Google token responses: state and ticket replay rejection, browser verifier binding, encryption and wrong-key rejection, fresh token retrieval, session isolation, logout, Google revocation and expiry cleanup. `npm run build` checks TypeScript and the production bundle.

Live acceptance requires a Google login, a page reload, a new tab/browser restart, manual Drive sync, and disconnect/reconnect. Local tests are not evidence of a live Google login.
