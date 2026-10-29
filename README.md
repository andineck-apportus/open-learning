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
Zuordnen, Memory). Vorhandene Beispielsätze lassen sich schon vor dem Aufdecken
über „Beispielsätze anzeigen“ ein- und ausblenden. Sie sind standardmässig sichtbar.
Das mitgelieferte Beispielset enthält 28 redaktionell ergänzte Beispielsätze mit
deutscher Bedeutung, auch in älteren lokalen Beständen. Eigene Sätze und bewusst
gelöschte Beispiele bleiben erhalten; veränderte oder importierte Karten bekommen
keine automatisch erfundenen Sätze. Fortgesetzte Runden lesen Beispiele aus der
aktuellen Karte. Fehlen Beispiele, zeigt die Lernansicht einen Hinweis auf „Bearbeiten“. Die Option bleibt pro Browser erhalten;
in Prüfungen sind Beispielsätze erst in der Auswertung erreichbar.

Unter „Lernen anpassen“ stehen Mischen, fällige Karten und ein Drill mit fünf
Karten bereit. Fehler werden im Drill bis zu zweimal mit anderen Karten
dazwischen wiederholt; nach fünf Sekunden wird eine Lösungshilfe sichtbar.
Fünf Lernstufen planen Wiederholungen nach 1, 3, 7, 14 und 30 Tagen. Fehler
setzen die Stufe zurück. Die Richtungen werden getrennt ausgewertet.
„Hören & schreiben“ verwendet unabhängig von der Übersetzungsrichtung die
Fremdsprache als Hör- und Eingabesprache. Die Bedeutung in der Muttersprache
erscheint nach einer richtigen Eingabe; Beispielsätze bleiben vorher verborgen.
Nach einem Fehler lässt sich die Lösung über „Richtig schreiben“ nochmals
abschreiben, auch im Modus Schreiben. Diese Wiederholung verändert die
ursprüngliche Bewertung nicht. Eingabe und Zustand der Wiederholung bleiben
beim Pausieren erhalten. Hörübungen erhöhen den Übersetzungsstand nicht. Memory zählt ausschliesslich als
Spiel: Fehlversuche und gefundene Paare verändern den Wissensstand nicht; auch
die Rundenanzeige verwendet keine Wissenskategorien.

Eine unterbrochene Runde lässt sich auf demselben Browser fortsetzen. Der
Zwischenstand wird pro Lernset lokal gespeichert, inklusive Texteingabe,
Bewertungszustand und Memory-Spielbrett. Pro Set bleibt eine angefangene Runde
erhalten. „Speichern & Pause“ kehrt zur Auswahl zurück; „Fortsetzen“ lädt den
Stand auch nach einem Neuladen. Das Fortsetzen ist an diesen Browser gebunden.
Bewertete Antworten werden sofort gespeichert, auch in Prüfungen; sie verwenden
die vorhandene Synchronisation. Die Übernahme beim Fortsetzen ist nach
Versuchs-ID gegen Doppelzählung geschützt. Sprachausgabe nutzt die Stimmen
des Browsers. Prüfungen zeigen erst nach der letzten Aufgabe die Gesamtauswertung.

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
„Wird sicherer“ (Schritte 1–4 zusammengefasst) und „Sicher“ (Schritt 5). Zahlen
und Beschriftungen ergänzen die Farben. Eine aufklappbare Erklärung beschreibt
die fünf richtigen Antworten in Folge, Rücksetzungen und Wiederholungstage.
Während einer Runde füllt jede Bewertung sofort ein Segment (grün: gewusst,
orange: nochmals üben). Prüfungen zeigen bis zum Abschluss nur den neutralen
Bearbeitungsstand. Die Rundenauswertung zeigt den Anteil richtiger Antworten
als Kreisdiagramm und den aktuellen Lernstand als Balken.

Tastatursprache und Tastenanordnung lassen sich unter „anpassen“ oberhalb der
Tasten unabhängig wählen. Die Einstellungen bleiben beim Schreiben eingeklappt.
Auf schmalen Bildschirmen und bei Touchbedienung nutzt die Schreibansicht mit
eigener Tastatur die gesamte verfügbare Höhe. Die Aufgabe kann separat scrollen;
Antwortfeld, Tasten und Prüfen bleiben sichtbar. Auch im Querformat reicht die Tastatur über die gesamte Breite;
bei wenig Höhe stehen Antwortfeld und Prüfen nebeneinander. Im Browser geprüft: 320×568, 390×667,
390×844, 1024×768 und 844×390. „Automatisch“ folgt der Antwortsprache; „Standard“ verwendet
für Französisch und Deutsch QWERTZ, für Englisch, Italienisch und Spanisch QWERTY.
Die Auswahl wird pro Browser unter `ol-keyboard-preferences-v1` behalten und
ändert weder die Abfragerichtung noch vorhandene Antworten.

Die eigene Tastatur wird nicht allein über die Breite aktiviert: Touch-Punkte,
primäre/weitere grobe Zeiger, User-Agent und gegebenenfalls mobile Client-Hints
werden zusätzlich berücksichtigt. Damit verwenden auch breite Tablets und iPads
mit Mac-artigem Desktop-User-Agent weiterhin das schreibgeschützte Antwortfeld
mit `inputMode="none"`. Auf einem Desktop ohne Touch ist die Bildschirmtastatur
optional einblendbar. Die Erkennung und das gerenderte Eingabefeld sind für
simulierte iPad-/Android-Signale automatisiert geprüft; echte Hardware bleibt
ein zusätzlicher Abnahmeschritt.

Referenzen: [MDN maxTouchPoints](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/maxTouchPoints),
[MDN User-Agent](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgent),
[MDN inputmode](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode).

Aktuelle Anbindung und ausstehende Freigabe: [OneDrive / SharePoint](docs/microsoft-storage.md).
Nächster KI-Ausbauschritt: [Zentrale und eigene Schlüssel](docs/ai-security-plan.md).

Die laufende Lernansicht zeigt nur Pause, Modus, Kartennummer, einen schmalen
Fortschrittsbalken und die Aufgabe mit optionalem Beispielsatz. Set-Titel,
Navigation, Stufen und Fortschrittslegenden sind während der Runde ausgeblendet.
In Schreiben, Diktat und Prüfung bleibt derselbe Eingabe- und Tastaturbereich
beim Tippen, bei Rückmeldung und beim Wechsel zur nächsten Karte erhalten.
„Antwort prüfen“ wechselt an derselben Position zu „Weiter“; die Tasten bleiben
sichtbar und sind nach der Bewertung gesperrt. Der Aufgabenbereich scrollt bei
Bedarf separat. Desktop-Fokus wird ohne Scrollen zurückgesetzt. Bewegungen und
Farbübergänge der Lernbedienung sind deaktiviert. Im Browser wurden identische
Positionen und unveränderte Eingabe-/Tastatur-DOM-Knoten über Bewertung,
Kartenwechsel und Nachschreiben verifiziert. Breitenprüfung: 320×568, 360×640,
390×667, 430×932 und 568×320; die eigene Tastatur reicht jeweils von Rand zu Rand.

Auch bei 120 % Browserzoom (266×473 nutzbare CSS-Pixel) bleiben Tastatur und
Prüfen sichtbar. Bei sehr wenig Höhe werden die Tasten kompakter; beim
Nachschreiben steht die richtige Lösung direkt als Aufgabe oben.
