# Google Drive API release notes Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/release-notes

Retrieved: 2026-09-19T16:30:24.649661+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

To get the latest product updates delivered to you, add the URL of this page to your
[feed
reader](https://wikipedia.org/wiki/Comparison_of_feed_aggregators), or add the feed URL directly: `https://developers.google.com/feeds/drive-release-notes.xml`.

This page contains release notes for features and updates to the
Drive API. We recommend that
Drive API developers periodically check this list for any new
announcements.

## September 02, 2026

Feature

**Generally Available**: The
[`copyComments`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy#body.QUERY_PARAMETERS.copy_comments)
query parameter on the
[`files.copy`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy)
method is now generally available.

This parameter allows you to copy open comments and suggestions when copying a
Google Docs, Sheets, or Slides file. For more information, see [Copy
comments](https://developers.google.com/workspace/drive/api/guides/create-file#copy-comments).

## July 15, 2026

Feature

**Generally Available**: The [`fileContentChangeBehavior`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals#filecontentchangebehavior)
field on the
[`approvals`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals)
resource is now generally available.

This field allows you to determine the behavior of an approval when the file
content is changed while the approval status is `IN_PROGRESS`. You can set this
field through the
[`start`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals#start)
method on the `approvals` resource.

## May 21, 2026

Feature

**[Developer Preview](https://developers.google.com/workspace/preview)**: The `copy_file` tool is now available for the Google Drive MCP server. AI agents or client applications can use this tool to copy an existing file in Google Drive, with options to specify a new title and redirect it to a specific parent directory.

To learn more about configuring and using the Drive MCP server, see the following pages:

* [Set up the Drive MCP server](https://developers.google.com/workspace/drive/api/guides/configure-mcp-server)
* [Drive MCP tool reference](https://developers.google.com/workspace/drive/api/reference/mcp)

## May 18, 2026

Announcement

**Generally Available**: Subscriptions are now generally available for Google Drive events.

For details, see [Subscribe to Google Drive events](https://developers.google.com/workspace/events/guides/events-drive) in the Google Workspace Events API documentation. For information on how to receive Google Drive events from Google Cloud Pub/Sub, see [Work with events from Google Drive](https://developers.google.com/workspace/drive/api/guides/events-overview).

## May 01, 2026

Announcement

**Generally Available**: Updates to Drive API usage quotas

A new tiering model with updates to API usage quotas will start to roll out. For
more information, see [Google Workspace standardized model for agent tools and
APIs](https://developers.google.com/workspace/tools-safety).

Announcement

**Generally Available**: To help align resource usage in the Google Drive API,
usage quotas will change to be measured in quota units instead of the number of
requests. Additionally, Google Workspace users can now only egress 1 TB per day.
For more information, see [Google Drive API usage
limits](https://developers.google.com/workspace/drive/api/guides/limits).

## April 22, 2026

Feature

**[Developer Preview](https://developers.google.com/workspace/preview)**: The [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for Google Drive is now available in developer preview. MCP is an open protocol that enables seamless integration between AI applications and your Drive files. By configuring the Drive MCP server, you enable AI agents to securely search your files and take actions, such as reading content or creating files.

For example, you can ask your AI agent: *"Summarize the file 'Marketing Plan'."*

To get started with the Drive MCP server, see the following documentation:

* [Set up the Drive MCP server](https://developers.google.com/workspace/drive/api/guides/configure-mcp-server)
* [Drive MCP tool reference](https://developers.google.com/workspace/drive/api/reference/mcp)

To find more available MCP servers, see [Model Context Protocol (MCP) servers in Google Workspace](https://developers.google.com/workspace/guides/configure-mcp-servers).

## April 21, 2026

Feature

**Generally Available**: The Google Drive API now lets you start and manage
approvals on Drive files through the
[`approvals`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals)
resource. The following API methods have been added:

* [`approvals.start`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/start)
* [`approvals.approve`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/approve)
* [`approvals.decline`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/decline)
* [`approvals.reassign`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/reassign)
* [`approvals.cancel`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/cancel)
* [`approvals.comment`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/comment)

You can still retrieve and list the status of your approvals using either the
[`approvals.get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/get)
or the
[`approvals.list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/list)
method.

For details, see [Manage
approvals](https://developers.google.com/workspace/drive/api/guides/approvals).

## February 25, 2026

Deprecated

**Generally Available**: The `enforceExpansiveAccess` query parameter is now deprecated for all methods in the [`permissions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource (v2 and v3). To restrict item access, use the [folders with limited access](https://developers.google.com/workspace/drive/api/guides/limited-expansive-access) setting instead.

## December 17, 2025

Feature

**Generally Available**: The Google Drive API now supports the reading of content approvals on Drive files through the [`approvals`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals) resource. To retrieve approvals on a file, you can use either the [`get`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/get) or [`list`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals/list) method.

For details, see [Manage approvals](https://developers.google.com/workspace/drive/api/guides/approvals).

Feature

**(Developer Preview)**: You can now get [`approval`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals) events in Google Drive. The following event types are supported:

* An approval is created, cancelled, reset, or completed on a file.
* An approval reviewer is changed on a file.
* An approval reviewer responded to an approval on a file.

For details, see [Subscribe to Google Drive events](https://developers.google.com/workspace/events/guides/events-drive) in the Google Workspace Events API documentation. For information on how to receive Google Drive events from Google Cloud Pub/Sub, see [Work with events from Google Drive](https://developers.google.com/workspace/drive/api/guides/events-overview).

## November 11, 2025

Feature

**(Developer Preview)**: You can now get `comment` and `reply` events in Google Drive. The following event types are supported:

* A user posts a comment in a Google Docs, Sheets, or Slides file.
* A user replies to a comment.

For details, see [Subscribe to Google Drive events](https://developers.google.com/workspace/events/guides/events-drive) in the Google Workspace Events API documentation. For information on how to receive Google Drive events from Google Cloud Pub/Sub, see [Work with events from Google Drive](https://developers.google.com/workspace/drive/api/guides/events-overview).

## July 16, 2025

Change

The Drive API has changed how download, print, and copy restrictions are applied.

Users with the role of `owner` or `organizer` can apply restrictions to other users with `writer` roles, in addition to `reader` roles. Users can directly apply restrictions on files using the `itemDownloadRestriction` field within the [`DownloadRestrictionsMetadata`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#downloadrestrictionsmetadata) object. Determination of whether file restrictions can be changed is controlled by the new `capabilities.canChangeItemDownloadRestriction` field.

Similarly, users with the role of shared drive `organizer` can directly apply restrictions on shared drives using the `downloadRestriction` field within the [`Restrictions`](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives#Drive.FIELDS.restrictions) object. Determination of whether shared drive restrictions can be changed is also controlled by the `capabilities.canChangeDownloadRestriction` field.

While the previous field (`copyRequiresWriterPermission`) that controlled download, print, and copy restrictions is still available, the functionality is different for both reading from and writing to the field. We recommend that you use the new `DownloadRestriction` object to enforce how users can download, print, and copy files.

For more information about how download, print, and copy restrictions are now applied for My Drive and shared drive files, see:

* [Protect file content](https://developers.google.com/workspace/drive/api/guides/content-restrictions#download-print-copy)
* [Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives#download-print-copy)

## July 07, 2025

Feature

**(Developer Preview)**: You can now subscribe to events in Google Drive. The following event types are supported:

* A file is added to a folder or shared drive.
* A file is moved to a folder or shared drive.
* A file is edited or a new revision is uploaded.
* A file is trashed or removed from the trash.
* An access proposal is created or resolved on a file.

For details, see [Subscribe to Google Drive events](https://developers.google.com/workspace/events/guides/events-drive) in the Google Workspace Events API documentation. For information on how to receive Google Drive events from Google Cloud Pub/Sub, see [Work with events from Google Drive](https://developers.google.com/workspace/drive/api/guides/events-overview).

## February 19, 2025

Feature

**Generally Available**: The Google Drive API now supports folders with limited access which allow you to restrict folders to specific users. Folders with limited access broadens the expansive access model from shared drives to My Drive.

To limit access to a folder, developers can set the boolean `inheritedPermissionsDisabled` field on the [`files`](https://developers.google.com/drive/api/reference/rest/v3/files) resource to `true`. Developers can also opt in to expansive access API behavior in My Drive ahead of any future mandatory enforcement by setting the `enforceExpansiveAccess` request parameter to `true` on the [`permissions.delete()`](https://developers.google.com/drive/api/reference/rest/v3/permissions/delete) and [`permissions.update()`](https://developers.google.com/drive/api/reference/rest/v3/permissions/update) methods.

To learn more, see [Manage folders with limited and expansive access](https://developers.google.com/drive/api/guides/limited-expansive-access).

## September 13, 2024

Feature

The Google Drive API returns a long-running operation (LRO) every time you call the [`files.download`](https://developers.google.com/drive/api/reference/rest/v3/files/download) method to download blob file content or export Google Workspace document content either through the Drive API or its client libraries.

The `files.download` method returns an [`Operation`](https://cloud.google.com/service-infrastructure/docs/service-management/reference/rpc/google.longrunning#operation) resource to the client. You can use the `Operation` interface to asynchronously retrieve the status of the API method by polling the operation through the [`GetOperationRequest`](https://cloud.google.com/service-infrastructure/docs/service-management/reference/rpc/google.longrunning#getoperationrequest) method.

The `files.download` method is the only way to download Google Vids files in MP4 format and is typically best suited to downloading most video files.

To learn more, see [Manage long-running operations](https://developers.google.com/drive/api/guides/long-running-operations).

## July 11, 2024

Feature

The Google Drive API now supports the `drive.meet.readonly` scope. This restricted scope lets you view Drive files created or edited by Google Meet.

For details, see [Choose Google Drive API scopes](https://developers.google.com/drive/api/guides/api-specific-auth).

## January 26, 2024

Change

You can now get a list of the user's installed apps in v3, with information about each app's supported MIME types, file extensions, and other details.

The [`apps`](https://developers.google.com/drive/api/reference/rest/v3/apps) resource represents a user's list of installed apps and it supports the following methods:

* [Get](https://developers.google.com/drive/api/reference/rest/v3/apps/get) a specific installed app.
* [List](https://developers.google.com/drive/api/reference/rest/v3/apps/list) all the installed apps.

## January 24, 2024

Change

Each user can have up to [500 million items](https://developers.google.com/drive/api/guides/folder#user-limit) that were created by that account, no matter where those items reside. Previously, users could create an unlimited number of items in Drive.

## November 21, 2023

Change

A user's My Drive can't contain more than [100 levels of nested folders](https://developers.google.com/drive/api/guides/folder#depth-limit). Previously, folders in My Drive could be at an unlimited depth.

## July 24, 2023

Feature

A new content restriction parameter that only the file owner can modify (`ownerRestricted`) was added.

In addition, three capabilities were added:

* `capabilities.canModifyEditorContentRestriction`
* `capabilities.canModifyOwnerContentRestriction`
* `capabilities.canRemoveContentRestriction`

For details, see [Protect file content](https://developers.google.com/drive/api/guides/content-restrictions).

Deprecated

The `capabilities.canModifyContentRestriction` parameter was deprecated.

## March 10, 2013

Announcement

The Google Drive API is now generally available.
