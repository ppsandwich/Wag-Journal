begin;
create table if not exists former_memberships(household_id uuid not null references households(id) on delete cascade,user_id uuid not null,removed_at timestamptz not null default now(),primary key(household_id,user_id));
alter table former_memberships enable row level security;
alter table quarantined_changes add column if not exists user_id uuid;
commit;
