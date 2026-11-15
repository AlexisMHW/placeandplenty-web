-- 20261114217480_revoke_terminal_read_only_execute.sql   (agent H, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- A8 finding m3 (hygiene): enforce_terminal_read_only() is the 202100 TRIGGER function (SECURITY DEFINER). It cannot be called as a normal function (it returns trigger), but it still carried the
-- default PUBLIC EXECUTE (so anon and authenticated could name it through the API schema). Triggers fire with the table owner's rights and need no EXECUTE grant, so revoking is safe:
-- the guard keeps working for every caller. Sibling trigger functions (enforce_terminal_read_only_receipts in 202101, the 217450 / 217460 guards) are already revoked the same way.
-- Only the EXECUTE privilege changes; no function body, trigger or data changes. Idempotent (REVOKE of an already revoked privilege is a no-op). Rollback: ROLLBACK_217480.sql.
-- ORDER: this step MUST run AFTER 202100 (which creates the function; a CREATE OR REPLACE keeps an existing ACL but a first CREATE grants PUBLIC again). It is therefore the only step placed
-- after 202101 in APPLY_ORDER.tsv; 202100 then 202101 stay contiguous and unchanged. Run before 202100 it fails loudly instead of silently doing nothing.
do $$ begin
  if to_regprocedure('public.enforce_terminal_read_only()') is null then
    raise exception 'dependency_missing: 202100 (enforce_terminal_read_only) must be applied first';
  end if;
  execute 'revoke all on function public.enforce_terminal_read_only() from public, anon, authenticated';
end $$;
