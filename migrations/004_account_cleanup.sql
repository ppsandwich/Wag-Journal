begin;
create or replace function anonymise_wag_account(target uuid) returns void language plpgsql set search_path=public as $$
begin
 if exists(select 1 from households where owner_id=target) then raise exception 'Transfer or delete owned households first'; end if;
 update records set actor_id=null,data=jsonb_set(jsonb_set(data,'{actor}','"Former caregiver"'),'{actorId}','null') where actor_id=target and kind<>'preference';
 update history set actor='Former caregiver',actor_id=null,
  after_data=jsonb_set(jsonb_set(after_data,'{actor}','"Former caregiver"'),'{actorId}','null') where actor_id=target;
 update history set before_data=jsonb_set(jsonb_set(before_data,'{actor}','"Former caregiver"'),'{actorId}','null') where before_data->>'actorId'=target::text;
 update records set data=data-'userId' where data->>'actorId'=target::text;
 delete from push_subscriptions where user_id=target;
 delete from records where kind='preference' and actor_id=target;
 delete from mutation_receipts where actor_id=target;
 delete from transfers where to_user=target;
 delete from memberships where user_id=target;
 delete from invitations where email=(select email from profiles where id=target);
 delete from former_memberships where user_id=target;
 delete from quarantined_changes where user_id=target;
 update history set after_data=jsonb_set(jsonb_set(after_data,'{actor}','"Former caregiver"'),'{actorId}','null') where after_data->>'actorId'=target::text;
 delete from profiles where id=target;
 update account_deletions set completed_at=now() where user_id=target;
end;$$;
revoke all on function anonymise_wag_account(uuid) from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then execute 'revoke all on function anonymise_wag_account(uuid) from anon'; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then execute 'revoke all on function anonymise_wag_account(uuid) from authenticated'; end if;
end $$;
commit;
