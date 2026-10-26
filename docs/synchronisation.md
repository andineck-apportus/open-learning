# Automatische Google-Drive-Synchronisation

Die App speichert Änderungen zuerst in IndexedDB. Nach 1,5 Sekunden ohne weitere Eingabe startet der Cloud-Abgleich. Weitere Auslöser: App-Start, Fensterfokus, Rückkehr zum sichtbaren Tab, Wiederherstellung der Internetverbindung und alle 30 Sekunden bei sichtbarer App. Der Status unter dem Logo zeigt laufende, erfolgreiche, unterbrochene oder ausstehende Synchronisation.

## Sicherheit gegen verlorene Änderungen

- Jeder Browser schreibt eine eigene Datei `open-learning-replica-v2-<UUID>.json` im vorhandenen privaten Drive-App-Ordner. Andere Geräte überschreiben diese Datei nicht. Alle Gerätestände werden gelesen und zusammengeführt. Die alte `open-learning.json` bleibt unverändert und wird mitgelesen.
- Ein Web Lock serialisiert Cloud-Zugriffe mehrerer Tabs desselben Browsers. Ohne Web-Lock-Unterstützung erhält jeder Tab einen eigenen Schreiber.
- Lokales Lesen, Zusammenführen und Schreiben geschieht in einer einzigen IndexedDB-Transaktion. BroadcastChannel informiert andere offene Tabs. Die Netzwerkantwort ersetzt nie einfach den aktuellen UI-Datenstand.
- Namen, Lernset-Metadaten und einzelne Kartenfelder haben eigene Änderungszeitpunkte. Unabhängige Änderungen werden kombiniert. Gleichzeitige Änderungen desselben Felds werden anhand des Änderungszeitpunkts entschieden; bei identischem Zeitpunkt entscheidet ein stabiler Vergleich. Das ist keine manuelle Konfliktauflösung. Geräteuhren sollten korrekt eingestellt sein.
- Löschmarkierungen für Fächer, Sets und Karten bleiben dauerhaft erhalten; Löschung gewinnt gegen alte/offline Änderungen. Lernversuche werden nach ihrer ID vereinigt.
- Timeout pro Anfrage: 25 Sekunden. Netzwerk-/Serverfehler werden mit zunehmender Wartezeit bis etwa einer Minute wiederholt. Bei fehlender Anmeldung oder verweigertem Drive-Zugriff fordert der Status eine erneute Verbindung an. Änderungen bleiben lokal.
- Ein erfolgreicher Cloud-Abgleich umfasst den übertragenen Stand. Weitere Eingaben während des Uploads lösen einen Folgeabgleich aus. Ein erfolgreicher Schreibvorgang ohne empfangene Antwort kann beim nächsten Lesen wiedergefunden werden; doppelte Dateien werden ebenfalls zusammengeführt.
- Ungültige Cloud-Daten oder unvollständige Dateilisten stoppen den Schreibvorgang. Lokale Speicherfehler werden angezeigt und erneut versucht. Vor dem Schliessen mit noch nicht lokal gespeicherten Änderungen wird eine Browserwarnung angefordert.

## Migration und Grenzen

Auf allen Geräten einmal neu laden, damit alte App-Versionen nicht weiter nur die frühere gemeinsame Datei verwenden. Es ist kein neues Login und keine neue Google-Berechtigung nötig. Der Google-OAuth-Worker bleibt unverändert. Automatische Synchronisation ist für Google Drive implementiert; OneDrive ist aktuell nicht konfiguriert.

Die Synchronisation funktioniert, solange die App geöffnet ist; nach dem Schliessen übernimmt der nächste Start. Ohne Netz sind Änderungen zunächst nur auf diesem Gerät vorhanden. Löschen der Browserdaten vor einem erfolgreichen Cloud-Abgleich kann diese Änderungen verlieren. Ein Cloud-Abgleich ersetzt kein separates Backup. Geräte-Replikate und Löschmarkierungen werden bewusst nicht automatisch entfernt.

## Prüfung

`npm run build`

`node --test src/management.test.mjs src/sync.test.mjs src/replica-cloud.test.mjs`

Tests decken unabhängige Karten-/Feldänderungen, Löschungen gegen alte Geräte, deterministische Zusammenführung, Änderungen während eines Uploads, neue Geräte, Kartenreihenfolge, ungültige Daten, parallele Geräteschreiber, doppelte Dateien nach unklarer Übertragung, Migration, Cache-Aktualisierung, Paginierung und HTTP-Fehler ab. Drive-Aufrufe werden in den Transporttests simuliert.
