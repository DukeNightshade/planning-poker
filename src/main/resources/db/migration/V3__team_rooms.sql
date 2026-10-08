-- Permanente Team-Räume: lesbarer Name (z. B. "backend"), Teilnehmer werden gemerkt
-- und bei fehlender Verbindung als abwesend markiert statt gelöscht.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS team_name VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS uq_session_team_name ON sessions (team_name);

ALTER TABLE participants ADD COLUMN IF NOT EXISTS present BOOLEAN DEFAULT TRUE NOT NULL;
