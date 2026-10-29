# OneDrive und SharePoint

Implementiert: Microsoft-Anmeldung mit MSAL und PKCE, stille Token-Erneuerung,
automatischer Abgleich, Geräte-Replikate und Zusammenführen paralleler Änderungen.
Google Drive bleibt erhalten. Pro Benutzer ist jeweils ein Speicher aktiv.

## Einmalige Registrierung (noch nicht aktiviert)

`microsoft-app-registration.json` ist die vorbereitete Entra-Konfiguration.
Sie wurde noch nicht angelegt: Die automatische Freigabeprüfung verlangt dafür
explizite Zustimmung zum Anlegen der App und den angefragten Zugriffsrechten.
Es wird kein Client-Secret erstellt. Es wird auch keine organisationsweite
Administratorzustimmung automatisch erteilt.

Die App unterstützt private Microsoft-Konten und Arbeits-/Schulkonten.
SPA-Rücksprünge: Produktionsseite sowie localhost:5173 und 127.0.0.1:5173.
Die öffentliche Anwendungs-ID gehört in `VITE_MICROSOFT_CLIENT_ID`
(lokal `.env.local`, veröffentlicht GitHub-Variable `MICROSOFT_CLIENT_ID`).
Alternativ ist sie in den erweiterten Speichereinstellungen eintragbar.

- OneDrive fragt `Files.ReadWrite.AppFolder` an.
- SharePoint fragt zusätzlich `Sites.Read.All` an, um die angegebene Website
  aufzulösen. Diese Leseberechtigung ist breiter als der App-Ordner; der Nutzer
  bzw. Administrator muss sie im Microsoft-Dialog genehmigen.
- Lerninhalte werden nur im App-Ordner geschrieben.
- SharePoint akzeptiert Website-Adressen, keine Datei-/Freigabelinks.

## Kontentrennung und Speicherung

Microsoft verwaltet seine Token im MSAL-Sitzungsspeicher. Vor jedem Abgleich
werden frische Zugriffstoken über `acquireTokenSilent` angefordert. Nach Ablauf
oder Widerruf wird eine erneute interaktive Anmeldung verlangt. Beim Trennen
wird der App-Cache entfernt; Microsofts allgemeine SSO-Anmeldung bleibt bestehen.

Im App-Ordner schreibt jedes Gerät nur seine eigene Replik. Die Dateinamen
enthalten einen SHA-256-Tag der Microsoft-Kontokennung. Auch in derselben
SharePoint-Bibliothek liest die App nur Repliken des angemeldeten Kontos.
Beschädigte Daten und fremde Paging-Ziele stoppen den Abgleich. SharePoint ist
kein zusätzlicher Verschlüsselungs- oder Berechtigungsschutz gegenüber Personen,
die selbst Zugang zur Bibliothek haben: Sie können die JSON-Dateien dort lesen.
Die Trennung verhindert versehentliches Zusammenführen, keine berechtigten
Bibliotheksadministratoren. Für persönliche Lernstände ist OneDrive vorzuziehen.

## Prüfung

Automatisiert geprüft: Kontoisolation, parallele Geräteänderungen, kaputte Dateien,
Token-Erneuerung, Abbruch der Anmeldung, Providerwechsel, unerlaubte Paging-Ziele.
Die echte Microsoft-Anmeldung, Zustimmung und tenantabhängigen Graph-Rechte
müssen nach Freigabe der Registrierung mit privaten und Geschäftskonten geprüft
werden. Mock-Tests sind kein Beleg für eine erfolgreiche Live-Anmeldung.

Referenzen: [Microsoft App-Ordner](https://learn.microsoft.com/en-us/graph/onedrive-sharepoint-appfolder),
[MSAL](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/initialization),
[SharePoint-Website auflösen](https://learn.microsoft.com/en-us/graph/api/site-getbypath?view=graph-rest-1.0).
