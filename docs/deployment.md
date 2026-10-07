# Deployment

## Übersicht

Die Anwendung wird als Docker-Image übergeben, nicht als Quellcode. Der
Zielserver benötigt ausschließlich eine laufende Docker-Engine mit
Compose-Plugin, kein Java, kein Maven, keine sonstige Software.

## Image-Export (Entwicklungsseite)

```bash
docker compose build
docker save -o planning-poker.tar planning-poker:latest
```

`docker save` exportiert das fertig gebaute Image in eine einzelne,
transportierbare Datei. Diese Datei enthält ausschließlich die Anwendung
(Code, JRE, Abhängigkeiten) — keine Datenbank-Inhalte.

## Übergabe-Paket

Für die Übergabe werden drei Dateien zusammengestellt:

| Datei | Zweck |
|---|---|
| `planning-poker.tar` | Das exportierte Image |
| `docker-compose.yml` | Startet App- und DB-Container zusammen, definiert das Daten-Volume |
| `.env.example` | Vorlage für das Datenbank-Passwort |

## Einbindung auf dem Server (Empfängerseite)

### 1. Image laden

```bash
docker load -i planning-poker.tar
docker images   # Kontrolle: planning-poker:latest sollte gelistet sein
```

`docker load` macht das Image im Docker des Servers bekannt. Es startet
dabei noch nichts.

### 2. Datenbank-Passwort konfigurieren

```bash
cp .env.example .env
# DB_PASSWORD in .env auf einen sicheren Wert setzen
```

### 3. Container starten

```bash
docker compose up -d
```

Kein `--build` verwenden — das Image liegt bereits vor (Schritt 1); ein Build
würde Quellcode voraussetzen, der hier nicht mitgeliefert wird.

Der Befehl startet zwei Container:

- `app` — die Anwendung
- `db` — PostgreSQL

### 4. Status prüfen

```bash
docker compose ps
curl http://localhost:8080/actuator/health
```

Erwartete Antwort: `{"status":"UP", ...}`.

## Datenbank-Persistenz

PostgreSQL-Daten liegen in einem benannten Docker-Volume
(`planning-poker-db-data`), getrennt vom App-Container und vom Image.

| Aktion | Auswirkung auf die Daten |
|---|---|
| `docker compose down` | Daten bleiben erhalten |
| Neues Image laden (Update) | Daten bleiben erhalten |
| Server-Neustart | Daten bleiben erhalten |
| `docker compose down -v` | Daten werden gelöscht (nur mit `-v`) |

Volume einsehen:

```bash
docker volume ls
docker volume inspect <projektname>_planning-poker-db-data
```

## Update auf eine neue Version

```bash
docker compose down
docker load -i planning-poker-neu.tar
docker compose up -d
```

Die Datenbank-Inhalte sind vom Image unabhängig und bleiben beim Update
unverändert.

## Logs

```bash
docker compose logs -f app
docker compose logs -f db
```