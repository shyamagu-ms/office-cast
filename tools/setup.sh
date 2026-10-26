#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

if [ "$#" -gt 1 ]; then
    printf '%s\n' 'Usage: sh tools/setup.sh [python-executable]' >&2
    exit 2
fi
if [ -e .venv ]; then
    if [ ! -x .venv/bin/python ]; then
        printf '%s\n' 'The existing .venv is incomplete or belongs to another OS. Back it up outside the repository before creating a new one.' >&2
        exit 1
    fi
    .venv/bin/python tools/check_environment.py
else
    python=${1:-python3.14}
    "$python" tools/check_environment.py
    "$python" -m venv .venv
fi
.venv/bin/python -m pip install --disable-pip-version-check -r requirements.txt
npm ci --no-audit --no-fund
.venv/bin/python -c "import imageio_ffmpeg, subprocess; print(subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-version'], check=True, capture_output=True, text=True).stdout.splitlines()[0])"
printf '%s\n' 'Office Cast is ready. Configure settings.local.json, then use .venv/bin/python tools/pipeline.py.'
