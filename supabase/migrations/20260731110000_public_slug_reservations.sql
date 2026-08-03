-- P0 public slug reservation.
-- Public slugs are globally unique and reserved before publish.

create table if not exists public.ccn_public_slug_reservations (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  draft_id text not null unique references public.ccn_challenge_drafts(draft_id) on delete cascade,
  title_basis text not null check (title_basis ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ccn_public_slug_reservations_draft_idx
  on public.ccn_public_slug_reservations (draft_id);

create index if not exists ccn_public_slug_reservations_title_basis_idx
  on public.ccn_public_slug_reservations (title_basis);

alter table public.ccn_public_slug_reservations enable row level security;

revoke all on public.ccn_public_slug_reservations from anon, authenticated;

insert into public.ccn_public_slug_reservations (slug, draft_id, title_basis)
select
  draft.slug,
  draft.draft_id,
  coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(draft.title), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    draft.slug
  ) as title_basis
from public.ccn_challenge_drafts draft
where draft.slug is not null
  and draft.slug <> 'new-challenge'
  and trim(draft.title) <> ''
  and lower(trim(draft.title)) not in ('untitled draft', 'untitled challenge')
on conflict do nothing;
