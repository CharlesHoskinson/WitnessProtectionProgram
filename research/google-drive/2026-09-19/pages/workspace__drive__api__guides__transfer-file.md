# Transfer file ownership Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/transfer-file

Retrieved: 2026-09-19T16:29:52.446367+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

You own the files that you create or upload on Google Drive. You can transfer
ownership of these files to another account.

## Transfer file ownership to another Google Workspace account in the same organization

Ownership of files existing in "My Drive" can be transferred from
one [Google Workspace
account](https://cloud.google.com/architecture/identity/overview-google-authentication#cloud_identity_or_g_suite_account)
to another account in the same organization. An organization that owns a shared
drive owns the files within it. Therefore, ownership transfers are not supported
for files and folders in shared drives. Organizers of a shared drive can move
items from that shared drive and into their own "My Drive" which
transfers the ownership to them.

To transfer ownership of a file in "My Drive", do one of the
following:

* [Create](https://developers.google.com/workspace/drive/api/guides/manage-sharing#create-permission) a file permission
  granting a specific user (`type=user`) owner access (`role=owner`).
* Update an existing file permission with `role=owner` and transfer ownership
  to the specified user (`transferOwnership=true`).

**Note:** When a file is transferred, the previous owner's role is downgraded to
`writer`.

## Transfer file ownership from one consumer account to another

Ownership of files can be transferred between one [consumer
account](https://cloud.google.com/architecture/identity/overview-google-authentication#consumer_account)
to another. However, Drive doesn't transfer ownership of a file
between the two consumer accounts until the prospective owner explicitly
consents to the transfer. To transfer file ownership from one consumer account
to another:

1. The current owner initiates an ownership transfer by creating or updating
   the prospective owner's file permission. The permission must include these
   settings: `role=writer`, `type=user`, and `pendingOwner=true`. If the
   current owner is creating a permission for the prospective owner, an email
   notification is sent to the prospective owner indicating that they're being
   asked to assume ownership of the file.
2. The prospective owner accepts the ownership transfer request by creating or
   updating their file permission. The permission must include these settings:
   `role=owner` and `transferOwnership=true`. If the prospective owner is
   creating a new permission, an email notification is sent to the previous
   owner indicating that ownership has been transferred.

When a file is transferred, the previous owner's role is downgraded to `writer`.

**Note:** Service accounts don't have storage quota in Drive, so ownership transfers to service accounts will fail.

## Related topics

* [Share files, folders, and drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
