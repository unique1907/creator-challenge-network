-- Sprint 09B Supabase catalog proof
--
-- Read-only operator SQL for Supabase SQL Editor.
-- Do not edit data with this file. Do not paste secrets into this file.

-- 1. Expected canonical table existence.
with expected_tables(schema_name, table_name) as (
  values
    ('public', 'accounts'),
    ('public', 'ccn_challenge_drafts'),
    ('public', 'ccn_challenge_funding_records'),
    ('public', 'ccn_wallet_approval_attempts'),
    ('public', 'ccn_funding_attempts'),
    ('public', 'ccn_creator_submissions'),
    ('public', 'ccn_submission_finalize_keys'),
    ('public', 'ccn_review_scores'),
    ('public', 'ccn_winner_finalization_attempts'),
    ('public', 'ccn_onchain_verifications'),
    ('public', 'ccn_lifecycle_events'),
    ('public', 'ccn_wallet_mappings'),
    ('public', 'ccn_legacy_wallet_records')
)
select expected_tables.schema_name, expected_tables.table_name, tables.table_type, tables.table_name is not null as exists
from expected_tables
left join information_schema.tables tables
  on tables.table_schema = expected_tables.schema_name
 and tables.table_name = expected_tables.table_name
order by expected_tables.schema_name, expected_tables.table_name;

-- 2. Accounts column proof.
select table_schema, table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'accounts'
  and column_name in (
    'account_id',
    'supabase_user_id',
    'is_brand',
    'is_creator',
    'created_at',
    'updated_at',
    'deleted_at',
    'status',
    'primary_email'
  )
order by ordinal_position;

-- 3. Exact accounts.supabase_user_id -> auth.users.id foreign-key proof.
select
  constraint_row.conname as constraint_name,
  source_namespace.nspname as source_schema,
  source_table.relname as source_table,
  source_column.attname as source_column,
  target_namespace.nspname as target_schema,
  target_table.relname as target_table,
  target_column.attname as target_column,
  case constraint_row.confupdtype
    when 'a' then 'NO ACTION'
    when 'r' then 'RESTRICT'
    when 'c' then 'CASCADE'
    when 'n' then 'SET NULL'
    when 'd' then 'SET DEFAULT'
  end as update_rule,
  case constraint_row.confdeltype
    when 'a' then 'NO ACTION'
    when 'r' then 'RESTRICT'
    when 'c' then 'CASCADE'
    when 'n' then 'SET NULL'
    when 'd' then 'SET DEFAULT'
  end as delete_rule,
  constraint_row.condeferrable as deferrable,
  constraint_row.condeferred as initially_deferred,
  constraint_row.convalidated as validated
from pg_constraint constraint_row
join pg_class source_table on source_table.oid = constraint_row.conrelid
join pg_namespace source_namespace on source_namespace.oid = source_table.relnamespace
join pg_class target_table on target_table.oid = constraint_row.confrelid
join pg_namespace target_namespace on target_namespace.oid = target_table.relnamespace
join unnest(constraint_row.conkey) with ordinality as source_key(attnum, ord) on true
join pg_attribute source_column
  on source_column.attrelid = source_table.oid
 and source_column.attnum = source_key.attnum
join unnest(constraint_row.confkey) with ordinality as target_key(attnum, ord)
  on target_key.ord = source_key.ord
join pg_attribute target_column
  on target_column.attrelid = target_table.oid
 and target_column.attnum = target_key.attnum
where constraint_row.contype = 'f'
  and source_namespace.nspname = 'public'
  and source_table.relname = 'accounts'
  and source_column.attname = 'supabase_user_id'
order by constraint_row.conname, source_key.ord;

-- 4. Orphan proof: count only. Do not expose emails or auth metadata.
select count(*) as orphan_account_count
from public.accounts accounts
left join auth.users users on users.id = accounts.supabase_user_id
where accounts.supabase_user_id is not null
  and users.id is null;

-- 5. Duplicate/idempotency proof: count only.
select 'accounts.supabase_user_id' as check_name, count(*) as duplicate_group_count
from (select supabase_user_id from public.accounts group by supabase_user_id having count(*) > 1) duplicate_rows
union all
select 'ccn_creator_submissions.challenge_id+creator_account_id', count(*)
from (select challenge_id, creator_account_id from public.ccn_creator_submissions group by challenge_id, creator_account_id having count(*) > 1) duplicate_rows
union all
select 'ccn_submission_finalize_keys.finalize_key', count(*)
from (select finalize_key from public.ccn_submission_finalize_keys group by finalize_key having count(*) > 1) duplicate_rows
union all
select 'ccn_wallet_approval_attempts.idempotency_key', count(*)
from (select idempotency_key from public.ccn_wallet_approval_attempts group by idempotency_key having count(*) > 1) duplicate_rows
union all
select 'ccn_funding_attempts.idempotency_key', count(*)
from (select idempotency_key from public.ccn_funding_attempts group by idempotency_key having count(*) > 1) duplicate_rows
union all
select 'ccn_winner_finalization_attempts.idempotency_key', count(*)
from (select idempotency_key from public.ccn_winner_finalization_attempts group by idempotency_key having count(*) > 1) duplicate_rows
union all
select 'ccn_onchain_verifications.challenge_id+event_type+tx_hash', count(*)
from (select challenge_id, event_type, tx_hash from public.ccn_onchain_verifications group by challenge_id, event_type, tx_hash having count(*) > 1) duplicate_rows;

-- 6. Primary-key and unique constraints for canonical tables.
select
  table_namespace.nspname as table_schema,
  table_row.relname as table_name,
  constraint_row.conname as constraint_name,
  constraint_row.contype as constraint_type,
  constraint_row.convalidated as validated,
  array_agg(column_row.attname order by key_column.ord) as columns
from pg_constraint constraint_row
join pg_class table_row on table_row.oid = constraint_row.conrelid
join pg_namespace table_namespace on table_namespace.oid = table_row.relnamespace
join unnest(constraint_row.conkey) with ordinality as key_column(attnum, ord) on true
join pg_attribute column_row on column_row.attrelid = table_row.oid and column_row.attnum = key_column.attnum
where table_namespace.nspname = 'public'
  and table_row.relname in (
    'accounts',
    'ccn_challenge_drafts',
    'ccn_challenge_funding_records',
    'ccn_wallet_approval_attempts',
    'ccn_funding_attempts',
    'ccn_creator_submissions',
    'ccn_submission_finalize_keys',
    'ccn_review_scores',
    'ccn_winner_finalization_attempts',
    'ccn_onchain_verifications',
    'ccn_lifecycle_events',
    'ccn_wallet_mappings',
    'ccn_legacy_wallet_records'
  )
  and constraint_row.contype in ('p', 'u')
group by table_namespace.nspname, table_row.relname, constraint_row.conname, constraint_row.contype, constraint_row.convalidated
order by table_row.relname, constraint_row.contype, constraint_row.conname;

-- 7. Index proof, including validity and ordered columns.
select
  table_namespace.nspname as table_schema,
  table_row.relname as table_name,
  index_row.relname as index_name,
  index_catalog.indisunique as is_unique,
  index_catalog.indisprimary as is_primary,
  index_catalog.indisvalid as is_valid,
  array_agg(column_row.attname order by key_column.ord) filter (where column_row.attname is not null) as columns,
  pg_get_indexdef(index_catalog.indexrelid) as index_definition
from pg_index index_catalog
join pg_class table_row on table_row.oid = index_catalog.indrelid
join pg_namespace table_namespace on table_namespace.oid = table_row.relnamespace
join pg_class index_row on index_row.oid = index_catalog.indexrelid
left join unnest(index_catalog.indkey) with ordinality as key_column(attnum, ord) on true
left join pg_attribute column_row on column_row.attrelid = table_row.oid and column_row.attnum = key_column.attnum
where table_namespace.nspname = 'public'
  and table_row.relname in (
    'accounts',
    'ccn_challenge_drafts',
    'ccn_challenge_funding_records',
    'ccn_wallet_approval_attempts',
    'ccn_funding_attempts',
    'ccn_creator_submissions',
    'ccn_submission_finalize_keys',
    'ccn_review_scores',
    'ccn_winner_finalization_attempts',
    'ccn_onchain_verifications',
    'ccn_lifecycle_events',
    'ccn_wallet_mappings',
    'ccn_legacy_wallet_records'
  )
group by table_namespace.nspname, table_row.relname, index_row.relname, index_catalog.indisunique, index_catalog.indisprimary, index_catalog.indisvalid, index_catalog.indexrelid
order by table_row.relname, index_row.relname;

-- 8. RLS proof.
select
  namespace_row.nspname as table_schema,
  class_row.relname as table_name,
  class_row.relrowsecurity as rls_enabled,
  class_row.relforcerowsecurity as rls_forced,
  owner_role.rolname as owner
from pg_class class_row
join pg_namespace namespace_row on namespace_row.oid = class_row.relnamespace
join pg_roles owner_role on owner_role.oid = class_row.relowner
where namespace_row.nspname = 'public'
  and class_row.relkind in ('r', 'p')
  and class_row.relname in (
    'accounts',
    'ccn_challenge_drafts',
    'ccn_challenge_funding_records',
    'ccn_wallet_approval_attempts',
    'ccn_funding_attempts',
    'ccn_creator_submissions',
    'ccn_submission_finalize_keys',
    'ccn_review_scores',
    'ccn_winner_finalization_attempts',
    'ccn_onchain_verifications',
    'ccn_lifecycle_events',
    'ccn_wallet_mappings',
    'ccn_legacy_wallet_records'
  )
order by class_row.relname;

-- 9. Policy proof.
select schemaname, tablename, policyname, permissive, roles, cmd, qual as using_expression, with_check as check_expression
from pg_policies
where schemaname = 'public'
  and tablename in (
    'accounts',
    'ccn_challenge_drafts',
    'ccn_challenge_funding_records',
    'ccn_wallet_approval_attempts',
    'ccn_funding_attempts',
    'ccn_creator_submissions',
    'ccn_submission_finalize_keys',
    'ccn_review_scores',
    'ccn_winner_finalization_attempts',
    'ccn_onchain_verifications',
    'ccn_lifecycle_events',
    'ccn_wallet_mappings',
    'ccn_legacy_wallet_records'
  )
order by tablename, policyname;

-- 10. Safe grants proof.
select table_schema, table_name, grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'accounts',
    'ccn_challenge_drafts',
    'ccn_challenge_funding_records',
    'ccn_wallet_approval_attempts',
    'ccn_funding_attempts',
    'ccn_creator_submissions',
    'ccn_submission_finalize_keys',
    'ccn_review_scores',
    'ccn_winner_finalization_attempts',
    'ccn_onchain_verifications',
    'ccn_lifecycle_events',
    'ccn_wallet_mappings',
    'ccn_legacy_wallet_records'
  )
order by table_name, grantee, privilege_type;

-- 11. Storage bucket proof for public CCN media.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'ccn-media';

-- 12. storage.objects policy proof for CCN media.
select schemaname, tablename, policyname, permissive, roles, cmd, qual as using_expression, with_check as check_expression
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname = 'ccn-media authenticated reads'
order by policyname;
