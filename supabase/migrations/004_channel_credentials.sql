-- supabase/migrations/004_channel_credentials.sql
-- Credential store: only accessible via service role key.
-- anon and authenticated roles are explicitly revoked.
CREATE TABLE channel_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id   uuid NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  access_token    text NOT NULL,
  refresh_token   text,
  expires_at      bigint,
  extra           jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE channel_credentials ENABLE ROW LEVEL SECURITY;
-- No RLS policies = deny-all for anon/authenticated roles.
-- Service role bypasses RLS entirely (Supabase default behavior).
REVOKE ALL ON channel_credentials FROM anon, authenticated;
