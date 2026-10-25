# Publish the web client via GitHub Pages

The web UI is static and can be hosted at **https://andineck-apportus.github.io/open-learning/** after Pages is enabled.

1. Open **Repository Settings → Pages**, select **GitHub Actions** as the build and deployment source.
2. Open **Settings → Secrets and variables → Actions → Variables**, add these **repository variables**:
   - `GOOGLE_CLIENT_ID`: public Google OAuth Web client ID
   - `MICROSOFT_CLIENT_ID`: public Microsoft Entra SPA app client ID
3. Open **Actions → Publish web app** and run or re-run the workflow, or push to `main`.
4. Register the redirect URI **https://andineck-apportus.github.io/open-learning/** in both identity systems. Google also needs authorized JavaScript origin `https://andineck-apportus.github.io`.
5. Use Settings in the deployed app to log in and synchronize. Verify with a second device.

The client IDs are public application identifiers, **not secrets**. Do not put API secrets in Vite variables or GitHub Pages.

Important: GitHub Pages serves only the client. The optional `/api/extract` route has no backend on Pages, so **photo AI extraction does not work on the published site** until a secure separately hosted backend with user authentication is configured. Text import, local training and configured cloud sync can work without that service.

Cloud OAuth storage integration is still an early prototype; test thoroughly before depending on it for critical study history. Manual backups are available.
