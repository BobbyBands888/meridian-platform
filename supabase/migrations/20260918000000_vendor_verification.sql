-- Nashville Buys: optional Verified vendor tier
-- Run after 20260917000000_listing_city.sql. Paste into Supabase Dashboard > SQL Editor and run. Safe to re-run.
--
-- * Approved vendors can submit a license number and a certificate of insurance (COI) for review.
-- * COI files live in the private vendor-documents bucket. They are never public; admins view them through
--   short-lived signed links generated on the server.
-- * Admin review fields (checklist, private notes, verified date) are written only with the secret key.
-- * public_vendors gains verified_at so public pages can show the badge and sort verified vendors first.

create table if not exists public.vendor_verifications (
  vendor_id uuid primary key references public.vendors (id) on delete cascade,
  license_number text check (license_number is null or char_length(license_number) between 2 and 80),
  coi_path text check (coi_path is null or char_length(coi_path) <= 300),
  coi_file_name text check (coi_file_name is null or char_length(coi_file_name) <= 200),
  submitted_at timestamptz,
  license_checked boolean not null default false,
  coi_reviewed boolean not null default false,
  phone_call_done boolean not null default false,
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 5000),
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.vendor_verifications enable row level security;

-- Vendors may see their own submission status, but not the admin checklist or private notes.
revoke all on public.vendor_verifications from anon, authenticated;
grant select (vendor_id, license_number, coi_file_name, submitted_at, verified_at) on public.vendor_verifications to authenticated;

drop policy if exists "vendor_verifications: read own" on public.vendor_verifications;
create policy "vendor_verifications: read own" on public.vendor_verifications
  for select to authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id and v.profile_id = (select auth.uid())));

drop trigger if exists vendor_verifications_touch_updated_at on public.vendor_verifications;
create trigger vendor_verifications_touch_updated_at
  before update on public.vendor_verifications
  for each row execute function public.touch_updated_at();

-- Vendor submission. Security definer so vendors can write only these fields, after the checks below.
create or replace function public.submit_vendor_verification(p_license_number text, p_coi_path text, p_coi_file_name text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v public.vendors%rowtype;
  license text := nullif(trim(coalesce(p_license_number, '')), '');
  submitted timestamptz := now();
begin
  select * into v from public.vendors where profile_id = uid;
  if not found then
    raise exception 'Join the vendor directory first.' using errcode = '42501';
  end if;
  if v.status <> 'approved' then
    raise exception 'Verification opens once your profile is approved.' using errcode = '22023';
  end if;
  if license is null and v.category in ('attorney', 'home_inspector', 'lender', 'home_insurance') then
    raise exception 'A license number is required for this category.' using errcode = '22023';
  end if;
  if p_coi_path is null or p_coi_path not like (uid::text || '/%') or position('..' in p_coi_path) > 0 then
    raise exception 'Upload your certificate of insurance again.' using errcode = '22023';
  end if;

  insert into public.vendor_verifications (vendor_id, license_number, coi_path, coi_file_name, submitted_at)
  values (v.id, license, p_coi_path, left(p_coi_file_name, 200), submitted)
  on conflict (vendor_id) do update set
    license_number = excluded.license_number,
    coi_path = excluded.coi_path,
    coi_file_name = excluded.coi_file_name,
    submitted_at = excluded.submitted_at;

  return submitted;
end;
$$;

revoke all on function public.submit_vendor_verification(text, text, text) from public, anon;
grant execute on function public.submit_vendor_verification(text, text, text) to authenticated;

-- Public view: same columns as before, plus verified_at. Dropped and recreated so earlier migrations can be re-run.
drop view if exists public.public_vendors;
create view public.public_vendors
with (security_barrier = true)
as
select
  v.id,
  v.category,
  v.business_name,
  v.headshot_url,
  v.bio,
  v.service_area,
  v.price_range,
  v.website,
  v.founding_vendor,
  v.created_at,
  vv.verified_at
from public.vendors v
left join public.vendor_verifications vv on vv.vendor_id = v.id
where v.status = 'approved';

revoke all on public.public_vendors from anon, authenticated;
grant select on public.public_vendors to anon, authenticated;

-- Private documents bucket. No public URLs; uploads and reads limited to the vendor's own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vendor-documents', 'vendor-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vendor-documents: upload to own folder" on storage.objects;
create policy "vendor-documents: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vendor-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "vendor-documents: read own files" on storage.objects;
create policy "vendor-documents: read own files" on storage.objects
  for select to authenticated
  using (bucket_id = 'vendor-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "vendor-documents: update own files" on storage.objects;
create policy "vendor-documents: update own files" on storage.objects
  for update to authenticated
  using (bucket_id = 'vendor-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "vendor-documents: delete own files" on storage.objects;
create policy "vendor-documents: delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vendor-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
