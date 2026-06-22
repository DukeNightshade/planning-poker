# Planning Poker

> Webbasierte Aufwandseinschätzung für agile Sprintplanung – intern, werbefrei, in Echtzeit.

Entwickelt im Rahmen der **IHK Abschlussprüfung Sommer 2026**

---

## Hintergrund

Im Ausbildungsbetrieb wurde bisher ein kostenloses Drittanbieter-Tool für Planning Poker genutzt, das nicht offiziell freigegeben war und umfangreiche Werbebanner enthielt. Ziel dieses Projekts ist die Entwicklung einer offiziell freigegebenen, werbefreien und intern betriebenen Alternative.

---

## Was kann die Anwendung?

Planning Poker ist eine Methode, mit der agile Teams gemeinsam den Aufwand für Aufgaben ("Tickets") einschätzen. Jede:r Teilnehmer:in wählt verdeckt eine Karte mit einem Schätzwert. Erst wenn alle gewählt haben, werden die Karten gemeinsam aufgedeckt – das verhindert, dass sich einzelne Meinungen gegenseitig beeinflussen.

### Funktionen im Überblick

**Session & Teilnahme**
- 🏠 **Räume statt Konten** – Ein Moderator erstellt eine Session und erhält einen Raumcode. Teilnehmer treten einfach über diesen Code bei, ganz ohne Registrierung.
- 👤 **Rollen** – Teilnehmer ordnen sich als Entwickler, Tester, IT-Architekt oder Product Owner (reiner Beobachter ohne Stimme) ein.
- ⭐ **Moderator-Wechsel** – Moderatorrechte können während der Session übergeben oder selbst übernommen werden.
- 🔌 **Stabile Verbindung** – Bei einem kurzen Verbindungsabbruch bleibt der Platz ca. 20 Sekunden reserviert, sodass man nahtlos wieder einsteigen kann.

**Abstimmen & Auswerten**
- 🃏 **Mehrere Schätzmethoden** – Fibonacci-Zahlen, T-Shirt-Größen (S, M, L, …), Zweierpotenzen oder klassische Scrum-Werte.
- ⚡ **Echtzeit-Synchronisation** – Abstimmungen und Änderungen werden sofort an alle übertragen, ganz ohne Seite neu laden.
- 👁️ **Gemeinsames Aufdecken** – Karten werden für alle gleichzeitig sichtbar, inklusive animierter Übergänge.
- 💬 **Diskussionsmodus** – Nach dem Aufdecken kann die Karte noch einmal angepasst werden, z. B. nach kurzer Diskussion. Geänderte Werte werden farblich hervorgehoben.
- 🔄 **Neue Runde** – Ein Klick genügt, um die nächste Schätzung zu starten.

**Aufgabenverwaltung**
- 📋 **Tickets** – Mehrere zu schätzende Aufgaben lassen sich pro Session anlegen; der Moderator wechselt bequem zwischen ihnen. Der Durchschnittswert wird automatisch je Ticket gespeichert.

**Anpassung & Komfort**
- ⚙️ **Einstellbare Optionen** – z. B. ob Tickets angezeigt werden, ob der Moderator mitschätzen darf, automatisches Aufdecken sowie Anzeige des Gesamtdurchschnitts oder der Werte je Rolle.
- 🌐 **Zweisprachig** – Oberfläche auf Deutsch und Englisch, jederzeit umschaltbar.
- 🧹 **Automatische Aufräumung** – Sessions, die älter als 24 Stunden sind, werden automatisch gelöscht.

---

## Tech-Stack

| Bereich | Eingesetzte Technologie |
|---|---|
| Backend | Java mit Spring Boot |
| Echtzeit-Kommunikation | WebSocket (STOMP-Protokoll) |
| Frontend | Thymeleaf-Templates + JavaScript, eigens entwickelte SVG-Visualisierung des Pokertischs |
| Datenhaltung (Entwicklung) | H2-Datenbank (lokale Dateidatenbank) |
| Datenhaltung (Produktion) | PostgreSQL |
| Hosting | Heroku |

---

## Lokale Entwicklung

### Voraussetzungen

- Java 21 oder neuer
- Maven (alternativ kann der mitgelieferte Maven Wrapper `./mvnw` verwendet werden)
- Eine Java-IDE wird empfohlen (z. B. IntelliJ IDEA)

### Starten

```bash
git clone https://github.com/DukeNightshade/planning-poker.git
cd planning-poker
./mvnw spring-boot:run
```

Die Anwendung ist anschließend unter folgender Adresse erreichbar: [http://localhost:8080](http://localhost:8080)

### Datenbank-Ansicht im Browser (nur lokale Entwicklung)

```
URL:      http://localhost:8080/h2-console
JDBC URL: jdbc:h2:file:./data/planningpoker
Benutzer: sa
Passwort: (leer lassen)
```

### Konfiguration

Die Grundeinstellungen für die lokale Entwicklung befinden sich in `src/main/resources/application.properties`. Für den produktiven Betrieb wird eine separate, nicht im Repository enthaltene Konfiguration verwendet, die über Umgebungsvariablen gesetzt wird (z. B. Zugangsdaten zur PostgreSQL-Datenbank).

---

## Wie ist das Projekt aufgebaut?

Die Anwendung gliedert sich in drei grobe Bereiche, wie es bei modernen Webanwendungen üblich ist:

- **Oberfläche (Frontend):** Die HTML-Seiten und das dazugehörige JavaScript, u. a. für den animierten Pokertisch, Benachrichtigungen (Toasts) und die Live-Aktualisierung der Ansicht.
- **Anwendungslogik (Backend):** Verwaltet Sessions, Teilnehmer, Tickets und Abstimmungen, prüft Regeln (z. B. "der letzte Moderator kann nicht entmachtet werden") und berechnet die Durchschnittswerte.
- **Datenhaltung:** Speichert Sessions, Teilnehmer, Tickets und abgegebene Stimmen dauerhaft ab.

Die Kommunikation zwischen Oberfläche und Server läuft über zwei Wege: klassische Web-Anfragen für einmalige Aktionen (z. B. Session erstellen) und eine dauerhafte WebSocket-Verbindung für alles, was in Echtzeit bei allen Teilnehmern ankommen muss (z. B. eine abgegebene Stimme).

---

## Kurzüberblick: Wichtigste Endpunkte

### Reguläre Web-Anfragen

| Aktion | Beschreibung |
|---|---|
| Session erstellen | Legt eine neue Planning-Poker-Runde mit Raumcode an |
| Session beitreten | Ermöglicht Teilnehmern den Einstieg über den Raumcode |
| Sessionstatus abrufen | Liefert den aktuellen Stand einer laufenden Session |

### Echtzeit-Kommunikation (während einer laufenden Session)

| Aktion | Beschreibung |
|---|---|
| Karte wählen | Eigene Schätzung abgeben |
| Karten aufdecken | Alle abgegebenen Schätzungen für alle sichtbar machen |
| Neue Runde starten | Zurücksetzen für die nächste Schätzung |
| Live-Update | Automatische Benachrichtigung aller Teilnehmer über Änderungen |

---

## Projektphasen (IHK)

| Phase | Inhalt | Stunden |
|---|---|---|
| I – Analyse & Planung | Ist-Analyse, Soll-Konzept, Wirtschaftlichkeit, technisches Design | 14 h |
| II – Realisierung | Backend, Datenbank, Echtzeit-Kommunikation, Benutzeroberfläche | 41 h |
| III – Qualitätssicherung | Tests, Fehlerbehebung, Abnahme | 10 h |
| IV – Dokumentation | Projektdokumentation, Benutzerhandbuch | 15 h |
| **Gesamt** | | **80 h** |

---

## Lizenz

Dieses Projekt wurde im Rahmen einer IHK-Ausbildung entwickelt und ist nicht für den öffentlichen Einsatz lizenziert.
