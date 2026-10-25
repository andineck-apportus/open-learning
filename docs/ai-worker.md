# BYO OpenAI key: Cloudflare Worker

Open Learning remains a static app hosted on GitHub Pages. The tiny Worker forwards an image to the OpenAI Responses API and returns **proposed** flashcards. The user reviews and edits every entry before saving.

## Deploy (one time, with your own Cloudflare account)

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

Wrangler prints a URL such as `https://open-learning-ai.<account>.workers.dev`.
The *maintainer*, not each learner, configures its URL once in GitHub Actions repository variables as `AI_WORKER_URL` (the public HTTPS Worker origin), then re-runs the Pages workflow. Learners only enter their own OpenAI API key under **Einstellungen → KI-Verbindung**. No central API key is configured in the Worker. Power users can override the URL via the optional advanced section.

The Worker intentionally never writes API keys, photos, or responses to any database or storage. The OpenAI Responses request uses `store:false`. Cloudflare's and OpenAI's service policies still apply.

## Important security caveat

This is an **opt-in BYO-key tradeoff**:
- A personally entered key necessarily exists in browser JavaScript memory and is sent to the Worker via HTTPS for each request. A compromised page, extension or Worker operator can steal it. A Worker does **not** make a browser-entered key inaccessible to JavaScript.
- The app does **not** store the key in localStorage, IndexedDB, Google Drive, OneDrive, GitHub, or cookies. Reloading requires re-entering it.
- Use a dedicated project key with low spending limits, monitoring, and easy rotation. Do not use a highly privileged organization key.
- CORS is not authentication. Any HTTP client can invoke your public Worker with its own key; it cannot bill *your* OpenAI account unless your key is exposed.
- The Worker does not offer authentication, server-side key vaulting, per-user quotas or an audit trail. Do not treat it as a production multi-tenant backend.
- Avoid uploading identifiable or confidential learner material; photographs are sent to OpenAI for analysis.
- If you need no browser exposure of keys, build a proper authorization and server-managed secret storage layer instead.

## API

POST `/api/extract`

Headers: `Content-Type: application/json`, `X-OpenAI-Key: sk-...`

Body: `{"image":"data:image/jpeg;base64,...","subject":"Französisch","mode":"translation","model":"gpt-4.1-mini"}`

Response: `{"items":[{"front":"bonjour","back":"Guten Tag","kind":"translation"}]}`.

Allowed origins are set in `ALLOWED_ORIGINS` in `worker/wrangler.jsonc`. After deployment, verify CORS from the public Pages site, as well as the full photo/import/review workflow on a phone.
