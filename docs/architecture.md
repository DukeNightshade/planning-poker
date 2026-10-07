# Architektur

## Überblick

Planning Poker ist eine klassische Drei-Schichten-Webanwendung (Controller /
Service / Repository), ergänzt um einen WebSocket-Kanal für
Echtzeit-Updates. Persistenz erfolgt je nach Umgebung über H2 (lokal) oder
PostgreSQL (Container-Betrieb).

```
Browser A                                          Browser B
 (Teilnehmer)                                        (Teilnehmer)
     |                                                    ^
     | HTTP                                  Live-Update  |
     v                                                     |
 Controller -----.                                .------ WS-Controller
 (Session,         \                              /        (STOMP, Topics)
  Ticket, REST)      \                          /              ^
     |                  v                      v                |
     |                 Service  ----------------'  Broadcast ----'
     |                (Geschäftslogik)
     |                     |
     |                     v
     |                Repository
     |               (Spring Data JPA)
     |                     |
     `-------------------->|
                            v
                      DB (PostgreSQL)
```

## Kommunikationswege

| Weg | Verwendung |
|---|---|
| HTTP (REST, Thymeleaf) | Einmalige Aktionen: Session erstellen, beitreten, Status abrufen |
| WebSocket (STOMP) | Laufende Session: Stimme abgeben, Karten aufdecken, Live-Updates an alle Teilnehmer |

Begründung: Aktionen, die alle Teilnehmer sofort sehen müssen, erfordern Server-seitiges Pushen. Klassisches HTTP-Polling
wäre möglich, würde aber unnötige Last und Verzögerung erzeugen. WebSocket mit
STOMP wurde gewählt, da es sich nativ in Spring integriert
(`spring-boot-starter-websocket`) und Topic-basiertes Publish/Subscribe ohne
zusätzliche Infrastruktur ermöglicht.

## Datenhaltung: H2 lokal, PostgreSQL im Container

| Umgebung | Datenbank | Konfiguration |
|---|---|---|
| Lokale Entwicklung | H2 (Datei) | Default in `application.properties` |
| Container-Betrieb | PostgreSQL | Override über Umgebungsvariablen (`SPRING_DATASOURCE_*`) |

Begründung: H2 erfordert keine Installation und eignet sich für schnelle
lokale Entwicklung. Für den produktiven Betrieb ist eine vollwertige,
nebenläufigkeitsfähige Datenbank nötig, PostgreSQL ist etabliert. 
Die Umschaltung erfolgt ausschließlich über Umgebungsvariablen mit
Fallback auf H2, sodass kein Code-Pfad für die Umgebung unterschieden werden
muss.

## Containerisierung

### Multi-Stage-Build

Der Dockerfile-Build läuft in zwei Stufen:

1. **Build-Stage** (`eclipse-temurin:21-jdk-alpine`): enthält Maven Wrapper
   und JDK, baut die JAR aus dem Quellcode.
2. **Runtime-Stage** (`eclipse-temurin:21-jre-alpine`): enthält nur die JRE
   und die fertige JAR.

Begründung: Build-Werkzeuge sollen nicht im
Laufzeit-Image landen. Das hält das finale Image klein und reduziert die
Angriffsfläche. Alpine wurde als Basis gewählt, da es deutlich kleiner ist als
Standard-Debian-basierte Images.

### Trennung von Anwendung und Datenbank

App und PostgreSQL laufen als zwei getrennte Container
(`docker-compose.yml`), nicht als ein gemeinsamer Container. Das entspricht
dem SRP auf Container-Ebene und erlaubt
unabhängiges Update/Neustart von Anwendung und Datenbank.

### Daten-Persistenz

PostgreSQL-Daten liegen in einem benannten Docker-Volume
(`planning-poker-db-data`), nicht im Container-Dateisystem selbst.

Begründung: Container sind grundsätzlich als austauschbar/zustandslos
gedacht. Ein Container-Neustart, ein Image-Update oder das Entfernen des
Containers darf nicht zum Datenverlust führen. Das Volume ist vom
Lebenszyklus des Containers entkoppelt und bleibt bestehen, solange es nicht
explizit gelöscht wird (`docker compose down -v`).

### Health-Check

Der Container exponiert `/actuator/health`. Der
Dockerfile-`HEALTHCHECK` prüft diesen Endpunkt periodisch.

Begründung: Ein gestarteter Container-Prozess bedeutet nicht zwangsläufig
eine funktionsfähige Anwendung.
Der Health-Check macht den tatsächlichen Anwendungszustand für Orchestrierung
und Monitoring sichtbar, statt nur den Prozessstatus zu prüfen.

## Trade-offs

| Entscheidung | Vorteil | Nachteil / bewusst akzeptiert |
|---|---|---|
| WebSocket statt Polling | Echtzeit, geringere Last | Etwas höhere initiale Komplexität |
| Zwei H2/Postgres-Pfade über Properties | Keine Code-Verzweigung nach Umgebung | Verhalten zwischen Umgebungen kann bei Edge-Cases leicht abweichen |
| Multi-Stage Alpine-Image | Kleines, schlankes Image | Alpine nutzt musl statt glibc; vereinzelt inkompatible Java-Native-Bibliotheken (hier nicht relevant) |
| Getrenntes DB-Volume statt Bind-Mount | Von Docker verwaltet, plattformunabhängig | Datenpfad auf dem Host nicht ohne `docker volume inspect` einsehbar |