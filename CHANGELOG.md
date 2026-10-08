# Changelog

Alle relevanten Änderungen an Planning Poker. Hinweise zum Update auf dem
Server stehen in `deploy/planning-poker-server-deploy/ANLEITUNG.txt`.

## [Unreleased]

### Neu
- Permanente Team-Räume unter `/team/{name}`: gleicher Link für jedes Meeting, der Raum
  wird nie aufgeräumt. Mitglieder werden gemerkt – wer nicht verbunden ist, erscheint
  eingeklappt unter "Abwesend" und zählt nicht mit; beim nächsten Öffnen des Links ist
  man ohne Dialog wieder drin (auf neuem Gerät per gleichem Namen). Nach einem
  Server-Neustart gelten alle als abwesend, bis ihre Tabs sich neu verbinden.
- Neue Startseite im Stil des Pokertischs: "Session starten" und "Beitreten" liegen als
  Spielkarten auf dem Filz (Team-Raum als Schalter, Tickets optional eingeklappt,
  zuletzt gewählte Rolle vorbelegt; Beitreten per Raumcode oder Team-Name); besuchte Team-Räume
  als Ein-Klick-Chips.
- Ergebnisdarstellung mit Kartenstapeln: Nach dem Aufdecken liegt in der Tischmitte
  pro gewähltem Wert ein Stapel (anonym, Höhe = Anzahl), der häufigste Wert ist
  golden hervorgehoben; darunter "Meist · Ø" und optional der Durchschnitt je Rolle.
  Bei lauter unterschiedlichen Werten wird nichts hervorgehoben.
- Vom Tisch entfernen: Moderatoren können Teilnehmer (z. B. abwesende) per ✕ in der
  Teilnehmerliste entfernen, jeder kann den Tisch selbst verlassen. Für den Raum
  erscheint das wie ein normales Verlassen; die Person kann über den Dialog direkt
  wieder beitreten. Danach wird Auto-Reveal sofort geprüft – das gilt jetzt auch,
  wenn jemand den Tab schließt.
- Eigene Karten im Schätzraum als aufgefächerte Pokerhand direkt unter dem Tisch; der
  Tisch und die Karten wachsen mit der Bildschirmgröße (Laptop bis 27-Zoll-Monitor).
- Rollenfarben: Entwickler, Tester, IT-Architekt und Product Owner haben je eine deutlich
  unterscheidbare Farbe (Avatar, Punkt im Namensschild am Tisch, Legende unter dem Tisch);
  der goldene Ring kennzeichnet nur noch Moderatoren.

### Geändert
- Product Owner stimmen standardmäßig mit; die neue Einstellung "Product Owner darf
  mitwählen" schaltet das ab. "Moderator darf mitwählen" entfällt – Moderatoren stimmen
  immer mit (Migration `V4`).
- Ergebnis in der Tischmitte (Kartenstapel, Ø) wächst mit der Tischgröße; die Zeile
  "Meist: …" entfällt, der häufigste Wert ist am goldenen Stapel erkennbar.
- Kein Maus-Tooltip "Pokertisch mit x Teilnehmern" mehr über dem Tisch.
- Product Owner zeigen in der Teilnehmerliste wieder ihren Abstimmungsstatus; die
  Rollenauswahl heißt nur noch "Product Owner" (ohne "Beobachter").
- Statische Dateien werden mit Inhalts-Hash ausgeliefert (`render-3f9a….js`), damit
  Browser nach einem Update keine alten und neuen Skripte mischen.
- Datenbankschema über Flyway-Migrationen (`db/migration`) statt `ddl-auto=update`;
  bestehende Datenbanken (auch 1.0.1) werden beim Start automatisch nachgezogen.
- Sessions werden nach 24 Stunden Inaktivität gelöscht statt 24 Stunden nach dem Anlegen.
- Aufräum-Zeitraum, Cleanup-Uhrzeit und Reconnect-Wartezeit per Umgebungsvariable
  einstellbar (`CLEANUP_MAX_IDLE_HOURS`, `CLEANUP_CRON`, `RECONNECT_GRACE_SECONDS`).
- Testabdeckung mit JaCoCo (`mvn verify`).
- Code aufgeräumt: gemeinsame Konstanten, `RoleParser` vereinheitlicht, doppelte
  JavaScript-Logik zusammengeführt.
- Heroku-Dateien (`Procfile`, `system.properties`) bleiben erhalten; das `Procfile`
  startet das Jar unabhängig von der Versionsnummer.

### Behoben
- Nach Änderungen an einzelnen CSS-Dateien konnten Browser mit Cache Teile des
  Stylings verlieren (z. B. Dark Mode): `style.css` mit `@import` behielt ihren Hash.
  Die Stylesheets werden jetzt einzeln eingebunden, jedes mit eigenem Inhalts-Hash.
- Abstimmungsanzeige zählte Moderatoren mit, auch wenn sie nicht abstimmen dürfen,
  und wurde beim Ändern der Einstellung nicht aktualisiert.
- Wird "Moderator darf abstimmen" ausgeschaltet, werden bereits abgegebene
  Moderator-Stimmen verworfen und Auto-Reveal sofort geprüft.
- Moderatoren (bei ausgeschaltetem Stimmrecht) und Product Owner können auch
  serverseitig nicht mehr abstimmen.
- Fehlende Rolle (`"role": null`) beim Beitreten führte zu einem Serverfehler.

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
