"""CI package-install bounds, using fake commands only; no package/network/root actions."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "ci" / "install_system_dependencies.sh"


def test_install_is_bounded_complete_and_fails_closed(tmp_path, failure, mirror):
    commands = tmp_path / "commands"
    commands.mkdir()
    log = tmp_path / "calls.jsonl"
    source = tmp_path / "ubuntu.sources"
    original = (
        f"Types: deb\nURIs: {mirror}\nSuites: noble noble-updates noble-backports\n"
        "Components: main restricted universe multiverse\n"
        "Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n\n"
        "Types: deb\nURIs: https://security.ubuntu.com/ubuntu/\nSuites: noble-security\n"
        "Components: main restricted universe multiverse\n"
        "Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n"
    )
    source.write_text(original)
    # One stub models timeout -> sudo -> apt-get. No real installation is run.
    stub = (
        f"#!{sys.executable}\n"
        + """
import json, os, pathlib, subprocess, sys
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
with open(os.environ['CI_FAKE_LOG'], 'a') as f:
    f.write(json.dumps([name, *args]) + '\\n')
if name == 'timeout':
    raise SystemExit(subprocess.call(args[3:]))
if name == 'sudo':
    raise SystemExit(subprocess.call(args))
if name == 'sed':
    assert args[-1] == '/etc/apt/sources.list.d/ubuntu.sources'
    raise SystemExit(subprocess.call([os.environ['CI_REAL_SED'], *args[:-1], os.environ['CI_FAKE_SOURCE']]))
source = next(a.split('=', 1)[1] for a in args if a.startswith('Dir::Etc::sourcelist='))
pathlib.Path(os.environ['CI_CAPTURE_SOURCE']).write_text(pathlib.Path(source).read_text())
failure = os.environ['CI_FAKE_FAILURE']
raise SystemExit(23 if failure and failure in args else 0)
"""
    )
    for name in ["timeout", "sudo", "apt-get", "sed"]:
        target = commands / name
        target.write_text(stub)
        target.chmod(0o700)
    env = {**os.environ, "PATH": f"{commands}{os.pathsep}{os.environ['PATH']}"}
    captured_source = tmp_path / "captured.sources"
    env.update(
        CI_FAKE_LOG=str(log),
        CI_FAKE_FAILURE=failure,
        CI_FAKE_SOURCE=str(source),
        CI_CAPTURE_SOURCE=str(captured_source),
        CI_REAL_SED=shutil.which("sed"),
        GITHUB_ACTIONS="true",
        RUNNER_OS="Linux",
        RUNNER_TEMP=str(tmp_path),
    )
    result = subprocess.run(["bash", str(SCRIPT)], env=env, capture_output=True, text=True, timeout=10)
    calls = [json.loads(line) for line in log.read_text().splitlines()]
    apt = [call[1:] for call in calls if call[0] == "apt-get"]
    bounds = [call[1:4] for call in calls if call[0] == "timeout"]
    assert result.returncode == (23 if failure else 0), result.stderr
    assert source.read_text() == original
    assert captured_source.read_text() == original.replace(mirror, "https://archive.ubuntu.com/ubuntu/")
    assert not list(tmp_path.glob("pitchora-ci-apt.*")), "Temporary source must be cleaned even after failure"
    assert bounds[0] == ["--signal=TERM", "--kill-after=15s", "2m"]
    for call in apt:
        for option in ["Acquire::Retries=2", "Acquire::http::Timeout=30", "Acquire::https::Timeout=30"]:
            assert option in call
        assert "Dir::Etc::sourceparts=-" in call
        assert not any("trusted=" in arg or "AllowInsecure" in arg or "unauthenticated" in arg for arg in call)
    if failure == "update":
        assert len(apt) == 1
        return
    assert bounds[1] == ["--signal=TERM", "--kill-after=15s", "7m"]
    assert len(apt) == 2
    assert apt[0][-1] == "update"
    install = apt[1]
    assert "--no-install-recommends" in install
    for package in ['libreoffice-impress', 'poppler-utils', 'ffmpeg', 'fonts-noto-core', 'libasound2t64', 'libnss3', 'fonts-noto-color-emoji']:
        assert package in install



def test_workflow_preserves_full_backend_gate_and_job_budget():
    source = (ROOT / '.github/workflows/source-delivery.yml').read_text()
    assert 'timeout-minutes: 20' in source
    assert 'runs-on: ubuntu-24.04' in source
    assert 'bash scripts/ci/install_system_dependencies.sh' in source
    assert 'npx playwright install chromium' in source
    assert 'install --with-deps' not in source
    assert 'npx playwright test' in source
    assert 'python3 render_video.py --audio synthetic-test-tone.wav' in source
    assert 'continue-on-error' not in source


def test_helper_refuses_non_ci_execution_before_package_commands():
    env = {**os.environ, "GITHUB_ACTIONS": "false"}
    result = subprocess.run(["bash", str(SCRIPT)], env=env, capture_output=True, text=True, timeout=10)
    assert result.returncode == 2
    assert "restricted to the Linux GitHub Actions job" in result.stderr


if __name__ == '__main__':
    import tempfile
    class HelperTests(unittest.TestCase):
        def test_bounded_install(self):
            for failure in ['', 'update', 'install']:
                for mirror in ['mirror+file:/etc/apt/apt-mirrors.txt', 'http://azure.archive.ubuntu.com/ubuntu/']:
                    with self.subTest(failure=failure, mirror=mirror), tempfile.TemporaryDirectory() as folder:
                        test_install_is_bounded_complete_and_fails_closed(Path(folder), failure, mirror)
        def test_workflow(self):
            test_workflow_preserves_full_backend_gate_and_job_budget()
        def test_non_ci(self):
            test_helper_refuses_non_ci_execution_before_package_commands()
    unittest.main()
