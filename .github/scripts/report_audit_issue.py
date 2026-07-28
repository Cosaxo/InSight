#!/usr/bin/env python3
"""Open (or update) the tracking issue for the weekly dependency audit.

A script rather than an inline `run:` block because quoting a JSON payload
through YAML through bash through python is where this kind of step
silently breaks — and rather than a third-party action so the workflow
whose whole purpose is supply-chain hygiene adds no SHA of its own to pin.

Reads GH_TOKEN, REPO and SHA from the environment (set by the workflow)
and audit-report.md from the working directory.
"""
import json
import os
import sys
import urllib.error
import urllib.request

API = "https://api.github.com"
TITLE = "Dependency audit: high-severity advisories"
LABEL = "security"

token = os.environ["GH_TOKEN"]
repo = os.environ["REPO"]
sha = os.environ.get("SHA", "")[:7]

with open("audit-report.md", encoding="utf-8") as fh:
    body = fh.read()


def call(method, path, payload=None):
    req = urllib.request.Request(
        f"{API}{path}",
        method=method,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "insight-security-audit",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read() or "null")


try:
    # Reuse the standing issue rather than filing a fresh one every week —
    # a pile of identical issues is how a real one gets ignored.
    issues = call("GET", f"/repos/{repo}/issues?state=open&labels={LABEL}&per_page=100") or []
    existing = next((i for i in issues if i.get("title") == TITLE), None)

    if existing:
        call(
            "POST",
            f"/repos/{repo}/issues/{existing['number']}/comments",
            {"body": f"Still failing as of {sha}.\n\n{body}"},
        )
        print(f"commented on issue #{existing['number']}")
    else:
        created = call(
            "POST",
            f"/repos/{repo}/issues",
            {"title": TITLE, "labels": [LABEL], "body": body},
        )
        print(f"opened issue #{created['number']}")
except urllib.error.HTTPError as err:
    # Never mask the audit result: the workflow's final step fails the run
    # regardless, and losing that to a bookkeeping error would be worse
    # than having no issue filed.
    print(f"::warning::could not file the audit issue ({err.code}): {err.reason}", file=sys.stderr)
