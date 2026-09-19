# Track changes for users and shared drives Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/about-changes

Retrieved: 2026-09-19T16:30:03.813920+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

For Google Drive apps that need to keep track of changes to items in Drive, the
[Changes collection](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes) provides an efficient way to
detect changes. The collection works by providing the current state of each
item, if and only if the item has changed since a given point in time.

Google Drive keeps a change log for each user and shared drive. Each has
their own record of changes to items that are of interest to them.

To track changes for *all* items visible to a user, both the user change log and the
change logs for all shared drives the user is a member of need to be replayed.

## Enable change entries

A change entry represents the state of the file or shared drive at a given point
in time. A change does not provide a delta between revisions. Applications
that need to know which properties have changed should persist the
previously known state of the item and compare.

Since changes represent the current state of an item, individual change
entries may be invalidated and replaced with a newer change entry for
the corresponding item.

## Tombstones

Change entries for items no longer available to a user are marked as `deleted`
in the change entry. Only the ID of the item is available in the change entry.

**Note:** Because change logs are scoped to a user or shared drive, a deleted item may
still physically exist and be accessible by other users. The change entry does
not distinguish between loss of access and deletion. When a file moves between
corpora it may also appear as a delete even though the user still retains
access to the file. If querying change logs for multiple corpora, use the
`includeCorpusRemovals` query parameter to disambiguate corpus moves from
loss of access.

## Track shared drives

Each shared drive has its own change log. Even though a user may be a member
of a shared drive, certain changes are only reflected in the shared drive change
log and never in the user’s change log. If a file belongs to a shared drive,
even if the file still appeared on the user’s change log at some point in the
past, replaying the user’s change log alone won't correctly update the file's
status. Instead you must replay the shared drive’s change log to capture all
changes.

### What is included in a user's change log

A user’s change log includes changes to shared drives they're a member of as well
as changes to files in the user's corpus. For more information about corpora, see [Changes and revisions overview](https://developers.google.com/workspace/drive/api/guides/change-overview).

These shared drive changes appear on the user’s change log:

* The user becomes a member of a shared drive.
* The user is no longer a member of a shared drive.
* There is a directly relevant change to a shared drive in which the user is a
  member, for example:
  + The user’s access level on that shared drive changed.
  + The shared drive is renamed.

When a user becomes a member of a shared drive, a single change event
for the shared drive appears in the user's change log. This implies
access to all items in the shared drive. The user does not receive changes for
items contained inside the shared drive when they become a member.

Members of a shared drive *may* see change events for items in a shared drive based
on their usage. However, applications should not rely on these events when the
user is a member of the shared drive. Instead, use the shared drive's change log to
track changes.

If a non-member is granted file access to individual items in a shared drive,
changes to those items are tracked in the user's change log. This is the same
as non-shared Drive items that are shared directly with users.

### Changes that appear on a shared drive change log

If a user is a member of a shared drive, they can access that shared drive's change
log which contains:

* Any changes to the shared drive itself, such as addition or removal of a member
* Direct changes to the items contained in the shared drive.

### Syncing permissions and capabilities

Permission changes to shared drive or items inside a shared drive are only
reflected on the item itself. While all direct or indirect children of that
item will inherit this change there will not be a separate entry in the change
log for each of those items. Clients must either
propagate the new capabilities or refetch each item if a parent has
changed in order to fully reconstruct the changes.
