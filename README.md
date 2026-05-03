# Planning Poker 🃏

> Webbasierte Aufwandseinschätzung für agile Sprintplanung – intern, werbefrei, in Echtzeit.

Entwickelt im Rahmen der **IHK Abschlussprüfung Sommer 2026**  
Ausbildungsbetrieb: **SIV.AG**, Konrad-Zuse-Straße 1, 18184 Roggentin

---

## Hintergrund

Die Mitarbeiter der SIV.AG nutzten bisher ein kostenloses Drittanbieter-Tool für Planning Poker, das nicht offiziell freigegeben war und umfangreiche Werbebanner enthielt. Ziel dieses Projekts ist die Entwicklung einer offiziell freigegebenen, werbefreien und intern betriebenen Alternative.

---

## Features

- 🏠 **Räume** – Moderator erstellt Session, Teilnehmer treten per Raumcode bei
- ⚡ **Echtzeit** – Abstimmungen werden live synchronisiert (kein Seitenreload)
- 🃏 **Schätzmethoden** – Fibonacci, T-Shirt-Größen, Zweierpotenzen
- 👁️ **Aufdecken** – Karten werden gleichzeitig für alle sichtbar
- 🔄 **Neue Runde** – Reset mit einem Klick
- 📋 **User Stories** – Mehrere Stories pro Session verwaltbar

---

## Tech-Stack

| Schicht | Technologie | Version |
|---|---|---|
| Backend | Java + Spring Boot | 21 / 3.x |
| Echtzeit | Spring WebSocket + STOMP | – |
| Frontend | Thymeleaf + Vanilla JS | – |
| WebSocket Client | SockJS + STOMP.js | via Webjars |
| ORM | Spring Data JPA + Hibernate | – |
| Datenbank (Dev) | H2 File-Modus | – |
| Datenbank (Prod) | PostgreSQL | – |
| Hosting | Railway | – |

---

## Lokale Entwicklung

### Voraussetzungen

- Java 21+
- Maven 3.9+ (oder Maven Wrapper `./mvnw` nutzen)
- IntelliJ IDEA (empfohlen)

### Starten

```bash
git clone https://github.com/DukeNightshade/planning-poker.git
cd planning-poker
./mvnw spring-boot:run
```

App läuft unter: [http://localhost:8080](http://localhost:8080)

### H2-Console (Datenbankansicht im Browser)

```
URL:      http://localhost:8080/h2-console
JDBC URL: jdbc:h2:file:./data/planningpoker
User:     sa
Passwort: (leer lassen)
```

### Konfiguration

Die Datei `src/main/resources/application.properties` enthält die Entwicklungskonfiguration mit H2.  
Für Produktion wird `application-prod.properties` verwendet (nicht im Repository – wird über Umgebungsvariablen gesetzt).

---

## Projektstruktur

```
src/main/java/de/sivag/planningpoker/
├── config/
│   └── WebSocketConfig.java          # STOMP-Broker Konfiguration
├── controller/
│   ├── PageController.java           # Thymeleaf-Seiten
│   ├── SessionRestController.java    # REST-API
│   └── PokerWsController.java        # WebSocket-Handler
├── model/
│   ├── Session.java                  # Entity
│   ├── Participant.java              # Entity
│   └── UserStory.java                # Entity
├── repository/
│   ├── SessionRepository.java
│   └── ParticipantRepository.java
├── service/
│   └── SessionService.java           # Geschäftslogik
└── PlanningPokerApplication.java

src/main/resources/
├── templates/
│   ├── index.html                    # Startseite
│   ├── moderator.html                # Moderator-Ansicht
│   └── session.html                  # Abstimmungsraum
├── static/
│   ├── css/style.css
│   └── js/poker.js                   # SockJS + STOMP Logik
└── application.properties
```

---

## API-Übersicht

### REST

| Methode | Endpoint | Beschreibung |
|---|---|---|
| `POST` | `/api/sessions` | Neue Session erstellen |
| `POST` | `/api/sessions/{code}/join` | Session beitreten |
| `GET` | `/api/sessions/{code}/state` | Sessionstatus abrufen |

### WebSocket (STOMP)

| Richtung | Route | Beschreibung |
|---|---|---|
| Client → Server | `/app/session/{code}/vote` | Karte wählen |
| Client → Server | `/app/session/{code}/reveal` | Karten aufdecken |
| Client → Server | `/app/session/{code}/reset` | Neue Runde |
| Server → Client | `/topic/session/{code}` | Live-Update an alle |

---

## Branch-Strategie

```
main        ← stabiler Stand, Railway deployed von hier
└── dev     ← aktuelle Entwicklung
      ├── feature/session-entity
      ├── feature/websocket
      ├── feature/rest-api
      ├── feature/thymeleaf-templates
      ├── feature/javascript
      └── feature/testing
```

---

## Projektphasen (IHK)

| Phase | Inhalt | Stunden |
|---|---|---|
| I – Analyse & Planung | Ist-Analyse, Soll-Konzept, Wirtschaftlichkeit, Technisches Design | 14h |
| II – Realisierung | Backend, Datenbank, WebSocket, UI | 41h |
| III – Qualitätssicherung | Unit-Tests, Fehlerbehebung, Abnahme | 10h |
| IV – Dokumentation | Projektdokumentation, Benutzerhandbuch | 15h |
| **Gesamt** | | **80h** |

---

## Lizenz

Dieses Projekt wurde im Rahmen einer IHK-Ausbildung entwickelt und ist nicht für den öffentlichen Einsatz lizenziert.

---

*Nico Hoffmann – IHK Abschlussprüfung Sommer 2026 – SIV.AG*
