-- Sprint 008 Brand identity and campaign media deadlock recovery.
-- Manual SQL Editor recovery only.
-- Additive, idempotent, independently rerunnable blocks.
-- Do not run inside a larger transaction wrapper.

-- ============================================================
-- BLOCK A — accounts columns
-- Run first.
-- ============================================================
set lock_timeout = '10s';
set statement_timeout = '120s';

alter table public.accounts
  add column if not exists avatar_image_key text;

alter table public.accounts
  add column if not exists avatar_image_updated_at timestamptz;

alter table public.accounts
  add column if not exists brand_logo_image_key text;

alter table public.accounts
  add column if not exists website_url text;

alter table public.accounts
  add column if not exists company_description text;

alter table public.accounts
  add column if not exists linkedin_url text;

alter table public.accounts
  add column if not exists instagram_url text;

alter table public.accounts
  add column if not exists x_url text;

-- ============================================================
-- BLOCK B — challenge cover columns
-- Run after Block A succeeds.
-- ============================================================
set lock_timeout = '10s';
set statement_timeout = '120s';

alter table public.ccn_challenge_drafts
  add column if not exists cover_image_key text;

alter table public.ccn_challenge_drafts
  add column if not exists cover_image_alt text;

alter table public.ccn_challenge_drafts
  add column if not exists cover_image_updated_at timestamptz;

-- ============================================================
-- BLOCK C — storage bucket
-- Run after Blocks A and B succeed.
-- ============================================================
set lock_timeout = '10s';
set statement_timeout = '120s';

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

-- ============================================================
-- BLOCK D — storage policies/indexes
-- Run after Block C succeeds.
-- ============================================================
set lock_timeout = '10s';
set statement_timeout = '120s';

create index if not exists accounts_brand_identity_media_idx
  on public.accounts (account_id, avatar_image_updated_at)
  where deleted_at is null;

create index if not exists ccn_challenge_drafts_cover_media_idx
  on public.ccn_challenge_drafts (draft_id, cover_image_updated_at);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'ccn-media authenticated reads'
  ) then
    execute $policy$
      create policy "ccn-media authenticated reads"
      on storage.objects
      for select
      to authenticated
      using (bucket_id = 'ccn-media')
    $policy$;
  end if;
end
$$;

-- Uploads are performed by server-owned routes after authenticated ownership
-- checks. Do not create public/client INSERT or UPDATE storage policies.

-- ============================================================
-- BLOCK E — verification queries
-- Read-only. Run after Blocks A-D.
-- ============================================================
set statement_timeout = '120s';

select
  table_schema,
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'accounts' and column_name in (
      'avatar_image_key',
      'avatar_image_updated_at',
      'brand_logo_image_key',
      'website_url',
      'company_description',
      'linkedin_url',
      'instagram_url',
      'x_url'
    ))
    or
    (table_name = 'ccn_challenge_drafts' and column_name in (
      'cover_image_key',
      'cover_image_alt',
      'cover_image_updated_at'
    ))
  )
order by table_name, column_name;

select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'ccn-media';

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname = 'ccn-media authenticated reads';

select
  schemaname,
  tablename,
  indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'accounts_brand_identity_media_idx',
    'ccn_challenge_drafts_cover_media_idx'
  )
order by indexname;
