#!/usr/bin/env python3
"""Isolated PostgreSQL RLS regression. No network, credentials or hosted database.
Usage: python3 scripts/test-tenant-rls.py --pg-bin /path/to/postgresql/bin
Use --full-chain to also expose unrelated historical migration conflicts.
"""
import argparse
import os
import re
import subprocess
import tempfile
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--pg-bin", required=True, type=Path)
parser.add_argument("--full-chain", action="store_true")
parser.add_argument("--concurrent", action="store_true", help="Start a private disposable local PostgreSQL server (CI only here)")
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
migrations = sorted((root / "supabase/migrations").glob("*.sql"))
repair = next(p for p in migrations if p.name.endswith("_creator_bound_tenant_bootstrap.sql"))
shared = [p for p in migrations if p.name in ("0001_init.sql", "0002_feedback.sql") or "tenant_enrollment" in p.name or "membership_insert_policy" in p.name]
# A normal postmaster reserves normal object OIDs at startup. Stand-alone mode
# does not: objects below 16384 are treated as built-in and exempted from RLS.
# Reserve those OIDs with disposable sequences, then assert row_security_active
# in the actual tests. No schema/policy is disabled or altered by this fixture.
reserve = """do $$ declare n oid; begin loop
 create sequence public.test_oid_reservation;
 select oid into n from pg_class where relname='test_oid_reservation';
 drop sequence public.test_oid_reservation;
 exit when n >= 16384; end loop; end $$;"""


def run(label, files, expected_failure=None):
    with tempfile.TemporaryDirectory(prefix="tenant-rls-") as tmp:
        data = Path(tmp) / "data"
        subprocess.run([str(args.pg_bin / "initdb"), "-D", str(data), "--no-locale", "--encoding=UTF8", "--auth=trust"], check=True, capture_output=True)
        sql = reserve + "\n" + "\n".join(line for p in files for line in p.read_text().splitlines() if line.strip()) + "\n\n"
        proc = subprocess.run([str(args.pg_bin / "postgres"), "--single", "-D", str(data), "-j", "postgres"], input=sql, text=True, capture_output=True)
        output = proc.stdout + proc.stderr
        errors = re.findall(r".*(?:ERROR|FATAL):.*", output)
        # Stand-alone postgres can exit zero after SQL errors: inspect both.
        if expected_failure:
            ok = proc.returncode == 0 and len(errors) == 1 and expected_failure in errors[0]
        else:
            ok = proc.returncode == 0 and not errors and 'result = "TENANT_REGRESSION_PASS"' in output
        print(label + (": PASS" if ok else ": FAIL"))
        if not ok:
            print(output)
            raise SystemExit(1)

stub = root / "supabase/tests/stub.sql"
test = root / "supabase/tests/creator_bound_enrollment.sql"
run("merged-baseline reproduces orphan takeover", [stub, *shared, test], "EXPECTED RLS DENIAL: insert into public.memberships")
run("creator-bound tenant regression", [stub, *shared, repair, test])
if args.full_chain:
    run("complete migration chain", [stub, *migrations, test])
if args.concurrent:
    with tempfile.TemporaryDirectory(prefix="tenant-race-") as tmp:
        data = Path(tmp) / "data"
        subprocess.run([str(args.pg_bin / "initdb"), "-D", str(data), "--no-locale", "--encoding=UTF8", "--auth=trust"], check=True, capture_output=True)
        # Private 0700 temp directory, Unix socket only; never a network listener.
        subprocess.run([str(args.pg_bin / "pg_ctl"), "-D", str(data), "-l", str(Path(tmp) / "server.log"), "-o", f"-k {tmp} -h ''", "start"], check=True, capture_output=True)
        env = dict(os.environ, PGHOST=tmp, PGDATABASE="tenant_test_race", TEST_DATABASE_IS_DISPOSABLE="1")
        env["PATH"] = str(args.pg_bin) + os.pathsep + env.get("PATH", "")
        try:
            subprocess.run([str(args.pg_bin / "createdb"), "tenant_test_race"], env=env, check=True, capture_output=True)
            for path in [stub, *shared, repair]:
                subprocess.run([str(args.pg_bin / "psql"), "-X", "-v", "ON_ERROR_STOP=1", "-f", str(path)], env=env, check=True, capture_output=True)
            subprocess.run(["python3", str(root / "scripts/test-tenant-concurrency.py")], env=env, check=True)
        finally:
            subprocess.run([str(args.pg_bin / "pg_ctl"), "-D", str(data), "stop", "-m", "fast"], check=True, capture_output=True)
    print("Concurrent bootstrap checked on disposable local server.")
else:
    print("Concurrent sessions NOT tested (use --concurrent where local server creation is allowed).")
print("Real PostgreSQL RLS checked; hosted identity NOT tested.")
