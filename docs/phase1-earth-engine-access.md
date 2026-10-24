# Phase 1 - Earth Engine access: diagnosis

Exit criterion: Earth Engine initialization **and** one real data request both
succeed. Not met. This file records exactly how far it got, so the next attempt
starts from evidence rather than from a guess.

## Commands run and actual output

`python scripts/diagnose_access.py` (2026-10-24, Earth Engine API 1.7.49,
Python 3.11.9):

```
[1] credential file: present at ~/.config/earthengine/credentials
    field names only: ['redirect_uri', 'refresh_token', 'scopes']
    non-empty token material: True
    scopes: earthengine, cloud-platform, drive, devstorage.full_control
[2] oauth token refresh: SUCCEEDED (access token obtained, not printed)
[3] Earth Engine project listing: HTTP 404
[4] ee.Initialize: SKIPPED - no project id available
exit code 3
```

The script never prints a token, and the credential file is read for field names
only.

## What the evidence says

The authorization half works. The OAuth refresh token exchanges for an access
token with the Earth Engine scopes, so the account and the stored credential are
valid and the earlier "please authorize" state is gone.

The binding half does not exist. `ee.Initialize()` without a project resolves to
the path the library reports as `projects/earthengine-legacy` and raises:

```
EEException: ee.Initialize: no project found. Call with project= or see
http://goo.gle/ee-auth.
```

Direct probes against the Earth Engine API with a freshly refreshed token return
HTTP 404 for `v2/user-projects`, `v2/project-projects`, `v2/projects:search` and
`v1/projects` - Google's generic 404 page, which is what the endpoint returns when
the API is not enabled on anything the token can bill against.

Cause, stated precisely: **Earth Engine has never been activated for this Google
account, and no Google Cloud project has the Earth Engine API enabled.** It is not
a code defect, not a bad project id, and not a credential defect. There is also no
`gcloud` or `earthengine` CLI on PATH, and no project id in any environment
variable, so nothing local can supply one. No project id was guessed.

## What unblocks it

1. Open https://code.earthengine.google.com/ with the same Google account and
   complete the Earth Engine sign-up / activation if it is offered.
2. In https://console.cloud.google.com/ select or create a project and note the
   **Project ID** (the lowercase slug in the header, not the display name).
3. Enable the Earth Engine API on that project:
   https://console.cloud.google.com/apis/library/earthengine.googleapis.com
4. Send the project id, then run
   `python scripts/diagnose_access.py --project <PROJECT_ID>`.

A project id is not a secret. A private key, OAuth token, password or API key must
never be pasted into chat - an API key does not authorize Earth Engine in any case.

## Where the project id will live

`--project` on the command line, or the `EE_PROJECT_ID` environment variable, both
read by `scripts/diagnose_access.py`. It will not be committed to this repository
and it will never appear in frontend code.

## What is already proven without it

The pipeline's decision logic runs offline: 79 unit tests pass with no Earth Engine
package installed at all. No satellite scene has been fetched, and no number in
this repository is presented as a measurement.
