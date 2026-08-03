-- Sprint 008: Brand identity and campaign media.
-- Additive only. Does not alter funding, wallet, review, payout, settlement or contract tables.

alter table public.accounts
  add column if not exists avatar_image_key text,
  add column if not exists avatar_image_updated_at timestamptz,
  add column if not exists brand_logo_image_key text,
  add column if not exists website_url text,
  add column if not exists company_description text,
  add column if not exists linkedin_url text,
  add column if not exists instagram_url text,
  add column if not exists x_url text;

alter table public.ccn_challenge_drafts
  add column if not exists cover_image_key text,
  add column if not exists cover_image_alt text,
  add column if not exists cover_image_updated_at timestamptz;

create index if not exists accounts_brand_identity_media_idx
  on public.accounts (account_id, avatar_image_updated_at)
  where deleted_at is null;

create index if not exists ccn_challenge_drafts_cover_media_idx
  on public.ccn_challenge_drafts (draft_id, cover_image_updated_at);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ccn-media',
  'ccn-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ccn-media authenticated reads" on storage.objects;
create policy "ccn-media authenticated reads"
on storage.objects
for select
to authenticated
using (bucket_id = 'ccn-media');

-- Uploads are performed by server-owned routes after authenticated ownership
-- checks. Do not create public/client INSERT or UPDATE storage policies.
