-- Synthetic authenticated onboarding roundtrip, retry and rollback.
begin;
create function pg_temp.onboard_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ONBOARD ASSERTION: %',label; end if; end $$;
insert into auth.users(id,email) values
 ('a1111111-1111-4111-8111-111111111111','onboard-a@example.invalid'),
 ('a2222222-2222-4222-8222-222222222222','onboard-b@example.invalid');
create function public.test_reject_academic_update() returns trigger language plpgsql as $$
begin if new.full_name='Forced failure' then raise exception 'synthetic persistence failure'; end if; return new; end $$;
create trigger test_academic_failure before insert or update on public.academic_profiles
 for each row execute function public.test_reject_academic_update();
grant select,insert,update,delete on all tables in schema public to authenticated;
set role authenticated;
set test.uid='a1111111-1111-4111-8111-111111111111';
select public.complete_tweenz_onboarding('Student A','MBA','Synthetic University',4,15,'ar','career');
select pg_temp.onboard_assert((select display_name='Student A' and lang='ar' and onboarded and role='student' from public.users where id=auth.uid()),'profile persisted without role change');
select pg_temp.onboard_assert((select full_name='Student A' and mba_program='MBA' and university='Synthetic University' and gpa_scale=4 and weekly_study_hrs=15 and study_goals='career' from public.academic_profiles where user_id=auth.uid()),'all existing form fields roundtrip');
update public.academic_profiles set reg_number='keep-existing-reg',major='Existing major' where user_id=auth.uid();
select public.complete_tweenz_onboarding('Student A','MBA','Synthetic University',100,20,'en','skills');
select pg_temp.onboard_assert((select reg_number='keep-existing-reg' and major='Existing major' from public.academic_profiles where user_id=auth.uid()),'resubmission preserves unrelated academic fields');
select pg_temp.onboard_assert((select count(*)=1 from public.academic_profiles),'retry upserts one own academic profile');
select pg_temp.onboard_assert((select gpa_scale=100 and weekly_study_hrs=20 from public.academic_profiles where user_id=auth.uid()),'retry updates declared values');
do $$ begin
 begin perform public.complete_tweenz_onboarding('Forced failure','MBA','Synthetic University',4,15,'ar','career'); raise exception 'unexpected success';
 exception when raise_exception then if sqlerrm <> 'synthetic persistence failure' then raise; end if; end;
 perform pg_temp.onboard_assert((select display_name='Student A' and lang='en' from public.users where id=auth.uid()),'academic failure rolls back profile update');
 perform pg_temp.onboard_assert((select gpa_scale=100 from public.academic_profiles where user_id=auth.uid()),'academic failure leaves prior row intact');
 begin perform public.complete_tweenz_onboarding('Student A','MBA','U',3,15,'en','career'); raise exception 'invalid GPA accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.complete_tweenz_onboarding('Student A','MBA','U',4,-1,'en','career'); raise exception 'invalid hours accepted'; exception when invalid_parameter_value then null; end;
end $$;
set test.uid='a2222222-2222-4222-8222-222222222222';
select pg_temp.onboard_assert((select count(*)=0 from public.academic_profiles),'foreign academic profile hidden');
select pg_temp.onboard_assert((select display_name='onboard-b' and not onboarded from public.users where id=auth.uid()),'other user profile untouched');
do $$ begin
 begin perform public.complete_tweenz_onboarding('Forced failure','MBA','Other University',4,10,'ar','gpa'); raise exception 'unexpected success';
 exception when raise_exception then if sqlerrm <> 'synthetic persistence failure' then raise; end if; end;
 perform pg_temp.onboard_assert((select not onboarded and display_name='onboard-b' from public.users where id=auth.uid()),'first failed onboarding does not mark user complete');
end $$;
select public.complete_tweenz_onboarding('Student B','MBA','Other University',4,10,'en','gpa');
set test.uid='';
do $$ begin
 begin perform public.complete_tweenz_onboarding('No user','MBA','U',4,15,'en','gpa'); raise exception 'unauthenticated accepted'; exception when invalid_authorization_specification then null; end;
end $$;
reset role;
select pg_temp.onboard_assert((select count(*)=2 from public.academic_profiles where user_id::text like 'a%'),'two isolated users retained');
-- A missing app profile is a failure, not false successful onboarding.
insert into auth.users(id,email) values ('a3333333-3333-4333-8333-333333333333','missing-profile@example.invalid');
delete from public.users where id='a3333333-3333-4333-8333-333333333333';
set role authenticated;
set test.uid='a3333333-3333-4333-8333-333333333333';
do $$ begin
 begin perform public.complete_tweenz_onboarding('Missing','MBA','U',4,15,'en','gpa'); raise exception 'missing profile accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
 begin perform public.complete_tweenz_onboarding('Anon','MBA','U',4,15,'en','gpa'); raise exception 'anonymous execute accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'ONBOARDING_ROUNDTRIP_PASS' as result;
rollback;
