import json
import subprocess
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import check_environment


class EnvironmentTests(unittest.TestCase):
    def test_supported_python_patch_releases(self):
        for version in [(3, 14, 8), (3, 14, 9), (3, 14, 20)]:
            check_environment.check_python(version)

    def test_old_other_and_prerelease_python_are_rejected(self):
        for version in [(3, 13, 16), (3, 14, 7), (3, 15, 0)]:
            with self.subTest(version=version), self.assertRaisesRegex(ValueError, "Python 3.14.8"):
                check_environment.check_python(version)
        for releaselevel in ["alpha", "beta", "candidate"]:
            with self.subTest(releaselevel=releaselevel), self.assertRaises(ValueError):
                check_environment.check_python((3, 14, 8), releaselevel)

    def test_node_requirement_comes_from_package(self):
        package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        requirement = package["engines"]["node"]
        self.assertEqual(requirement, "^24.21.0")
        for version in ["v24.21.0", "24.22.0", "v24.21.1\n"]:
            check_environment.check_node(version, requirement)
        for version in ["v22.23.3", "v24.20.0", "v25.0.0", "v26.11.1", "v24.21.0-rc.1", "invalid"]:
            with self.subTest(version=version), self.assertRaises(ValueError):
                check_environment.check_node(version, requirement)

    def test_invalid_node_requirement_is_not_silently_accepted(self):
        for requirement in ["latest", ">=20", "^24.21.0-alpha.1"]:
            with self.subTest(requirement=requirement), self.assertRaisesRegex(ValueError, "engines.node"):
                check_environment.check_node("v24.21.0", requirement)

    def test_missing_node_has_an_actionable_error(self):
        with patch.object(check_environment, "check_python"), patch.object(
            check_environment.subprocess, "run", side_effect=FileNotFoundError("node")
        ):
            with self.assertRaisesRegex(RuntimeError, "Node.js is missing"):
                check_environment.main()

    def test_failed_node_command_is_not_hidden(self):
        with patch.object(check_environment, "check_python"), patch.object(
            check_environment.subprocess, "run", side_effect=subprocess.CalledProcessError(1, ["node", "--version"])
        ):
            with self.assertRaises(subprocess.CalledProcessError):
                check_environment.main()

    def test_old_python_is_rejected_before_querying_node(self):
        with patch.object(check_environment, "check_python", side_effect=ValueError("old Python")), patch.object(
            check_environment.subprocess, "run"
        ) as run:
            with self.assertRaisesRegex(ValueError, "old Python"):
                check_environment.main()
            run.assert_not_called()

    def test_supported_environment_reports_versions(self):
        with patch.object(check_environment, "check_python"), patch.object(
            check_environment.subprocess, "run", return_value=SimpleNamespace(stdout="v24.21.0\n")
        ), patch("builtins.print") as output:
            check_environment.main()
            self.assertIn("Node.js v24.21.0", output.call_args.args[0])


if __name__ == "__main__":
    unittest.main()
