-- supabase/migrations/002_channel_connections.sql
CREATE TABLE channel_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connector_id    text NOT NULL,
  display_name    text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'error', 'paused')),
  extra           jsonb NOT NULL DEFAULT '{}',
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE channel_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_only" ON channel_connections
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_auth_id = auth.uid()
    )
  );
