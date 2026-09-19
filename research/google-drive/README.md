# Google Drive and Google authorization source collection

Collected 2026-09-19 with Scrapling 0.4.15, verified against PyPI at collection time. This collection supports WPP's Google Drive first beta and its single-action connection experience. It is documentation research, not a registered OAuth application or a working integration.

Start with the [Sphinx feature documentation](../../docs/google-drive-beta.md) and [source index](SOURCES.md).

## Coverage

The collection has **195 extracted Markdown snapshots representing 192 distinct final Google URLs**, approximately 2 MB total. It includes the linked Drive API guides, v3 REST resources/methods, Picker guides and selected Picker references, OAuth native/web flows, Google Identity Services, branding, consent configuration, verification, user-data policies and release notes. Adjacent v2 migration/shared-drive/label material is retained for context, not as beta scope.

The crawl is bounded to three developer-documentation path families plus explicit seed pages; all discovered in-scope URLs were attempted, with no pending queue. It is not an archive of every Google product, every language translation, SDK source tree, video, or every Picker symbol. See `scope_prefixes` and `seeds` in the manifests for the exact collection boundary. OAuth/Identity pages are selected explicitly, not recursively crawled across all identity products.

- [Main manifest](2026-09-19/manifest.json): 189 attempts, 186 extracted pages, three HTTP 404 responses.
- [Supplement manifest](2026-09-19/supplement/manifest.json): nine successful additional/corrected source captures.
- [Source index](SOURCES.md): titles, official URLs and local snapshots.
- [Collector](tools/collect.py): bounded Scrapling fetch, robots checks, half-second minimum delay, article-only extraction, attribution, timestamps and SHA-256 hashes.

Each manifest records the requested/final URL, retrieval time, HTTP status, raw response hash and extracted-file hash. The response hash identifies fetched bytes; original HTML responses are not archived. Extracted Markdown hashes can be verified locally. Each saved developer page was checked for Google's CC BY 4.0 notice; snapshots carry attribution and separate code/trademark caveats. HTML navigation is removed, relative links are expanded and article markup is converted to Markdown. Consult the original page for rendering-sensitive examples, generated summaries and licenses.

## Exceptions

| Unavailable URL | Resolution |
| --- | --- |
| `/workspace/drive/api/reference/limits` | Correct current page: `/workspace/drive/api/guides/limits`, captured in the supplement and discovered guide crawl. |
| `/workspace/drive/api/release-notes` | Correct current page: `/workspace/drive/release-notes`, captured in the supplement. |
| `/workspace/drive/api/reference/rest/v3/teamdrives` | Linked legacy endpoint returned 404. The current `drives` resource and methods are captured; no beta dependency on the missing legacy page. |

Failures remain in the original manifest rather than being erased. The collector's current seeds use the corrected limits/release-note URLs, so a fresh run need not reproduce those initial failed guesses.

Google Cloud's [Manage App Audience](https://support.google.com/cloud/answer/15549945?hl=en) was also fetched with Scrapling to verify Testing-mode limits. Its text and hash are retained locally at `/home/charl/wpp-research-2026-09-19/google-support/`; the complete help-center text is not republished under the developer-site license. Relevant requirements are paraphrased and cited in the feature docs.

## Reproduce

Use a separate Python environment with `scrapling[fetchers]==0.4.15` and `markdownify` installed. These are research tools, not application dependencies. No browser engine or credentials were needed.

From the repository root, choose a new output directory to preserve this dated snapshot:

```sh
python3 research/google-drive/tools/collect.py /tmp/wpp-google-drive-refresh
python3 research/google-drive/tools/collect.py /tmp/wpp-google-drive-supplement research/google-drive/supplement-seeds.json
```

The collector exits nonzero when URLs fail or its page limit leaves a pending queue. Review the manifest, distinguish obsolete links from missing critical evidence, and update the coverage report. Do not treat an HTTP 200 or a completed process as an integration test.

## Findings to retain

- New backups can create a visible app-owned folder after narrow `drive.file` authorization; users need no developer setup.
- The current native Picker flow supports a browser authorization/file-selection round trip, but requires `drive.file` alone. Do not combine identity scopes in that request.
- Google identity sign-in is not Drive authorization. The desktop/native and web GIS paths have different token/callback requirements.
- OAuth Testing limits the cohort and expires Drive grants after seven days; product beta status and OAuth publishing status are separate.
- Quotas changed for new projects from May 1, 2026; verify actual project settings.
- Cross-client file visibility, folder selection, fresh-device recovery and real callback behavior remain tests to perform.

Sources and detailed qualifications appear in the [feature pages](../../docs/google-drive-beta.md). Working decisions and open questions live in the dedicated claude-obsidian vault selected by the repository's `.claude-obsidian.json`.
