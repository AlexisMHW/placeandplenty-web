-- ROLLBACK_207000_CORRECTED.sql  (follow-up J; replaces ROLLBACK_207000.sql. PROPOSED, NOT APPLIED)
-- D5 of REPORT_r-rehearsal: the shipped rollback restores save/remove_invitation_artwork with equivalent but differently formatted text. This file restores QA's captured text verbatim and asserts
-- the md5 of pg_get_functiondef (first 12 chars): save 52c18c346e1b, remove 5fbeadd04b24. Then it drops the additive functions, as before. Atomic.
do $rb$
declare v_got text;
begin
  execute $qa_body$CREATE OR REPLACE FUNCTION public.save_invitation_artwork(p_gathering_id uuid, p_storage_path text, p_mime_type text, p_original_filename text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_accepted_gathering_member(p_gathering_id) then
    raise exception 'not authorized';
  end if;

  update gatherings
  set invitation_mode = 'uploaded',
      invitation_artwork_path = p_storage_path,
      invitation_artwork_mime_type = p_mime_type,
      invitation_artwork_original_filename = p_original_filename,
      invitation_artwork_uploaded_at = now()
  where id = p_gathering_id;
end;
$function$
;$qa_body$;
  execute $qa_body$CREATE OR REPLACE FUNCTION public.remove_invitation_artwork(p_gathering_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_accepted_gathering_member(p_gathering_id) then
    raise exception 'not authorized';
  end if;

  update gatherings
  set invitation_mode = 'details_only',
      invitation_artwork_path = null,
      invitation_artwork_mime_type = null,
      invitation_artwork_original_filename = null,
      invitation_artwork_uploaded_at = null
  where id = p_gathering_id;
end;
$function$
;$qa_body$;
  select left(md5(pg_get_functiondef(p.oid)),12) into v_got from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='save_invitation_artwork';
  if v_got <> '52c18c346e1b' then raise exception 'rollback: save_invitation_artwork md5 % <> captured 52c18c346e1b', v_got; end if;
  select left(md5(pg_get_functiondef(p.oid)),12) into v_got from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='remove_invitation_artwork';
  if v_got <> '5fbeadd04b24' then raise exception 'rollback: remove_invitation_artwork md5 % <> captured 5fbeadd04b24', v_got; end if;
  execute 'drop function if exists public.invitation_artwork_cleanup_allowed(uuid, text)';
  execute 'drop function if exists public.can_manage_invitations(uuid)';
end
$rb$;
