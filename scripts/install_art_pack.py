#!/usr/bin/env python3
"""Install the optional high-detail NOVA7-graphics-pack.zip into the repo.

The game itself requires no Python. This helper uses only the standard library.
Optional --commit creates ONE distinct Git commit with the WebP art files.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent
ART_ROOT = ROOT / "assets" / "generated"


def install(archive: Path, commit: bool = False) -> None:
    if not archive.is_file():
        raise SystemExit(f"Archive not found: {archive}")
    with ZipFile(archive) as bundle:
        paths = [Path(info.filename) for info in bundle.infolist() if not info.is_dir()]
        if not paths or any(path.is_absolute() or ".." in path.parts for path in paths):
            raise SystemExit("Refusing an invalid or unsafe asset archive.")
        expected = Path("assets/generated/manifest.json")
        if expected not in paths:
            raise SystemExit("Not a NOVA7 graphics pack: missing manifest.json")
        if any(path.parts[:2] != ("assets", "generated") and path.name != "README.txt" for path in paths):
            raise SystemExit("Archive contains unrelated paths.")
        manifest = json.loads(bundle.read(expected))
        if manifest.get("version") != 1:
            raise SystemExit("Unsupported graphics manifest.")
        refs = list(manifest.get("biomes", {}).values())
        for kind in ("towers", "traps", "units", "enemies"):
            refs += list(manifest.get(kind, {}).values())
        refs += [manifest.get("hero", "")]
        for ref in refs:
            if Path(ref) not in paths:
                raise SystemExit(f"Missing texture referenced by manifest: {ref}")
        for name in paths:
            if name.parts[:2] != ("assets", "generated"):
                continue
            destination = ROOT.joinpath(*name.parts)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(bundle.read(str(name)))
    print(f"Installed {len(refs)} image textures into {ART_ROOT}")
    print("Run 'npm start' to use the high-detail sprites.")
    if commit:
        try:
            subprocess.run(["git", "add", "--", "assets/generated"], cwd=ROOT, check=True)
            subprocess.run(
                ["git", "commit", "-m", "assets(art): add high-detail Nova-7 WebP graphics"],
                cwd=ROOT, check=True,
            )
            print("Committed installed art as a separate Git commit.")
        except (OSError, subprocess.CalledProcessError) as exc:
            raise SystemExit(f"Art installed, but Git commit could not be created: {exc}") from exc


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="Path to NOVA7-graphics-pack.zip")
    parser.add_argument("--commit", action="store_true", help="Create a separate Git commit for images")
    args = parser.parse_args()
    install(args.archive, args.commit)
