-- Migration: Immich shared-link columns on photo_sources
-- Adds support for connecting to an Immich album via a shared link.
-- Server URL + share key are required; password is encrypted at rest and
-- only set for password-protected links. Album ID is cached on first sync.

ALTER TABLE photo_sources ADD COLUMN IF NOT EXISTS immich_server_url text;
ALTER TABLE photo_sources ADD COLUMN IF NOT EXISTS immich_share_key text;
ALTER TABLE photo_sources ADD COLUMN IF NOT EXISTS immich_password_enc text;
ALTER TABLE photo_sources ADD COLUMN IF NOT EXISTS immich_album_id text;
