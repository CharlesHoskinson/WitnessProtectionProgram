# Midnight documentation and private-state format evidence

Collected 2026-09-19 with Scrapling 0.4.15 (same version reported by PyPI at collection). Scope: official Compact reference, data types, disclosure, application tutorials, security, proving, network configuration, native export/import and Passport boundaries. **This is a bounded relevant corpus, not all Midnight documentation.**

Read [FINDINGS.md](FINDINGS.md) first. It answers what private witness values look like, what should persist, the exact native export object and inner payload, and how WPP's encrypted metadata/catalog can supply database semantics over Google Drive. **WPP metadata is proposed application design, not a Midnight standard.** No runtime interoperability or restore tests were performed.

## Acquired corpus

- **114 successful Scrapling downloads:** 100 Markdown/MDX documentation sources plus the documentation license; 8 Midnight.js files; 2 bulletin-board files; 3 Passport specification files. One additional Passport license download is recorded separately.
- [official-source-manifest.json](official-source-manifest.json): exact raw GitHub URL, full commit, source path, retrieval UTC time, HTTP status, byte length and SHA-256. Bodies in `official-source/` are exact source bytes; Markdown/MDX is already text, so no HTML conversion is applied. MDX remains untrusted reference data and must not be executed.
- [source-manifest.json](source-manifest.json): 16 locally inspected committed files preserved in `pinned-source/`, independent of the HTTP copy. `git show COMMIT:path` avoided dirty working-tree material. These copies are evidence, not vendored product dependencies.
- [license-addendum.json](license-addendum.json): separately fetched Passport Apache-2.0 license. Each copied repository's license is retained. Source comments retain upstream copyright notices; docs are supplied as source, with no extracted website chrome.
- [collect.py](collect.py): reproducible bounded source acquisition. Requires Python 3, Scrapling and the existing pinned local documentation checkout for the path inventory. Sequential requests with a 350 ms delay; public URLs only; no saved cookies, authentication or browser bypass.

Pins: documentation `7cd3bc1681699b41d5a856f7ab2efd9892c27166`; Midnight.js `98ab4ba7537f0a69b2188ebbe7f40aa2f4d6953f`; bulletin board `38bfac8c574abb0c5a96c9e076779716c3e88231`; Passport SDK `5dff89f62151de5ed91f88ef036c48899186a0e7`. These retrieved source commits do not establish that the corresponding packages have been released. Midnight.js provider source says **5.0.0-beta.8**, whereas the inspected live documentation index labels the API **4.0.4**.

## Website attempt and terms boundary

[robots.txt](robots.txt) permits `/`, but the footer's [Website Terms of Use](https://45047878.fs1.hubspotusercontent-na1.net/hubfs/45047878/Midnight%20Foundation%20-%20Website%20Terms%20of%20Use.pdf) §3(c) prohibits automated extraction; §3(b) recognizes content-specific open-source licenses. When the linked PDF restriction was discovered, the website batch was stopped and collection switched to the official Apache-2.0 GitHub repositories. No access controls were bypassed.

The initial HTML collector recorded **100 HTTP attempts and zero successful article extracts**: its sanitizer called an unsupported `Selector.drop` method. [manifest.json](manifest.json) preserves the errors and response hashes; [selected-urls.json](selected-urls.json) preserves the planned website scope. `website-collection-attempt.py.disabled` is historical evidence and must not be run. We did not retry website extraction. The source corpus above is the successful acquisition, not this failed attempt.

The PDF terms, extracted terms text, site sitemap and llms index are excluded from the redistributable corpus. Their local cache locations and SHA-256 hashes are recorded in [restricted-cache-manifest.json](restricted-cache-manifest.json). The robots record is retained to document the conflicting signals. The open-source acquisition uses exact official source files under their repository Apache-2.0 licenses; this is not a blanket licensing claim over everything displayed on the website.

## Coverage limits and next checks

The source pass selected at most 100 docs from Compact, guides, tutorials, learn and concepts paths; unrelated full ledger/indexer APIs, all release histories, binaries, media, external linked pages and dynamically rendered components were not collected. Pinned native source fills the export/import gap. No npm registry publication audit or Passport execution was done. Research describes source-observed behavior only.

Hash validation of all 114 successful source downloads passed at completion. No real witnesses, application secrets or credentials were acquired. No new cookies were retained. Site-pattern learning: static official raw GitHub source is byte-preserving with `Fetcher.body`; the existing Scrapling raw-source pattern already covers it. The failed selector sanitizer is recorded above rather than written to global skill files outside this task's scope.
