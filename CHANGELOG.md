# Changelog

Alle relevanten Änderungen an Planning Poker. Hinweise zum Update auf dem
Server stehen in `deploy/planning-poker-server-deploy/ANLEITUNG.txt`.

## [1.1.0] – 2026-10-07

### Sicherheit
- Teilnehmer erhalten beim Erstellen/Beitreten ein geheimes Token; REST
  (`X-Participant-Token`) und STOMP (`participant-token`) weisen sich damit aus.
- Votes zählen immer für den Token-Inhaber, die Teilnehmer-ID im Payload wird ignoriert.
- Aufdecken, neue Runde, Einstellungen sowie Tickets hinzufügen/auswählen nur noch
  für Moderatoren, serverseitig geprüft.
- Moderator werden: weiterhin für sich selbst möglich, andere befördern oder
  zurückstufen nur als Moderator und nur im eigenen Raum.
- Kartenwerte werden gegen das Deck der Session geprüft, Tickets gegen den Raum.
- SockJS, STOMP und die Schrift Fira Sans werden lokal ausgeliefert statt über
  jsDelivr und Google Fonts (DSGVO).
- Security-Header: Content-Security-Policy, X-Frame-Options, nosniff,
  Referrer-Policy, Permissions-Policy.
- Rate-Limiting pro IP: 20 Session-Erstellungen und 60 Beitritte pro Minute
  (`planningpoker.rate-limit.*`).
- `DB_PASSWORD` ist in `docker-compose.yml` Pflicht, kein Fallback auf `changeme` mehr.

### Behoben
- Skip-Karte `-` wurde nie als solche erkannt und dargestellt.
- Auto-Reveal löste nicht aus, wenn der Moderator nicht mitstimmen darf oder ein
  Teilnehmer gerade die Verbindung verloren hatte.
- Kartenwechsel im Diskussionsmodus wurden nicht als Ticket-Schätzung gespeichert.
- Ticket-Titel wurden doppelt escaped (`&amp;amp;`, kaputte Links mit Parametern).
- Zu lange Ticket-Titel führten zu einem Serverfehler; jetzt auf 255 Zeichen begrenzt.
- Fehlende Werte beim Speichern der Einstellungen führten zu einem Serverfehler.
- Nach dem Neuladen fehlte der Wert auf der eigenen, noch verdeckten Karte.

### Geändert
- Kartendecks sind nur noch in `EstimationMethod` definiert; das Template rendert daraus.
- Fehler bei WebSocket-Aktionen erscheinen beim Absender als Meldung.
- Ungenutzte REST-Endpunkte zum Hinzufügen/Auswählen von Tickets entfernt.
- Thymeleaf-Template-Cache im Container aktiv.

## [1.0.1] – 2026-08-20

### Behoben
- Hinter dem Reverse Proxy unter `/planning-poker/` wurden CSS, JavaScript und
  Bilder nicht geladen. Die App baut Links jetzt anhand von `X-Forwarded-Prefix`.
