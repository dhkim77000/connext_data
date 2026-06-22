-- supabase/migrations/003_sync_jobs.sql
CREATE TABLE sync_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id   uuid NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  connector_id    text NOT NULL,
  data_type       text NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'done', 'error')),
  since           timestamptz,
  until           timestamptz,
  rows_ingested   int NOT NULL DEFAULT 0,
  error_message   text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_only" ON sync_jobs
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_auth_id = auth.uid()
    )
  );
