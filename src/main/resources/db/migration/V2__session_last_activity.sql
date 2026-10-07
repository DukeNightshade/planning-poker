-- Sessions werden nach letzter Aktivität statt nach Erstellzeit aufgeräumt
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP(6);
UPDATE sessions SET last_activity_at = created_at WHERE last_activity_at IS NULL;
ALTER TABLE sessions ALTER COLUMN last_activity_at SET NOT NULL;
