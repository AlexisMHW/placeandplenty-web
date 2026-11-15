-- Rollback for 20261114202101_lifecycle_terminal_read_only_receipts_fix: restores the exact 202100 state for guest_update_receipts
-- (strict trigger on the shared function; NOTE that is the 202100 defect: writes raise 42703 until 202100 itself is rolled back / re-fixed).
-- Run BEFORE ROLLBACK_20261114202100 (reverse order). Safe to run twice; no-op on the table if 202100 is absent.
do $$ begin
  if to_regclass('public.guest_update_receipts') is not null then
    drop trigger if exists trg_terminal_read_only_strict on public.guest_update_receipts;
    if to_regprocedure('public.enforce_terminal_read_only()') is not null then
      create trigger trg_terminal_read_only_strict before insert or update on public.guest_update_receipts
        for each row execute function public.enforce_terminal_read_only('none', 'strict');
    end if;
  end if;
end $$;
drop function if exists public.enforce_terminal_read_only_receipts();
