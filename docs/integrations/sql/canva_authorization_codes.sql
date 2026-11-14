-- REVIEW ONLY: do not apply to production without approval.
-- No gathering, storage, subscription or entitlement policies are modified.
create table public.canva_authorization_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_challenge text not null,
  encrypted_grant text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint short_expiry check (expires_at <= now() + interval '2 minutes')
);
alter table public.canva_authorization_codes enable row level security;
revoke all on public.canva_authorization_codes from anon, authenticated;
grant insert on public.canva_authorization_codes to authenticated;
create policy canva_code_insert on public.canva_authorization_codes
  for insert to authenticated with check (user_id = auth.uid());

-- Knowledge of the random 256-bit code AND its PKCE verifier is required.
-- UPDATE is atomic: parallel redemptions cannot both consume the same code.
create function public.redeem_canva_authorization_code(p_code_hash text, p_code_challenge text)
returns text language sql security definer set search_path = '' as $$
  update public.canva_authorization_codes
  set consumed_at = now()
  where code_hash = p_code_hash and code_challenge = p_code_challenge
    and consumed_at is null and expires_at > now()
  returning encrypted_grant;
$$;
revoke all on function public.redeem_canva_authorization_code(text,text) from public;
grant execute on function public.redeem_canva_authorization_code(text,text) to anon;
-- Schedule deletion of expired codes in the staging environment before release.
