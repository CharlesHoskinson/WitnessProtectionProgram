# Drive API v2 and v3 comparison reference Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/v2-to-v3-reference

Retrieved: 2026-09-19T16:30:29.468861+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This reference provides all resource differences between v2 and v3. For
high-level differences between the two versions, see [Drive API v2 and
v3 comparison guide](https://developers.google.com/workspace/drive/api/guides/v3versusv2).

### Method differences between v2 and v3

This table shows v2 methods that have changed in v3.

| v2 Method | v3 Method |
| --- | --- |
| `children.delete` | `files.update` on the child with `?removeParents=parent_id` |
| `children.get` | `files.list` with `?q='parent_id'+in+parents` |
| `children.insert` | `files.update` on the child with `?addParents=parent_id` |
| `children.list` | `files.list` with `?q='parent_id'+in+parents` |
| `comments.insert` | `comments.create` |
| `comments.patch` | `comments.update` |
| `files.insert` | `files.create` |
| `files.patch` | `files.update` |
| `files.touch` | `files.update` with `{'modifiedTime':'timestamp'}` |
| `files.trash` | `files.update` with `{'trashed':true}` |
| `files.untrash` | `files.update` with `{'trashed':false}` |
| `parents.delete` | `files.update` with `?removeParents=parent_id` |
| `parents.get` | `files.get` with `?fields=parents` |
| `parents.insert` | `files.update` with `?addParents=parent_id` |
| `parents.list` | `files.get` with `?fields=parents` |
| `permissions.getIdForEmail` | n/a |
| `permissions.insert` | `permissions.create` |
| `permissions.patch` | `permissions.update` |
| `properties.delete` | PRIVATE: `files.update` with `{'appProperties':{'key':null}}` PUBLIC: `files.update` with `{'properties':{'key':null}}` |
| `properties.get` | PRIVATE: `files.get` with `fields='appProperties'`   PUBLIC: `files.get` with `fields='properties'` |
| `properties.insert` | PRIVATE: `files.update` with `{'appProperties':{'key':'value'}}`   PUBLIC: `files.update` with `{'properties':{'key':'value'}}` |
| `properties.list` | PRIVATE: `files.get` with `fields='appProperties'`   PUBLIC: `files.get` with `fields='properties'` |
| `properties.update` | PRIVATE: `files.update` with `{'appProperties':{'key':'value'}}`   PUBLIC: `files.update` with `{'properties':{'key':'value'}}` |
| `replies.insert` | `replies.create` |
| `replies.patch` | `replies.update` |
| `revisions.patch` | `revisions.update` |

### Parameter differences between v2 and v3

The following table shows methods that are the same in v2 and v3, but take different parameters.

| Method | v2 Parameter | v3 Parameter |
| --- | --- | --- |
| `about.get` | `includeSubscribed` | n/a |
| `about.get` | `maxChangeIdCount` | n/a |
| `about.get` | `startChangeId` | n/a |
| `changes.list` | `includeDeleted` | `includeRemoved` |
| `changes.list` | `includeSubscribed=true` | `restrictToMyDrive=false` |
| `changes.list` | `includeSubscribed=false` | `restrictToMyDrive=true` |
| `changes.list` | `maxResults` | `pageSize` |
| `changes.list` | `startChangeId` | `pageToken` |
| `changes.list` | `etag` | n/a |
| `changes.list` | `items` | `changes` |
| `changes.list` | `largestChangeId` | `newStartPageToken` |
| `changes.list` | `nextLink` | `nextPageToken` |
| `changes.list` | `selfLink` | n/a |
| `comments.list` | `maxResults` | `pageSize` |
| `comments.list` | `updatedMin` | `startModifiedTime` |
| `comments.list` | `nextLink` | `nextPageToken` |
| `comments.list` | `selfLink` | n/a |
| `comments.list` | `items` | `comments` |
| `files.copy` | `convert` | Provide the target `mimeType` in the resource body |
| `files.copy` | `ocr` | OCR is enabled automatically for image imports |
| `files.copy` | `pinned` | `keepRevisionForever` |
| `files.copy` | `timedTextLanguage` | n/a |
| `files.copy` | `timedTextTrackName` | n/a |
| `files.copy` | `visibility=DEFAULT` | `ignoreDefaultVisibility=false` |
| `files.copy` | `visibility=PRIVATE` | `ignoreDefaultVisibility=true` |
| `files.insert` | `convert` | Provide the target `mimeType` in the resource body |
| `files.insert` | `ocr` | OCR is enabled automatically for image imports |
| `files.insert` | `pinned` | `keepRevisionForever` |
| `files.insert` | `timedTextLanguage` | n/a |
| `files.insert` | `timedTextTrackName` | n/a |
| `files.insert` | `visibility=DEFAULT` | `ignoreDefaultVisibility=false` |
| `files.insert` | `visibility=PRIVATE` | `ignoreDefaultVisibility=true` |
| `files.get` | `projection` | n/a |
| `files.get` | `revisionId` | `revisions.get` |
| `files.get` | `updateViewedDate` | `files.update` with `{'viewedByMeTime':'timestamp'}` |
| `files.generateIds` | `maxResults` | `count` |
| `files.list` | `corpora=default` | `corpus=user` |
| `files.list` | `corpora=domain` | `corpus=domain` |
| `files.list` | `maxResults` | `pageSize` |
| `files.list` | `etag` | n/a |
| `files.list` | `items` | `files` |
| `files.list` | `nextLink` | `nextPageToken` |
| `files.list` | `selfLink` | n/a |
| `files.update` | `modifiedDateBehavior` | The modified date is set automatically if not provided in the resource body. |
| `files.update` | `newRevision` | n/a |
| `files.update` | `ocr` | OCR is enabled automatically for image imports |
| `files.update` | `pinned` | `keepRevisionForever` |
| `files.update` | `setModifiedDate` | n/a |
| `files.update` | `timedTextLanguage` | n/a |
| `files.update` | `timedTextTrackName` | n/a |
| `files.update` | `updateViewedDate` | `files.update` with `{'viewedByMeTime':'timestamp'}` |
| `permissions.insert` | `sendNotificationEmails` | `sendNotificationEmail` |
| `permissions.list` | `etag` | n/a |
| `permissions.list` | `items` | `permissions` |
| `permissions.list` | `selfLink` | n/a |
| `replies.list` | `maxResults` | `pageSize` |
| `replies.list` | `items` | `replies` |
| `replies.list` | `nextLink` | `nextPageToken` |
| `replies.list` | `selfLink` | n/a |
| `revisions.list` | `etag` | n/a |
| `revisions.list` | `items` | `revisions` |
| `revisions.list` | `selfLink` | n/a |

### Resource field differences between v2 and v3

This table shows resource fields that have changed from v2 to v3.

| Resource | v2 `Field` | v3 `Field` |
| --- | --- | --- |
| `About` | `additionalRoleInfo` | n/a |
| `About` | `domainSharingPolicy` | n/a |
| `About` | `etag` | n/a |
| `About` | `features` | n/a |
| `About` | `languageCode` | n/a |
| `About` | `largestChangeId` | `changes.getStartPageToken` |
| `About` | `maxUploadSizes` | `maxImportSizes` and `maxUploadSize` |
| `About` | `name` | `user.displayName` |
| `About` | `permissionId` | `user.permissionId` |
| `About` | `quotaBytesByService` | n/a |
| `About` | `quotaType` | Indicated by the presence or absence of `storageQuota.limit` |
| `About` | `remainingChangeIds` | n/a |
| `About` | `rootFolderId` | `files.get` with `fileId=root` and `?fields=id` |
| `About` | `selfLink` | n/a |
| `About` | `isCurrentAppInstalled` | `appInstalled` |
| `About` | `quotaBytesTotal` | `storageQuota.limit` |
| `About` | `quotaBytesUsed` | `storageQuota.usageInDrive` |
| `About` | `quotaBytesUsedAggregate` | `storageQuota.usage` |
| `About` | `quotaBytesUsedInTrash` | `storageQuota.usageInDriveTrash` |
| `Apps` | `etag` | n/a |
| `Changes` | `deleted` | `removed` |
| `Changes` | `id` | n/a |
| `Changes` | `selfLink` | n/a |
| `Changes` | `modificationDate` | `time` |
| `Comments` | `context.type` | `quotedFileContent.mimeType` |
| `Comments` | `context.value` | `quotedFileContent.value` |
| `Comments` | `createdDate` | `createdTime` |
| `Comments` | `fileId` | n/a |
| `Comments` | `fileTitle` | `files.get` with `?fields=name` |
| `Comments` | `modifiedDate` | `modifiedTime` |
| `Comments` | `selfLink` | n/a |
| `Comments` | `status` | `resolved` |
| `Files` | `alternateLink` | `webViewLink` |
| `Files` | `appDataContents` | `spaces` |
| `Files` | `copyable` | `capabilities.canCopy` |
| `Files` | `createdDate` | `createdTime` |
| `Files` | `defaultOpenWithLink` | n/a |
| `Files` | `downloadUrl` | `files.get` with `?alt=media` |
| `Files` | `editable` | `capabilities.canEdit` |
| `Files` | `embedLink` | n/a |
| `Files` | `etag` | n/a |
| `Files` | `fileSize` | `size` |
| `Files` | `imageMediaMetadata.date` | `imageMediaMetadata.time` |
| `Files` | `indexableText.text` | `contentHints.indexableText` |
| `Files` | `copyRequiresWriterPermission` | `viewersCanCopyContent` |
| `Files` | `labels.starred` | `starred` |
| `Files` | `labels.trashed` | `trashed` |
| `Files` | `labels.viewed` | `viewedByMe` |
| `Files` | `lastModifyingUserName` | `lastModifyingUser.displayName` |
| `Files` | `lastViewedByMeDate` | `viewedByMeTime` |
| `Files` | `modifiedByMeDate` | `modifiedByMeTime` |
| `Files` | `modifiedDate` | `modifiedTime` |
| `Files` | `openWithLinks` | n/a |
| `Files` | `ownerNames` | `owners.displayName` |
| `Files` | `selfLink` | n/a |
| `Files` | `sharedWithMeDate` | `sharedWithMeTime` |
| `Files` | `thumbnail.image` | `contentHints.thumbnail.image` |
| `Files` | `thumbnail.mimeType` | `contentHints.thumbnail.mimeType` |
| `Files` | `title` | `name` |
| `Files` | `userPermission` | `ownedByMe`, `capabilities.canEdit`, `capabilities.canComment` |
| `Files` | `webViewLink` | n/a |
| `Permissions` | `additionalRoles` | `role` |
| `Permissions` | `authKey` | n/a |
| `Permissions` | `etag` | n/a |
| `Permissions` | `name` | `displayName` |
| `Permissions` | `selfLink` | n/a |
| `Permissions` | `value` | `emailAddress` or `domain` |
| `Permissions` | `withLink=true` | `allowFileDiscovery=false` |
| `Permissions` | `withLink=false` | `allowFileDiscovery=true` |
| `Replies` | `createdDate` | `createdTime` |
| `Replies` | `modifiedDate` | `modifiedTime` |
| `Replies` | `replyId` | `id` |
| `Replies` | `verb` | `action` |
| `Revisions` | `downloadUrl` | `revisions.get` with `?alt=media` |
| `Revisions` | `etag` | n/a |
| `Revisions` | `fileSize` | `size` |
| `Revisions` | `lastModifyingUserName` | `lastModifyingUser.displayName` |
| `Revisions` | `modifiedDate` | `modifiedTime` |
| `Revisions` | `pinned` | `keepForever` |
| `Revisions` | `publishedLink` | n/a |
| `Revisions` | `selfLink` | n/a |
| `Revisions` | `isAuthenticatedUser` | `me` |
| `Revisions` | `lastModifyingUser.picture.url` | `photoLink` |
