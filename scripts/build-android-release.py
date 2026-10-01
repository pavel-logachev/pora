"""Builds the signed release APK.

    python scripts/build-android-release.py            # all ABIs, signed with the release key
    python scripts/build-android-release.py --abis x86_64   # quicker build for an emulator

The signing key never lives in the repository. It is read from a directory outside it:
`PORA_SIGNING_DIR` (default: `../pora-signing`) must contain `pora-release.jks` and `keystore.properties`
(`storePassword`, `keyAlias`, `keyPassword`). The script regenerates the native project with `expo prebuild`
(the `android/` folder is generated and ignored by git), points the release build at that key, runs Gradle,
verifies the signature with apksigner and writes `Pora-<version>-android.apk` and its `.sha256` to `dist/`.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "android"
DIST = ROOT / "dist"


def run(command: list[str], cwd: Path = ROOT, env: dict[str, str] | None = None) -> None:
    print("+", " ".join(command))
    subprocess.run(command, cwd=cwd, env=env, check=True, shell=os.name == "nt")


def read_properties(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def patch_signing(signing_dir: Path) -> None:
    gradle = ANDROID / "app" / "build.gradle"
    text = gradle.read_text(encoding="utf-8")
    if "poraRelease" in text:
        return
    keystore = (signing_dir / "pora-release.jks").as_posix()
    props = signing_dir / "keystore.properties"
    block = f"""
        poraRelease {{
            def poraProps = new Properties()
            file('{props.as_posix()}').withInputStream {{ poraProps.load(it) }}
            storeFile file('{keystore}')
            storePassword poraProps['storePassword']
            keyAlias poraProps['keyAlias']
            keyPassword poraProps['keyPassword']
        }}
"""
    text = text.replace("    signingConfigs {\n", "    signingConfigs {" + block, 1)
    # Only the release build type switches to the release key; debug keeps the debug keystore.
    release = re.search(r"release \{\s*\n(?:\s*//.*\n)*\s*signingConfig signingConfigs\.debug", text)
    if not release:
        raise SystemExit("Could not find the release signing line in android/app/build.gradle")
    text = text.replace(release.group(0), release.group(0).replace("signingConfigs.debug", "signingConfigs.poraRelease"), 1)
    gradle.write_text(text, encoding="utf-8")


def find_apksigner(sdk: Path) -> Path:
    candidates = sorted((sdk / "build-tools").glob("*/apksigner.bat" if os.name == "nt" else "*/apksigner"))
    if not candidates:
        raise SystemExit("apksigner not found in the Android SDK build-tools")
    return candidates[-1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--abis", default="armeabi-v7a,arm64-v8a,x86,x86_64")
    parser.add_argument("--skip-prebuild", action="store_true")
    args = parser.parse_args()

    signing_dir = Path(os.environ.get("PORA_SIGNING_DIR", ROOT.parent / "pora-signing")).resolve()
    for name in ("pora-release.jks", "keystore.properties"):
        if not (signing_dir / name).is_file():
            raise SystemExit(f"Missing {signing_dir / name}. See the header of this script.")

    sdk = Path(os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT") or Path(os.environ["LOCALAPPDATA"]) / "Android" / "Sdk")
    env = {**os.environ, "ANDROID_HOME": str(sdk)}

    version = json.loads((ROOT / "app.json").read_text(encoding="utf-8"))["expo"]["version"]
    package_version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    if version != package_version:
        raise SystemExit(f"app.json ({version}) and package.json ({package_version}) disagree on the version")

    if not args.skip_prebuild:
        run(["npx", "expo", "prebuild", "--platform", "android", "--clean", "--no-install"], env=env)
    (ANDROID / "local.properties").write_text(f"sdk.dir={str(sdk).replace(chr(92), '/')}\n", encoding="utf-8")
    patch_signing(signing_dir)

    gradlew = str(ANDROID / ("gradlew.bat" if os.name == "nt" else "gradlew"))
    run([gradlew, "assembleRelease", f"-PreactNativeArchitectures={args.abis}", "--console=plain"], cwd=ANDROID, env=env)

    built = ANDROID / "app" / "build" / "outputs" / "apk" / "release" / "app-release.apk"
    DIST.mkdir(exist_ok=True)
    target = DIST / f"Pora-{version}-android.apk"
    shutil.copyfile(built, target)

    apksigner = find_apksigner(sdk)
    run([str(apksigner), "verify", "--verbose", "--print-certs", str(target)], env=env)

    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    (DIST / f"Pora-{version}-android.sha256").write_text(f"{digest} *{target.name}\n", encoding="utf-8")
    print(f"\n{target}  {target.stat().st_size} bytes\nsha256 {digest}")


if __name__ == "__main__":
    sys.exit(main())
