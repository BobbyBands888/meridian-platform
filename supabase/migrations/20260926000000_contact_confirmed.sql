-- Ownvista: vendor review step "Phone call done" becomes "Contact confirmed by email"
-- Run after 20260925000000_photos_and_funnel.sql. Paste into Supabase Dashboard > SQL Editor and run. Safe to re-run.
--
-- * Renames vendor_verifications.phone_call_done to contact_confirmed. A rename keeps every row's value and the
--   column's privileges, so a vendor with the old step checked stays checked under the new name.
-- * Deploy the matching app code right after running this: the admin verification form reads and writes the new name.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vendor_verifications' and column_name = 'phone_call_done'
  ) then
    alter table public.vendor_verifications rename column phone_call_done to contact_confirmed;
  end if;
end $$;

comment on column public.vendor_verifications.contact_confirmed is
  'Admin review step: the vendor replied from an email at their business domain (or the email on file) confirming the account.';
