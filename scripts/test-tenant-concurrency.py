#!/usr/bin/env python3
"""Optional real multi-session test, ONLY on an initialized disposable local database.
Apply stub.sql and the tenant migration chain first. Needs psql on PATH.
TEST_DATABASE_IS_DISPOSABLE=1 PGHOST=/private/local/socket PGDATABASE=tenant_test_race python3 scripts/test-tenant-concurrency.py
Not a production or Supabase-project runner. No hosted credentials required.
"""
import concurrent.futures
import os
import subprocess

host = os.environ.get('PGHOST', '')
assert os.environ.get('TEST_DATABASE_IS_DISPOSABLE') == '1', 'Explicit disposable database opt-in required'
assert os.environ.get('PGDATABASE', '').startswith('tenant_test_'), 'Only tenant_test_* databases permitted'
assert host == '127.0.0.1' or host.startswith('/'), 'Only local PostgreSQL is permitted'

def sql(query):
    return subprocess.run(['psql','-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At','-c',query],text=True,capture_output=True)

def success(query):
    result=sql(query)
    assert result.returncode == 0, result.stderr
    return result.stdout

def actor(uid, query):
    return f"set role authenticated; set test.uid='{uid}'; " + query

def race(left, right, failure):
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(sql,q) for q in [left,right]]
        results=[f.result() for f in futures]
    assert sum(r.returncode == 0 for r in results) == 1, [(r.returncode,r.stderr) for r in results]
    assert failure in next(r.stderr for r in results if r.returncode != 0), results
    return results

a='66666666-6666-4666-8666-666666666666'
b='77777777-7777-4777-8777-777777777777'
success(f"insert into auth.users(id,email) values('{a}','race-a@example.invalid'),('{b}','race-b@example.invalid'); grant select,insert,update,delete on all tables in schema public to authenticated;")
success(actor(a,"insert into public.organizations(id,name,slug) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Race creator','race-creator');"))
claim="insert into public.memberships(user_id,org_id,role) values(auth.uid(),'dddddddd-dddd-4ddd-8ddd-dddddddddddd','owner');"
results=race(actor(a,claim),actor(b,claim),'42501')
assert results[0].returncode == 0, 'Only the bound creator may win'
success(actor(a,"insert into public.organizations(id,name,slug) values('dddddddd-dddd-4ddd-8ddd-ddddddddddde','Double submit','race-double');"))
claim2=claim.replace('dddddddddddd','ddddddddddde')
race(actor(a,claim2),actor(a,claim2),'23505')
race(actor(a,"select public.create_organization('RPC race','race-rpc');"),actor(b,"select public.create_organization('RPC race','race-rpc');"),'23505')
check=success("select count(*)=3 and bool_and(n=1 and owner_matches) from (select o.id,count(m.id) n,bool_and(m.user_id=o.creator_user_id and m.role='owner') owner_matches from public.organizations o left join public.memberships m on m.org_id=o.id where o.slug in ('race-creator','race-double','race-rpc') group by o.id) x;")
assert check.strip() == 't', check
print('CONCURRENT_TENANT_BOOTSTRAP_PASS: creator/outsider, duplicate creator, duplicate RPC slug; one correct owner each')
