#!/usr/bin/env python3
"""Collect a bounded public Google documentation corpus with Scrapling.

Usage: python3 collect.py OUTPUT_DIRECTORY [SEED_URLS_JSON]
An explicit seed file disables link discovery, for supplementary collections.
Requires scrapling[fetchers]==0.4.15 and markdownify. No credentials required.
"""
import hashlib
import json
import sys
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

import scrapling
from markdownify import markdownify
from scrapling.fetchers import Fetcher

HOST = "https://developers.google.com"
PREFIXES = (
    "/workspace/drive/api/guides/",
    "/workspace/drive/api/reference/rest/v3/",
    "/workspace/drive/picker/guides/",
)
SEEDS = [
    "/workspace/drive/api/guides/about-sdk",
    "/workspace/drive/api/reference/rest/v3/files",
    "/workspace/drive/api/guides/limits",
    "/workspace/drive/release-notes",
    "/workspace/drive/picker/guides/overview",
    "/workspace/drive/picker/guides/desktop-mobile-picker",
    "/workspace/drive/picker/guides/web-picker",
    "/workspace/drive/picker/reference/picker",
    "/workspace/drive/picker/reference/picker.pickerbuilder",
    "/workspace/drive/picker/reference/picker.docsview",
    "/workspace/guides/create-project",
    "/workspace/guides/enable-apis",
    "/workspace/guides/configure-oauth-consent",
    "/workspace/guides/create-credentials",
    "/workspace/guides/auth-overview",
    "/workspace/drive/api/quickstart/js",
    "/workspace/drive/api/quickstart/nodejs",
    "/identity/protocols/oauth2",
    "/identity/protocols/oauth2/native-app",
    "/identity/protocols/oauth2/web-server",
    "/identity/protocols/oauth2/javascript-implicit-flow",
    "/identity/protocols/oauth2/policies",
    "/identity/protocols/oauth2/production-readiness/policy-compliance",
    "/identity/protocols/oauth2/production-readiness/brand-verification",
    "/identity/protocols/oauth2/production-readiness/sensitive-scope-verification",
    "/identity/protocols/oauth2/production-readiness/restricted-scope-verification",
    "/identity/protocols/oauth2/resources/best-practices",
    "/identity/openid-connect/openid-connect",
    "/identity/branding-guidelines",
    "/identity/gsi/web/guides/overview",
    "/identity/gsi/web/guides/display-button",
    "/identity/gsi/web/guides/verify-google-id-token",
    "/identity/gsi/web/guides/migration",
    "/identity/gsi/web/guides/fedcm-migration",
    "/identity/oauth2/web/guides/overview",
    "/identity/oauth2/web/guides/choose-authorization-model",
    "/identity/oauth2/web/guides/use-code-model",
    "/identity/oauth2/web/guides/use-token-model",
    "/identity/oauth2/web/guides/error",
    "/identity/oauth2/web/reference/js-reference",
    "/terms/site-policies",
    "/terms/api-services-user-data-policy",
    "/terms",
]


def canonical(url):
    p = urlsplit(urljoin(HOST, url))
    if p.scheme != "https" or p.netloc != "developers.google.com":
        return None
    return urlunsplit((p.scheme, p.netloc, p.path.rstrip("/"), "", ""))


def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    pages = out / "pages"
    pages.mkdir(exist_ok=True)
    robots_response = Fetcher.get(HOST + "/robots.txt", timeout=30)
    if robots_response.status != 200:
        raise SystemExit("Cannot check robots.txt")
    robots_text = robots_response.body.decode()
    (out / "robots.txt").write_text(robots_text)
    robots = RobotFileParser()
    robots.parse(robots_text.splitlines())
    explicit_seeds = json.loads(Path(sys.argv[2]).read_text()) if len(sys.argv) > 2 else None
    prefixes = () if explicit_seeds is not None else PREFIXES
    seeds = [canonical(x) for x in (explicit_seeds if explicit_seeds is not None else SEEDS)]
    if not all(seeds):
        raise SystemExit("Seed URL outside developers.google.com allowlist")
    queue, queued, records = deque(seeds), set(seeds), []
    limit = 400
    while queue and len(records) < limit:
        url = queue.popleft()
        row = {"requested_url": url, "retrieved_at": datetime.now(timezone.utc).isoformat()}
        try:
            if not robots.can_fetch("*", url):
                raise ValueError("robots_disallowed")
            time.sleep(max(0.5, robots.crawl_delay("*") or 0))
            response = Fetcher.get(url, timeout=40, retries=1)
            row.update(status=response.status, final_url=str(response.url),
                       response_sha256=hashlib.sha256(response.body).hexdigest())
            if response.status != 200:
                raise ValueError("http_status_" + str(response.status))
            if canonical(str(response.url)) is None:
                raise ValueError("redirect_outside_allowlist")
            body = response.css(".devsite-article-body")
            if not body:
                raise ValueError("missing_article_body")
            # Restrict to the article; omit scripts, hidden widgets, navigation.
            fragment = body[0].html_content
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(fragment, "html.parser")
            for element in soup.select("script, style, nav, devsite-feedback, [hidden], [aria-hidden='true']"):
                element.decompose()
            for anchor in soup.select("a[href]"):
                anchor["href"] = urljoin(str(response.url), anchor["href"])
            content = markdownify(str(soup), heading_style="ATX")
            if len(content.strip()) < 150:
                raise ValueError("empty_or_short_article")
            title = response.css("h1")[0].get_all_text(separator=" ", strip=True)
            filename = urlsplit(url).path.strip("/").replace("/", "__") + ".md"
            attribution = (
                "Portions of this page are modifications based on work created and shared by "
                "Google and used according to terms described in the "
                "[Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). "
                "Code samples are subject to the original page's Apache 2.0 notice where stated. "
                "Trademarks and separately licensed material remain excluded. "
                "Extraction removes site navigation and converts article HTML to Markdown."
            )
            text = f"# {title}\n\nSource: {response.url}\n\nRetrieved: {row['retrieved_at']}\n\n{attribution}\n\n---\n\n{content}\n"
            (pages / filename).write_text(text)
            row.update(title=title, file="pages/" + filename,
                       extracted_sha256=hashlib.sha256(text.encode()).hexdigest(),
                       extracted_bytes=len(text.encode()),
                       cc_by_notice="creativecommons.org/licenses/by/4.0" in response.body.decode(errors="replace"))
            # Discover every linked Drive guide, v3 REST resource/method, and Picker guide.
            # Identity and other Workspace docs are explicitly seeded to prevent an unbounded crawl.
            for href in response.css("a::attr(href)").getall():
                found = canonical(urljoin(str(response.url), href))
                if found and urlsplit(found).path.startswith(prefixes) and found not in queued:
                    queued.add(found)
                    queue.append(found)
        except Exception as exc:
            row["error"] = str(exc)
        records.append(row)
        manifest = {"scrapling_version": scrapling.__version__, "scope_prefixes": prefixes,
                    "seeds": seeds, "page_limit": limit, "pending_urls": list(queue), "pages": records}
        (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"{len(records)} status={row.get('status')} {'ERROR ' + row['error'] if 'error' in row else row['title']} pending={len(queue)}", flush=True)
    failures = [r for r in records if "error" in r]
    print(json.dumps({"collected":len(records)-len(failures), "failures":failures, "pending":len(queue)}, indent=2))
    return 1 if failures or queue else 0


if __name__ == "__main__":
    raise SystemExit(main())
