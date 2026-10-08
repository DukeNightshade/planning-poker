-- Moderatoren stimmen immer mit; stattdessen lässt sich das Mitwählen der
-- Product Owner abschalten (Standard: Product Owner stimmen mit).
ALTER TABLE sessions DROP COLUMN IF EXISTS moderator_can_vote;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS product_owner_can_vote BOOLEAN DEFAULT TRUE NOT NULL;
