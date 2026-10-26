"""Check the supported production runtimes before installing dependencies."""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIN_PYTHON = (3, 14, 8)


def check_python(version, releaselevel="final"):
    if version[:2] != MIN_PYTHON[:2] or version < MIN_PYTHON or releaselevel != "final":
        actual = ".".join(map(str, version))
        raise ValueError(
            f"Python 3.14.8 or later in the stable 3.14 series is required; found {actual} ({releaselevel}). "
            "Select Python 3.14 explicitly. Back up an incompatible .venv outside the repository "
            "before creating a new one; setup never replaces it automatically."
        )


def check_node(version, requirement):
    minimum = re.fullmatch(r"\^(\d+)\.(\d+)\.(\d+)", requirement)
    if not minimum:
        raise ValueError("package.json engines.node must specify a stable caret version")
    minimum = tuple(map(int, minimum.groups()))
    actual = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", version.strip())
    if not actual:
        raise ValueError(f"Expected a stable Node.js version; found {version.strip()!r}")
    actual = tuple(map(int, actual.groups()))
    if actual[0] != minimum[0] or actual < minimum:
        raise ValueError(f"Node.js {requirement} is required; found {version.strip()}. Check your PATH.")


def main():
    check_python(sys.version_info[:3], sys.version_info.releaselevel)
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    try:
        node = subprocess.run(["node", "--version"], check=True, capture_output=True, text=True).stdout.strip()
    except FileNotFoundError as error:
        raise RuntimeError("Node.js is missing. Install the supported Node.js LTS release and check your PATH.") from error
    check_node(node, package["engines"]["node"])
    print(f"Supported environment: Python {sys.version.split()[0]}, Node.js {node}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Environment check failed: {error}", file=sys.stderr)
        sys.exit(1)
