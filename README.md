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

### Lernformen

Lernsets bieten drei Einstiege: Lernen (Karten, Schreiben, Prüfung), Üben
(Hören und Schreiben, Auswahl, Wort bauen) und Spielen (Wahr oder falsch,
Zuordnen, Memory). Beispielsätze bleiben an der Vokabel und können nach dem
Aufdecken eingeblendet werden.

Unter „Lernen anpassen“ stehen Mischen, fällige Karten und ein Drill mit fünf
Karten bereit. Fehler werden im Drill bis zu zweimal mit anderen Karten
dazwischen wiederholt; nach fünf Sekunden wird eine Lösungshilfe sichtbar.
Fünf Lernstufen planen Wiederholungen nach 1, 3, 7, 14 und 30 Tagen. Fehler
setzen die Stufe zurück. Die Richtungen werden getrennt ausgewertet.
Hörübungen erhöhen den Übersetzungsstand nicht.

Eine unterbrochene Runde lässt sich auf demselben Browser fortsetzen. Der
Zwischenstand wird lokal gespeichert; bewertete Versuche verwenden die
vorhandene Synchronisation. Aktuell wird eine Runde gleichzeitig behalten.
Sprachausgabe nutzt die Stimmen des Browsers. Eine Prüfung gibt erst nach
der letzten Aufgabe eine Gesamtauswertung und übernimmt dann die Versuche.

Prüfen: `npm run build` und `node --experimental-strip-types --test src/*.test.mjs`.

Auf schmalen Bildschirmen und Touchgeräten verwenden Schreiben, Diktat und
Prüfung eine eigene Bildschirmtastatur. Das Antwortfeld ist dort schreibgeschützt
mit `inputMode="none"`, um die Systemtastatur zu unterdrücken. Die Sprache der
Antwort bestimmt Layout und Sonderzeichen: QWERTZ für Französisch, QWERTZ mit
Umlauten für Deutsch, QWERTY für Englisch, Italienisch und Spanisch. Grossbuchstaben,
Zahlen, Satzzeichen, Apostroph, Leerzeichen und Löschen sind integriert. Weitere
Akzente sind in der Zeichenzeile seitlich erreichbar. Auf Desktop bleibt normale
Tastatureingabe möglich. Mobilgeräte wurden im Browser mit 320 und 390 Pixeln
geprüft; ein zusätzlicher Test auf echten iOS-/Android-Geräten ist empfohlen.

Der Lernstand erscheint als farbiger, proportionaler Balken in der Setübersicht
und im Lernset. Jede Karte zählt genau einmal in der gewählten Abfragerichtung;
Sachfragen verwenden immer Frage → Antwort. Die Farben zeigen „Noch üben“,
Stufen 1–4 und „Sicher“ (Stufe 5). Zahlen und Beschriftungen ergänzen die Farben.
Während einer Runde füllt jede Bewertung sofort ein Segment (grün: gewusst,
orange: nochmals üben). Prüfungen zeigen bis zum Abschluss nur den neutralen
Bearbeitungsstand. Die Rundenauswertung zeigt den Anteil richtiger Antworten
als Kreisdiagramm und den aktuellen Lernstand als Balken.
