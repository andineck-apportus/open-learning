# KI-Zugang: zentral und mit eigenen Schlüsseln

Gewünschter nächster Ausbauschritt: beide Betriebsarten unterstützen.
Diese Architektur ist noch nicht als produktiver Schlüsseltresor implementiert.

## Aktueller Stand

Die Fotoerkennung unterstützt derzeit nur OpenAI. Ein eingegebener Schlüssel
bleibt im Browser-Arbeitsspeicher und wird für die Anfrage über HTTPS an den
KI-Dienst gesendet. Frühere Kopien in localStorage/sessionStorage werden beim
Start entfernt. Es gibt keine Option zur dauerhaften Browserablage mehr.
Ein beliebiger HTTP-Dienst ausserhalb der lokalen Entwicklung wird abgewiesen.
Das verringert die Persistenz, schützt aber nicht vor manipuliertem JavaScript,
Browsererweiterungen oder einem kompromittierten Dienst. CORS ist keine Anmeldung.

## Gemeinsame serverseitige Grenze

- Verifizierte, stabile Nutzeridentität für Google und Microsoft; nicht nur ein
  Cloud-Zugriffstoken oder eine vom Browser behauptete Nutzer-ID.
- Serverseitig geprüfte Sitzungen, Ablauf/Widerruf und CSRF-Schutz. Keine Provider-
  Schlüssel in Antworten, URLs, Browserpersistenz, Cloud-Backups oder Logs.
- Feste Provider-Endpunkte und Modellfreigaben, serverseitige Eingabe- und
  Ausgabelimits, Zeitlimits, atomare Quoten pro Nutzer und Kosten-/Missbrauchslimits.
- Metadaten für Nachvollziehbarkeit ohne Schlüssel oder private Bildinhalte.

## Zentraler Schlüssel

Betreiber hinterlegt ihn ausserhalb der App als Server-Secret. Er gelangt nie
in das ausgelieferte Frontend. Nur angemeldete und berechtigte Nutzer dürfen
Anfragen auslösen. Jede Anfrage muss vor dem kostenpflichtigen Aufruf eine
serverseitige Quote reservieren. Andernfalls würde ein öffentlicher Proxy die
Kosten des Betreibers riskieren.

## Eigene Schlüssel pro Nutzer

Nutzer hinterlegt den Schlüssel einmal über einen authentifizierten TLS-Endpunkt.
Er wird mit einem vom Browser getrennten Serverschlüssel verschlüsselt gespeichert
und an die verifizierte Nutzer-ID gebunden. Weitere Geräte sehen nur Anbieter,
Status und ggf. letzte Zeichen; sie erhalten den Schlüssel nicht zurück.
Ersetzen, Löschen und Sperren müssen möglich sein. Die einmalige Eingabe kann ein
bereits kompromittierter Browser weiterhin abfangen; absolute Diebstahlsicherheit
ist nicht erreichbar. Für höhere Isolation braucht es eine Eingabe ausserhalb der
Anwendungsseite oder eine vom Anbieter unterstützte delegierte Autorisierung.

## Weitere Anbieter

OpenAI, Anthropic Claude und Google Gemini bieten Bildverarbeitung an, verwenden
aber unterschiedliche Authentifizierung, Eingabeformate und Ergebnisstrukturen.
Es braucht geprüfte Adapter mit einem gemeinsamen Kartenformat. Ein fremder
Anbieterschlüssel funktioniert nicht einfach im bisherigen OpenAI-Feld.

Referenzen: [Claude Vision](https://platform.claude.com/docs/en/build-with-claude/vision),
[Gemini Bildverarbeitung](https://ai.google.dev/gemini-api/docs/image-understanding),
[Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
