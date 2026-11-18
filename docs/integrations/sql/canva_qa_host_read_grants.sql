-- QA-only bootstrap parity: production authenticated SELECT and identical RLS
-- were inspected for all seven tables. No policy or write privilege is changed.
grant select on public.gathering_guests, public.guests, public.contributions,
  public.shopping_items, public.menu_items, public.gathering_expenses,
  public.hosting_closet_items to authenticated;
