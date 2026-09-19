# Identify which change log to track Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/about-changelogs

Retrieved: 2026-09-19T16:30:02.922961+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

The user and shared drive change logs are defined in the [Changes and revisions overview](https://developers.google.com/workspace/drive/api/guides/change-overview). This guide provides more information about individual change log entries and tips for when to track changes in either the user change log or the shared drive change log.

## Change entry after file moves to a shared drive

After a file is moved to a shared drive, that shared drive change log continues logging changes for that file, not the user change log. You should then query the shared drive change log to detect new changes to that item.

## Change entry for individual items in a shared drive

If a non-member is granted file access to individual items in a shared drive,
changes to those items are tracked in the user change log, not the shared drive change log. This behavior is the same as non-shared drive items that are shared directly with users.

## Change entry for lost access permission

If a user loses access permission to a file, the change log entry will say `deleted`.
However, the file is still available to other users who still have permission to access the file. If the item is deleted for all users, it will get marked `deleted` in all user change logs.

When a file moves between user corpora it may also appear `deleted` even though the user still retains access to the file. If you query change logs for multiple corpora, use the `includeCorpusRemovals` parameter in [Changes.list](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/list) to disambiguate corpus moves from loss of access.
For definitions of different corpora, see [Files and folders overview](https://developers.google.com/workspace/drive/api/guides/about-files).
