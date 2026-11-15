-- Rollback of 217450 (agent S2): removes the extra gathering_photos window trigger and its function. 202100 and every existing photo rule are untouched.
drop trigger if exists trg_gathering_photo_window on public.gathering_photos;
drop function if exists public.enforce_gathering_photo_window();
