"""Diagnose Earth Engine access without printing any credential value.

Run with the interpreter that has earthengine-api installed:

    python scripts/diagnose_access.py
    python scripts/diagnose_access.py --project my-gcp-project-id

Checks, in order: local credential presence, token refresh, project binding,
initialisation, and one cheap real data request.
"""

from __future__ import annotations

import argparse
import os
import sys

CREDENTIAL_PATH = os.path.expanduser(os.path.join("~", ".config", "earthengine", "credentials"))


def check_credential_file() -> bool:
    if not os.path.exists(CREDENTIAL_PATH):
        print("[1] credential file: MISSING - run `earthengine authenticate`")
        return False
    import json

    try:
        with open(CREDENTIAL_PATH) as handle:
            payload = json.load(handle)
    except (OSError, ValueError) as exc:
        print(f"[1] credential file: unreadable ({type(exc).__name__})")
        return False
    keys = sorted(payload)
    has_token = bool(payload.get("refresh_token") or payload.get("account"))
    print(f"[1] credential file: present at {CREDENTIAL_PATH}")
    print(f"    field names only: {keys}")
    print(f"    non-empty token material: {has_token}")
    print(f"    scopes: {payload.get('scopes')}")
    return has_token


def check_token_refresh() -> bool:
    try:
        from google.oauth2.credentials import Credentials
        import json

        with open(CREDENTIAL_PATH) as handle:
            payload = json.load(handle)
        credentials = Credentials(
            token=None,
            refresh_token=payload.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=ee_client_id(),
            client_secret=ee_client_secret(),
            scopes=payload.get("scopes"),
        )
        from google.auth.transport.requests import Request

        credentials.refresh(Request())
        print("[2] oauth token refresh: SUCCEEDED (access token obtained, not printed)")
        return bool(credentials.token)
    except Exception as exc:  # noqa: BLE001 - diagnostic must report any failure cause
        print(f"[2] oauth token refresh: FAILED - {type(exc).__name__}: {exc}")
        return False


def ee_client_id():
    import ee

    return ee.oauth.CLIENT_ID


def ee_client_secret():
    import ee

    return ee.oauth.CLIENT_SECRET


def check_project_binding() -> str | None:
    """Return the configured project id, or None when the account has none."""
    import ee

    for name in ("EE_PROJECT_ID", "GOOGLE_CLOUD_PROJECT", "GCP_PROJECT"):
        value = os.environ.get(name)
        if value:
            print(f"[3] project id from environment variable {name}: {value}")
            return value

    project = _registered_earth_engine_projects()
    if project:
        return project
    try:
        ee.Reset()
        ee.Initialize()
    except Exception:  # noqa: BLE001 - the raw listing above already carries the diagnosis
        pass
    else:
        return getattr(ee.data, "project_name", None)
    return None


def _registered_earth_engine_projects() -> str | None:
    """Ask the Earth Engine API which projects this account has registered."""
    import ee
    import json
    from google.auth.transport.requests import AuthorizedSession, Request
    from google.oauth2.credentials import Credentials

    with open(CREDENTIAL_PATH) as handle:
        payload = json.load(handle)
    credentials = Credentials(
        token=None,
        refresh_token=payload.get("refresh_token"),
        token_uri=ee.oauth.TOKEN_URI,
        client_id=ee.oauth.CLIENT_ID,
        client_secret=ee.oauth.CLIENT_SECRET,
        scopes=payload.get("scopes"),
    )
    credentials.refresh(Request())
    session = AuthorizedSession(credentials)
    response = session.get("https://earthengine.googleapis.com/v2/projects", timeout=30)
    if response.status_code != 200:
        print(f"[3] Earth Engine project listing: HTTP {response.status_code} - {_summarise(response.text)}")
        return None
    projects = response.json().get("userProjects", [])
    eligible = [p.get("name", "").split("/")[-1] for p in projects if p.get("name")]
    if not eligible:
        print("[3] Earth Engine project listing: HTTP 200, 0 registered projects for this account")
        return None
    print(f"[3] Earth Engine registered projects: {eligible}")
    return eligible[0]


def _summarise(body: str) -> str:
    """First 200 chars of an error body, with anything token-shaped removed."""
    import re

    cleaned = re.sub(r"[A-Za-z0-9_\-]{25,}", "<redacted>", body or "")
    return " ".join(cleaned.split())[:200]


def check_initialize(project: str | None) -> bool:
    import ee

    try:
        if project:
            ee.Initialize(project=project)
        else:
            ee.Initialize()
    except Exception as exc:  # noqa: BLE001
        print(f"[4] ee.Initialize: FAILED - {type(exc).__name__}: {exc}")
        return False
    print(f"[4] ee.Initialize: SUCCEEDED (project={getattr(ee.data, 'project_name', project)})")
    return True


def check_data_request() -> bool:
    import ee
    from forestguard import config

    geom = ee.Geometry.Polygon(config.ACCESS_PROBE["aoi"])
    start, end = config.ACCESS_PROBE["date_range"]
    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(geom)
        .filterDate(start, end)
    )
    try:
        count = collection.size().getInfo()
    except Exception as exc:  # noqa: BLE001
        print(f"[5] real Sentinel-2 request: FAILED - {type(exc).__name__}: {exc}")
        return False
    print(f"[5] real Sentinel-2 request: SUCCEEDED")
    print(f"    collection=COPERNICUS/S2_SR_HARMONIZED window={start}..{end}")
    print(f"    aoi={config.HELD_OUT['name']} scene_count={count}")
    return count > 0


ACTIVATION_GUIDANCE = """Earth Engine needs a registered Cloud project before any data request works.

1. Open https://code.earthengine.google.com/ and sign in with the account you
   authorized. If it asks to register / sign up for Earth Engine, accept.
2. Open https://console.cloud.google.com/ and select or create a project.
3. Copy the Project ID from the header (a lowercase slug, not the display name).
4. Enable Earth Engine API: https://console.cloud.google.com/apis/library/earthengine.googleapis.com
5. Pass the id to this script: python scripts/diagnose_access.py --project <PROJECT_ID>

The project id is not a secret and is safe to paste into chat. Never paste a
private key, OAuth token, password or API key.
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", help="Google Cloud project id bound to Earth Engine")
    args = parser.parse_args()

    import ee

    ee.Reset()
    credential_ok = check_credential_file()
    if not credential_ok:
        return 2
    token_ok = check_token_refresh()
    if not token_ok:
        return 2

    project = args.project or check_project_binding()
    if not project:
        print("[4] ee.Initialize: SKIPPED - no project id available")
        print(ACTIVATION_GUIDANCE)
        return 3
    if not check_initialize(project):
        print(ACTIVATION_GUIDANCE)
        return 3
    if not check_data_request():
        return 4
    print("\nPHASE 1 EXIT CRITERION MET: initialization and a real data request both succeeded.")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    raise SystemExit(main())
