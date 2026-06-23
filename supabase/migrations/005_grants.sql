-- supabase/migrations/005_grants.sql
-- Role privileges for the connext tables.
-- RLS controls WHICH ROWS a role sees; a role still needs base table GRANTs to
-- touch the table at all. The Supabase dashboard's table editor adds these
-- automatically, but raw `CREATE TABLE` migrations (001–004) do not — without
-- these grants, logged-in users hit "permission denied for table ..." (42501).

-- authenticated: logged-in users (RLS policies filter rows to their tenant)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_jobs TO authenticated;

-- service_role: backend / worker (bypasses RLS); includes the credentials store
GRANT ALL ON public.tenants TO service_role;
GRANT ALL ON public.channel_connections TO service_role;
GRANT ALL ON public.sync_jobs TO service_role;
GRANT ALL ON public.channel_credentials TO service_role;

-- channel_credentials remains denied to anon + authenticated (service_role only);
-- see 004_channel_credentials.sql REVOKE.
