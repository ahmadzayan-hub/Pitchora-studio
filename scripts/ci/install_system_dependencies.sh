#!/usr/bin/env bash
# CI-only prerequisite installation. Do not modify the runner's /etc or package trust.
set -euo pipefail

if [[ "${GITHUB_ACTIONS:-}" != "true" || "${RUNNER_OS:-}" != "Linux" ]]; then
  echo "This prerequisite helper is restricted to the Linux GitHub Actions job." >&2
  exit 2
fi

# GitHub's runner already lists archive.ubuntu.com as its official secondary mirror.
# Azure can transfer continuously but too slowly to trigger connection-timeout failover.
# Select the official HTTPS archive for these commands only, preserving Ubuntu's existing
# suites, components and Signed-By keyring. Never replace sources or import trust keys in /etc.
apt_source="$(mktemp --suffix=.sources "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/pitchora-ci-apt.XXXXXX")"
trap 'rm -f -- "$apt_source"' EXIT
sed \
  -e 's#mirror+file:/etc/apt/apt-mirrors.txt#https://archive.ubuntu.com/ubuntu/#g' \
  -e 's#http://azure\.archive\.ubuntu\.com/ubuntu/#https://archive.ubuntu.com/ubuntu/#g' \
  /etc/apt/sources.list.d/ubuntu.sources > "$apt_source"

# Bound both network retries and total wall time; a slow continuous download can otherwise
# evade APT's per-connection timeout. Fail before the job limit so prerequisite failure remains distinct from test failure.
# Chromium packages match the locked Playwright 1.64.1 Ubuntu 24.04 dependency list.
# Install browser and media prerequisites together, without a second Azure-mirror pass.
apt_options=(-q -o Acquire::Retries=2 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30
  -o "Dir::Etc::sourcelist=$apt_source" -o Dir::Etc::sourceparts=-)
timeout --signal=TERM --kill-after=15s 2m sudo apt-get "${apt_options[@]}" update
timeout --signal=TERM --kill-after=15s 7m sudo apt-get "${apt_options[@]}" install -y --no-install-recommends \
  libreoffice-impress poppler-utils ffmpeg fonts-noto-core \
  libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 \
  libcairo2 libcups2t64 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0t64 \
  libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 \
  libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 xvfb \
  fonts-noto-color-emoji fonts-unifont libfontconfig1 libfreetype6 \
  xfonts-scalable fonts-liberation fonts-ipafont-gothic fonts-wqy-zenhei \
  fonts-tlwg-loma-otf fonts-freefont-ttf
