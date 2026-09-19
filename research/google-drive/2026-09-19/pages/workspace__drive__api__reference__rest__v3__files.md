# REST Resource: files Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/files

Retrieved: 2026-09-19T16:28:42.408486+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [Resource: File](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.SCHEMA_REPRESENTATION)
    - [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.SCHEMA_REPRESENTATION.content_hints.SCHEMA_REPRESENTATION)
    - [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.SCHEMA_REPRESENTATION.image_media_metadata.SCHEMA_REPRESENTATION)
  + [ContentRestriction](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.ContentRestriction)
    - [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.ContentRestriction.SCHEMA_REPRESENTATION)
  + [DownloadRestrictionsMetadata](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.DownloadRestrictionsMetadata)
    - [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.DownloadRestrictionsMetadata.SCHEMA_REPRESENTATION)
  + [DownloadRestriction](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.DownloadRestriction)
    - [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.DownloadRestriction.SCHEMA_REPRESENTATION)
  + [ClientEncryptionDetails](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.ClientEncryptionDetails)
    - [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.ClientEncryptionDetails.SCHEMA_REPRESENTATION)
  + [DecryptionMetadata](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.DecryptionMetadata)
    - [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#File.DecryptionMetadata.SCHEMA_REPRESENTATION)
* [Methods](https://developers.google.com/workspace/drive/api/reference/rest/v3/files#METHODS_SUMMARY)

## Resource: File

The metadata for a file.

Some resource methods (such as `files.update`) require a `fileId`. Use the `files.list` method to retrieve the ID for a file.

| JSON representation |
| --- |
| ``` {   "kind": string,   "driveId": string,   "fileExtension": string,   "copyRequiresWriterPermission": boolean,   "md5Checksum": string,   "contentHints": {     "indexableText": string,     "thumbnail": {       "image": string,       "mimeType": string     }   },   "writersCanShare": boolean,   "viewedByMe": boolean,   "mimeType": string,   "exportLinks": {     string: string,     ...   },   "parents": [     string   ],   "thumbnailLink": string,   "iconLink": string,   "shared": boolean,   "lastModifyingUser": {     object (User)   },   "owners": [     {       object (User)     }   ],   "headRevisionId": string,   "sharingUser": {     object (User)   },   "webViewLink": string,   "webContentLink": string,   "size": string,   "viewersCanCopyContent": boolean,   "permissions": [     {       object (Permission)     }   ],   "hasThumbnail": boolean,   "spaces": [     string   ],   "folderColorRgb": string,   "id": string,   "name": string,   "description": string,   "starred": boolean,   "trashed": boolean,   "explicitlyTrashed": boolean,   "createdTime": string,   "modifiedTime": string,   "modifiedByMeTime": string,   "viewedByMeTime": string,   "sharedWithMeTime": string,   "quotaBytesUsed": string,   "version": string,   "originalFilename": string,   "ownedByMe": boolean,   "fullFileExtension": string,   "properties": {     string: value,     ...   },   "appProperties": {     string: value,     ...   },   "isAppAuthorized": boolean,   "teamDriveId": string,   "capabilities": {     "canChangeViewersCanCopyContent": boolean,     "canMoveChildrenOutOfDrive": boolean,     "canReadDrive": boolean,     "canEdit": boolean,     "canCopy": boolean,     "canComment": boolean,     "canAddChildren": boolean,     "canDelete": boolean,     "canDownload": boolean,     "canListChildren": boolean,     "canRemoveChildren": boolean,     "canRename": boolean,     "canTrash": boolean,     "canReadRevisions": boolean,     "canReadTeamDrive": boolean,     "canMoveTeamDriveItem": boolean,     "canChangeCopyRequiresWriterPermission": boolean,     "canMoveItemIntoTeamDrive": boolean,     "canUntrash": boolean,     "canModifyContent": boolean,     "canMoveItemWithinTeamDrive": boolean,     "canMoveItemOutOfTeamDrive": boolean,     "canDeleteChildren": boolean,     "canMoveChildrenOutOfTeamDrive": boolean,     "canMoveChildrenWithinTeamDrive": boolean,     "canTrashChildren": boolean,     "canMoveItemOutOfDrive": boolean,     "canAddMyDriveParent": boolean,     "canRemoveMyDriveParent": boolean,     "canMoveItemWithinDrive": boolean,     "canShare": boolean,     "canMoveChildrenWithinDrive": boolean,     "canModifyContentRestriction": boolean,     "canAddFolderFromAnotherDrive": boolean,     "canChangeSecurityUpdateEnabled": boolean,     "canAcceptOwnership": boolean,     "canReadLabels": boolean,     "canModifyLabels": boolean,     "canModifyEditorContentRestriction": boolean,     "canModifyOwnerContentRestriction": boolean,     "canRemoveContentRestriction": boolean,     "canDisableInheritedPermissions": boolean,     "canEnableInheritedPermissions": boolean,     "canChangeItemDownloadRestriction": boolean,     "canStartApproval": boolean,     "canAccessViaGenAi": boolean   },   "hasAugmentedPermissions": boolean,   "trashingUser": {     object (User)   },   "thumbnailVersion": string,   "trashedTime": string,   "modifiedByMe": boolean,   "permissionIds": [     string   ],   "imageMediaMetadata": {     "flashUsed": boolean,     "meteringMode": string,     "sensor": string,     "exposureMode": string,     "colorSpace": string,     "whiteBalance": string,     "width": integer,     "height": integer,     "location": {       "latitude": number,       "longitude": number,       "altitude": number     },     "rotation": integer,     "time": string,     "cameraMake": string,     "cameraModel": string,     "exposureTime": number,     "aperture": number,     "focalLength": number,     "isoSpeed": integer,     "exposureBias": number,     "maxApertureValue": number,     "subjectDistance": integer,     "lens": string   },   "videoMediaMetadata": {     "width": integer,     "height": integer,     "durationMillis": string   },   "shortcutDetails": {     "targetId": string,     "targetMimeType": string,     "targetResourceKey": string   },   "contentRestrictions": [     {       object (ContentRestriction)     }   ],   "resourceKey": string,   "linkShareMetadata": {     "securityUpdateEligible": boolean,     "securityUpdateEnabled": boolean   },   "labelInfo": {     "labels": [       {         object (Label)       }     ]   },   "sha1Checksum": string,   "sha256Checksum": string,   "inheritedPermissionsDisabled": boolean,   "downloadRestrictions": {     object (DownloadRestrictionsMetadata)   },   "clientEncryptionDetails": {     object (ClientEncryptionDetails)   } } ``` |

| Fields | |
| --- | --- |
| `kind` | `string`  Output only. Identifies what kind of resource this is. Value: the fixed string `"drive#file"`. |
| `driveId` | `string`  Output only. ID of the shared drive the file resides in. Only populated for items in shared drives. |
| `fileExtension` | `string`  Output only. The final component of `fullFileExtension`. This is only available for files with binary content in Google Drive. |
| `copyRequiresWriterPermission` | `boolean`  Whether the options to copy, print, or download this file should be disabled for readers and commenters. |
| `md5Checksum` | `string`  Output only. The MD5 checksum for the content of the file. This is only applicable to files with binary content in Google Drive. |
| `contentHints` | `object`  Additional information about the content of the file. These fields are never populated in responses. |
| `contentHints.indexableText` | `string`  Text to be indexed for the file to improve fullText queries. This is limited to 128 KB in length and may contain HTML elements. |
| `contentHints.thumbnail` | `object`  A thumbnail for the file. This will only be used if Google Drive cannot generate a standard thumbnail. |
| `contentHints.thumbnail.image` | `string (bytes format)`  The thumbnail data encoded with URL-safe Base64 ([RFC 4648 section 5](https://datatracker.ietf.org/doc/html/rfc4648#section-5)).  A base64-encoded string. |
| `contentHints.thumbnail.mimeType` | `string`  The MIME type of the thumbnail. |
| `writersCanShare` | `boolean`  Whether users with only `writer` permission can modify the file's permissions. Not populated for items in shared drives. |
| `viewedByMe` | `boolean`  Output only. Whether the file has been viewed by this user. |
| `mimeType` | `string`  The MIME type of the file.  Google Drive attempts to automatically detect an appropriate value from uploaded content, if no value is provided. The value cannot be changed unless a new revision is uploaded.  If a file is created with a Google Doc MIME type, the uploaded content is imported, if possible. The supported import formats are published in the [`about`](https://developers.google.com/workspace/drive/api/reference/rest/v3/about) resource. |
| `exportLinks` | `map (key: string, value: string)`  Output only. Links for exporting Docs Editors files to specific formats.  An object containing a list of `"key": value` pairs. Example: `{ "name": "wrench", "mass": "1.3kg", "count": "3" }`. |
| `parents[]` | `string`  The ID of the parent folder containing the file.  A file can only have one parent folder; specifying multiple parents isn't supported.  If not specified as part of a create request, the file is placed directly in the user's My Drive folder. If not specified as part of a copy request, the file inherits any discoverable parent of the source file. Update requests must use the `addParents` and `removeParents` parameters to modify the parents list. |
| `thumbnailLink` | `string`  Output only. A short-lived link to the file's thumbnail, if available. Typically lasts on the order of hours. Not intended for direct usage on web applications due to [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) policies. Consider using a proxy server. Only populated when the requesting app can access the file's content. If the file isn't shared publicly, the URL returned in `files.thumbnailLink` must be fetched using a credentialed request. |
| `iconLink` | `string`  Output only. A static, unauthenticated link to the file's icon. |
| `shared` | `boolean`  Output only. Whether the file has been shared. Not populated for items in shared drives. |
| `lastModifyingUser` | `object (User)`  Output only. The last user to modify the file. This field is only populated when the last modification was performed by a signed-in user. |
| `owners[]` | `object (User)`  Output only. The owner of this file. Only certain legacy files may have more than one owner. This field isn't populated for items in shared drives. |
| `headRevisionId` | `string`  Output only. The ID of the file's head revision. This is currently only available for files with binary content in Google Drive. |
| `sharingUser` | `object (User)`  Output only. The user who shared the file with the requesting user, if applicable. |
| `webViewLink` | `string`  Output only. A link for opening the file in a relevant Google editor or viewer in a browser. |
| `webContentLink` | `string`  Output only. A link for downloading the content of the file in a browser. This is only available for files with binary content in Google Drive. |
| `size` | `string (int64 format)`  Output only. Size in bytes of blobs and Google Workspace editor files. Won't be populated for files that have no size, like shortcuts and folders. |
| `viewersCanCopyContent (deprecated)` | `boolean`  This item is deprecated!  Deprecated: Use `copyRequiresWriterPermission` instead. |
| `permissions[]` | `object (Permission)`  Output only. The full list of permissions for the file. This is only available if the requesting user can share the file. Not populated for items in shared drives. |
| `hasThumbnail` | `boolean`  Output only. Whether this file has a thumbnail. This doesn't indicate whether the requesting app has access to the thumbnail. To check access, look for the presence of the thumbnailLink field. |
| `spaces[]` | `string`  Output only. The list of spaces which contain the file. The currently supported values are `drive`, `appDataFolder`, and `photos`. |
| `folderColorRgb` | `string`  The color for a folder or a shortcut to a folder as an RGB hex string. The supported colors are published in the `folderColorPalette` field of the [`about`](https://developers.google.com/workspace/drive/api/reference/rest/v3/about) resource.  If an unsupported color is specified, the closest color in the palette is used instead. |
| `id` | `string`  The ID of the file. |
| `name` | `string`  The name of the file. This isn't necessarily unique within a folder. Note that for immutable items such as the top-level folders of shared drives, the My Drive root folder, and the Application Data folder, the name is constant. |
| `description` | `string`  A short description of the file. |
| `starred` | `boolean`  Whether the user has starred the file. |
| `trashed` | `boolean`  Whether the file has been trashed, either explicitly or from a trashed parent folder. Only the owner may trash a file, but other users can still access the file in the owner's trash until it's permanently deleted. |
| `explicitlyTrashed` | `boolean`  Output only. Whether the file has been explicitly trashed, as opposed to recursively trashed from a parent folder. |
| `createdTime` | `string`  The time at which the file was created ([RFC 3339 date-time](https://datatracker.ietf.org/doc/html/rfc3339)). |
| `modifiedTime` | `string`  The last time the file was modified by anyone ([RFC 3339 date-time](https://datatracker.ietf.org/doc/html/rfc3339)).  Note that setting `modifiedTime` also updates `modifiedByMeTime` for the user. |
| `modifiedByMeTime` | `string`  Output only. The last time the file was modified by the user ([RFC 3339 date-time](https://datatracker.ietf.org/doc/html/rfc3339)). |
| `viewedByMeTime` | `string`  The last time the file was viewed by the user ([RFC 3339 date-time](https://datatracker.ietf.org/doc/html/rfc3339)). |
| `sharedWithMeTime` | `string`  Output only. The time at which the file was shared with the user, if applicable ([RFC 3339 date-time](https://datatracker.ietf.org/doc/html/rfc3339)). |
| `quotaBytesUsed` | `string (int64 format)`  Output only. The number of storage quota bytes used by the file. This includes the head revision as well as previous revisions with `keepForever` enabled. |
| `version` | `string (int64 format)`  Output only. A monotonically increasing version number for the file. This reflects every change made to the file on the server, even those not visible to the user. |
| `originalFilename` | `string`  The original filename of the uploaded content if available, or else the original value of the `name` field. This is only available for files with binary content in Google Drive. |
| `ownedByMe` | `boolean`  Output only. Whether the user owns the file. Not populated for items in shared drives. |
| `fullFileExtension` | `string`  Output only. The full file extension extracted from the `name` field. May contain multiple concatenated extensions, such as "tar.gz". This is only available for files with binary content in Google Drive.  This is automatically updated when the `name` field changes, however it's not cleared if the new name doesn't contain a valid extension. |
| `properties` | `map (key: string, value: value (Value format))`  A collection of arbitrary key-value pairs which are visible to all apps.  Entries with null values are cleared in update and copy requests.  An object containing a list of `"key": value` pairs. Example: `{ "name": "wrench", "mass": "1.3kg", "count": "3" }`. |
| `appProperties` | `map (key: string, value: value (Value format))`  A collection of arbitrary key-value pairs which are private to the requesting app.  Entries with null values are cleared in update and copy requests.  These properties can only be retrieved using an authenticated request. An authenticated request uses an access token obtained with an OAuth 2.0 client ID. You cannot use an API key to retrieve private properties.  An object containing a list of `"key": value` pairs. Example: `{ "name": "wrench", "mass": "1.3kg", "count": "3" }`. |
| `isAppAuthorized` | `boolean`  Output only. Whether the file was created or opened by the requesting app. |
| `teamDriveId (deprecated)` | `string`  This item is deprecated!  Deprecated: Output only. Use `driveId` instead. |
| `capabilities` | `object`  Output only. Capabilities the current user has on this file. Each capability corresponds to a fine-grained action that a user may take. For more information, see [Understand file capabilities](https://developers.google.com/workspace/drive/api/guides/manage-sharing#capabilities). |
| `capabilities.canChangeViewersCanCopyContent (deprecated)` | `boolean`  Deprecated: Output only. |
| `capabilities.canMoveChildrenOutOfDrive` | `boolean`  Output only. Whether the current user can move children of this folder outside of the shared drive. This is `false` when the item isn't a folder. Only populated for items in shared drives. |
| `capabilities.canReadDrive` | `boolean`  Output only. Whether the current user can read the shared drive to which this file belongs. Only populated for items in shared drives. |
| `capabilities.canEdit` | `boolean`  Output only. Whether the current user can edit this file. Other factors may limit the type of changes a user can make to a file. For example, see `canChangeCopyRequiresWriterPermission` or `canModifyContent`. |
| `capabilities.canCopy` | `boolean`  Output only. Whether the current user can copy this file. For an item in a shared drive, whether the current user can copy non-folder descendants of this item, or this item if it's not a folder. |
| `capabilities.canComment` | `boolean`  Output only. Whether the current user can comment on this file. |
| `capabilities.canAddChildren` | `boolean`  Output only. Whether the current user can add children to this folder. This is always `false` when the item isn't a folder. |
| `capabilities.canDelete` | `boolean`  Output only. Whether the current user can delete this file. |
| `capabilities.canDownload` | `boolean`  Output only. Whether the current user can download this file. |
| `capabilities.canListChildren` | `boolean`  Output only. Whether the current user can list the children of this folder. This is always `false` when the item isn't a folder. |
| `capabilities.canRemoveChildren` | `boolean`  Output only. Whether the current user can remove children from this folder. This is always `false` when the item isn't a folder. For a folder in a shared drive, use `canDeleteChildren` or `canTrashChildren` instead. |
| `capabilities.canRename` | `boolean`  Output only. Whether the current user can rename this file. |
| `capabilities.canTrash` | `boolean`  Output only. Whether the current user can move this file to trash. |
| `capabilities.canReadRevisions` | `boolean`  Output only. Whether the current user can read the revisions resource of this file. For a shared drive item, whether revisions of non-folder descendants of this item, or this item if it's not a folder, can be read. |
| `capabilities.canReadTeamDrive (deprecated)` | `boolean`  Deprecated: Output only. Use `canReadDrive` instead. |
| `capabilities.canMoveTeamDriveItem (deprecated)` | `boolean`  Deprecated: Output only. Use `canMoveItemWithinDrive` or `canMoveItemOutOfDrive` instead. |
| `capabilities.canChangeCopyRequiresWriterPermission` | `boolean`  Output only. Whether the current user can change the `copyRequiresWriterPermission` restriction of this file. |
| `capabilities.canMoveItemIntoTeamDrive (deprecated)` | `boolean`  Deprecated: Output only. Use `canMoveItemOutOfDrive` instead. |
| `capabilities.canUntrash` | `boolean`  Output only. Whether the current user can restore this file from trash. |
| `capabilities.canModifyContent` | `boolean`  Output only. Whether the current user can modify the content of this file. |
| `capabilities.canMoveItemWithinTeamDrive (deprecated)` | `boolean`  Deprecated: Output only. Use `canMoveItemWithinDrive` instead. |
| `capabilities.canMoveItemOutOfTeamDrive (deprecated)` | `boolean`  Deprecated: Output only. Use `canMoveItemOutOfDrive` instead. |
| `capabilities.canDeleteChildren` | `boolean`  Output only. Whether the current user can delete children of this folder. This is `false` when the item isn't a folder. Only populated for items in shared drives. |
| `capabilities.canMoveChildrenOutOfTeamDrive (deprecated)` | `boolean`  Deprecated: Output only. Use `canMoveChildrenOutOfDrive` instead. |
| `capabilities.canMoveChildrenWithinTeamDrive (deprecated)` | `boolean`  Deprecated: Output only. Use `canMoveChildrenWithinDrive` instead. |
| `capabilities.canTrashChildren` | `boolean`  Output only. Whether the current user can trash children of this folder. This is `false` when the item isn't a folder. Only populated for items in shared drives. |
| `capabilities.canMoveItemOutOfDrive` | `boolean`  Output only. Whether the current user can move this item outside of this drive by changing its parent. Note that a request to change the parent of the item may still fail depending on the new parent that's being added. |
| `capabilities.canAddMyDriveParent` | `boolean`  Output only. Whether the current user can add a parent for the item without removing an existing parent in the same request. Not populated for shared drive files. |
| `capabilities.canRemoveMyDriveParent` | `boolean`  Output only. Whether the current user can remove a parent from the item without adding another parent in the same request. Not populated for shared drive files. |
| `capabilities.canMoveItemWithinDrive` | `boolean`  Output only. Whether the current user can move this item within this drive. Note that a request to change the parent of the item may still fail depending on the new parent that's being added and the parent that is being removed. |
| `capabilities.canShare` | `boolean`  Output only. Whether the current user can modify the sharing settings for this file. |
| `capabilities.canMoveChildrenWithinDrive` | `boolean`  Output only. Whether the current user can move children of this folder within this drive. This is `false` when the item isn't a folder. Note that a request to move the child may still fail depending on the current user's access to the child and to the destination folder. |
| `capabilities.canModifyContentRestriction (deprecated)` | `boolean`  Deprecated: Output only. Use one of `canModifyEditorContentRestriction`, `canModifyOwnerContentRestriction`, or `canRemoveContentRestriction`. |
| `capabilities.canAddFolderFromAnotherDrive` | `boolean`  Output only. Whether the current user can add a folder from another drive (different shared drive or My Drive) to this folder. This is `false` when the item isn't a folder. Only populated for items in shared drives. |
| `capabilities.canChangeSecurityUpdateEnabled` | `boolean`  Output only. Whether the current user can change the `securityUpdateEnabled` field on link share metadata. |
| `capabilities.canAcceptOwnership` | `boolean`  Output only. Whether the current user is the pending owner of the file. Not populated for shared drive files. |
| `capabilities.canReadLabels` | `boolean`  Output only. Whether the current user can read the labels on the file. |
| `capabilities.canModifyLabels` | `boolean`  Output only. Whether the current user can modify the labels on the file. |
| `capabilities.canModifyEditorContentRestriction` | `boolean`  Output only. Whether the current user can add or modify content restrictions on the file which are editor restricted. |
| `capabilities.canModifyOwnerContentRestriction` | `boolean`  Output only. Whether the current user can add or modify content restrictions which are owner restricted. |
| `capabilities.canRemoveContentRestriction` | `boolean`  Output only. Whether there's a content restriction on the file that can be removed by the current user. |
| `capabilities.canDisableInheritedPermissions` | `boolean`  Whether a user can disable inherited permissions. |
| `capabilities.canEnableInheritedPermissions` | `boolean`  Whether a user can re-enable inherited permissions. |
| `capabilities.canChangeItemDownloadRestriction` | `boolean`  Output only. Whether the current user can change the owner or organizer-applied download restrictions of the file. |
| `capabilities.canStartApproval` | `boolean`  Whether the current user can start an approval on the file. |
| `capabilities.canAccessViaGenAi` | `boolean`  Whether the current user can access this file via Gen AI features. For more information, see [Drive MCP file eligibility](https://developers.google.com/workspace/drive/api/guides/drive-mcp-server-file-eligibility). |
| `hasAugmentedPermissions` | `boolean`  Output only. Whether there are permissions directly on this file. This field is only populated for items in shared drives. |
| `trashingUser` | `object (User)`  Output only. If the file has been explicitly trashed, the user who trashed it. Only populated for items in shared drives. |
| `thumbnailVersion` | `string (int64 format)`  Output only. The thumbnail version for use in thumbnail cache invalidation. |
| `trashedTime` | `string`  Output only. The time that the item was trashed ([RFC 3339 date-time](https://datatracker.ietf.org/doc/html/rfc3339)). Only populated for items in shared drives. |
| `modifiedByMe` | `boolean`  Output only. Whether the file has been modified by this user. |
| `permissionIds[]` | `string`  Output only. List of permission IDs for users with access to this file. |
| `imageMediaMetadata` | `object`  Output only. Additional metadata about image media, if available. |
| `imageMediaMetadata.flashUsed` | `boolean`  Output only. Whether a flash was used to create the photo. |
| `imageMediaMetadata.meteringMode` | `string`  Output only. The metering mode used to create the photo. |
| `imageMediaMetadata.sensor` | `string`  Output only. The type of sensor used to create the photo. |
| `imageMediaMetadata.exposureMode` | `string`  Output only. The exposure mode used to create the photo. |
| `imageMediaMetadata.colorSpace` | `string`  Output only. The color space of the photo. |
| `imageMediaMetadata.whiteBalance` | `string`  Output only. The white balance mode used to create the photo. |
| `imageMediaMetadata.width` | `integer`  Output only. The width of the image in pixels. |
| `imageMediaMetadata.height` | `integer`  Output only. The height of the image in pixels. |
| `imageMediaMetadata.location` | `object`  Output only. Geographic location information stored in the image. |
| `imageMediaMetadata.location.latitude` | `number`  Output only. The latitude stored in the image. |
| `imageMediaMetadata.location.longitude` | `number`  Output only. The longitude stored in the image. |
| `imageMediaMetadata.location.altitude` | `number`  Output only. The altitude stored in the image. |
| `imageMediaMetadata.rotation` | `integer`  Output only. The number of clockwise 90 degree rotations applied from the image's original orientation. |
| `imageMediaMetadata.time` | `string`  Output only. The date and time the photo was taken (EXIF DateTime). |
| `imageMediaMetadata.cameraMake` | `string`  Output only. The make of the camera used to create the photo. |
| `imageMediaMetadata.cameraModel` | `string`  Output only. The model of the camera used to create the photo. |
| `imageMediaMetadata.exposureTime` | `number`  Output only. The length of the exposure, in seconds. |
| `imageMediaMetadata.aperture` | `number`  Output only. The aperture used to create the photo (f-number). |
| `imageMediaMetadata.focalLength` | `number`  Output only. The focal length used to create the photo, in millimeters. |
| `imageMediaMetadata.isoSpeed` | `integer`  Output only. The ISO speed used to create the photo. |
| `imageMediaMetadata.exposureBias` | `number`  Output only. The exposure bias of the photo (APEX value). |
| `imageMediaMetadata.maxApertureValue` | `number`  Output only. The smallest f-number of the lens at the focal length used to create the photo (APEX value). |
| `imageMediaMetadata.subjectDistance` | `integer`  Output only. The distance to the subject of the photo, in meters. |
| `imageMediaMetadata.lens` | `string`  Output only. The lens used to create the photo. |
| `videoMediaMetadata` | `object`  Output only. Additional metadata about video media. This may not be available immediately upon upload. |
| `videoMediaMetadata.width` | `integer`  Output only. The width of the video in pixels. |
| `videoMediaMetadata.height` | `integer`  Output only. The height of the video in pixels. |
| `videoMediaMetadata.durationMillis` | `string (int64 format)`  Output only. The duration of the video in milliseconds. |
| `shortcutDetails` | `object`  Shortcut file details. Only populated for shortcut files, which have the mimeType field set to `application/vnd.google-apps.shortcut`. Can only be set on `files.create` requests. |
| `shortcutDetails.targetId` | `string`  The ID of the file that this shortcut points to. Can only be set on `files.create` requests. |
| `shortcutDetails.targetMimeType` | `string`  Output only. The MIME type of the file that this shortcut points to. The value of this field is a snapshot of the target's MIME type, captured when the shortcut is created. |
| `shortcutDetails.targetResourceKey` | `string`  Output only. The `resourceKey` for the target file. |
| `contentRestrictions[]` | `object (ContentRestriction)`  Restrictions for accessing the content of the file. Only populated if such a restriction exists. |
| `resourceKey` | `string`  Output only. A key needed to access the item via a shared link. |
| `linkShareMetadata` | `object`  Output only. LinkShare related details. Contains details about the link URLs that clients are using to refer to this item. |
| `linkShareMetadata.securityUpdateEligible` | `boolean`  Output only. Whether the file is eligible for security update. |
| `linkShareMetadata.securityUpdateEnabled` | `boolean`  Output only. Whether the security update is enabled for this file. |
| `labelInfo` | `object`  Output only. An overview of the labels on the file. |
| `labelInfo.labels[]` | `object (Label)`  Output only. The set of labels on the file as requested by the label IDs in the `includeLabels` parameter. By default, no labels are returned. |
| `sha1Checksum` | `string`  Output only. The SHA1 checksum associated with this file, if available. This field is only populated for files with content stored in Google Drive; it's not populated for Docs Editors or shortcut files. |
| `sha256Checksum` | `string`  Output only. The SHA256 checksum associated with this file, if available. This field is only populated for files with content stored in Google Drive; it's not populated for Docs Editors or shortcut files. |
| `inheritedPermissionsDisabled` | `boolean`  Whether this file has inherited permissions disabled. Inherited permissions are enabled by default. |
| `downloadRestrictions` | `object (DownloadRestrictionsMetadata)`  Download restrictions applied on the file. |
| `clientEncryptionDetails` | `object (ClientEncryptionDetails)`  Client Side Encryption related details. Contains details about the encryption state of the file and details regarding the encryption mechanism that clients need to use when decrypting the contents of this item. This will only be present on files and not on folders or shortcuts. |

### ContentRestriction

A restriction for accessing the content of the file.

| JSON representation |
| --- |
| ``` {   "readOnly": boolean,   "reason": string,   "type": string,   "restrictingUser": {     object (User)   },   "restrictionTime": string,   "ownerRestricted": boolean,   "systemRestricted": boolean } ``` |

| Fields | |
| --- | --- |
| `readOnly` | `boolean`  Whether the content of the file is read-only. If a file is read-only, a new revision of the file may not be added, comments may not be added or modified, and the title of the file may not be modified. |
| `reason` | `string`  Reason for why the content of the file is restricted. This is only mutable on requests that also set `readOnly=true`. |
| `type` | `string`  Output only. The type of the content restriction. Currently the only possible value is `globalContentRestriction`. |
| `restrictingUser` | `object (User)`  Output only. The user who set the content restriction. Only populated if `readOnly=true`. |
| `restrictionTime` | `string`  Output only. The time at which the content restriction was set (formatted [RFC 3339 date-time](https://datatracker.ietf.org/doc/html/rfc3339)). Only populated if `readOnly=true`. |
| `ownerRestricted` | `boolean`  Whether the content restriction can only be modified or removed by a user who owns the file. For files in shared drives, any user with `organizer` capabilities can modify or remove this content restriction. |
| `systemRestricted` | `boolean`  Output only. Whether the content restriction was applied by the system, for example due to an esignature. Users cannot modify or remove system restricted content restrictions. |

### DownloadRestrictionsMetadata

Download restrictions applied to the file.

| JSON representation |
| --- |
| ``` {   "itemDownloadRestriction": {     object (DownloadRestriction)   },   "effectiveDownloadRestrictionWithContext": {     object (DownloadRestriction)   } } ``` |

| Fields | |
| --- | --- |
| `itemDownloadRestriction` | `object (DownloadRestriction)`  The download restriction of the file applied directly by the owner or organizer. This doesn't take into account shared drive settings or DLP rules. |
| `effectiveDownloadRestrictionWithContext` | `object (DownloadRestriction)`  Output only. The effective download restriction applied to this file. This considers all restriction settings and DLP rules. |

### DownloadRestriction

A restriction for copy and download of the file.

| JSON representation |
| --- |
| ``` {   "restrictedForReaders": boolean,   "restrictedForWriters": boolean } ``` |

| Fields | |
| --- | --- |
| `restrictedForReaders` | `boolean`  Whether download and copy is restricted for readers. |
| `restrictedForWriters` | `boolean`  Whether download and copy is restricted for writers. If true, download is also restricted for readers. |

### ClientEncryptionDetails

Details about the client-side encryption applied to the file.

| JSON representation |
| --- |
| ``` {   "encryptionState": string,   "decryptionMetadata": {     object (DecryptionMetadata)   } } ``` |

| Fields | |
| --- | --- |
| `encryptionState` | `string`  The encryption state of the file. The values expected here are:   * `encrypted` * `unencrypted` |
| `decryptionMetadata` | `object (DecryptionMetadata)`  The metadata used for client-side operations. |

### DecryptionMetadata

Representation of the CSE DecryptionMetadata.

| JSON representation |
| --- |
| ``` {   "wrappedKey": string,   "kaclsId": string,   "kaclsName": string,   "aes256GcmChunkSize": string,   "jwt": string,   "keyFormat": string,   "encryptionResourceKeyHash": string } ``` |

| Fields | |
| --- | --- |
| `wrappedKey` | `string`  The URL-safe Base64 encoded wrapped key used to encrypt the contents of the file. |
| `kaclsId` | `string (int64 format)`  The ID of the KACLS (Key ACL Service) used to encrypt the file. |
| `kaclsName` | `string`  The name of the KACLS (Key ACL Service) used to encrypt the file. |
| `aes256GcmChunkSize` | `string`  Chunk size used if content was encrypted with the AES 256 GCM Cipher. Possible values are:   * `default` * `small` |
| `jwt` | `string`  The signed JSON Web Token (JWT) which can be used to authorize the requesting user with the Key ACL Service (KACLS). The JWT asserts that the requesting user has at least read permissions on the file. |
| `keyFormat` | `string`  Key format for the unwrapped key. Must be `tinkAesGcmKey`. |
| `encryptionResourceKeyHash` | `string`  The URL-safe Base64 encoded HMAC-SHA256 digest of the resource metadata with its DEK (Data Encryption Key); see <https://developers.google.com/workspace/cse/reference> |

| Methods | |
| --- | --- |
| `copy` | Creates a copy of a file and applies any requested updates with patch semantics. |
| `create` | Creates a file. |
| `delete` | Permanently deletes a file owned by the user without moving it to the trash. |
| `download` | Downloads the content of a file. |
| `emptyTrash` | Permanently deletes all of the user's trashed files. |
| `export` | Exports a Google Workspace document to the requested MIME type and returns exported byte content. |
| `generateCseToken` | Generates a CSE token which can be used to create or update CSE files. |
| `generateIds` | Generates a set of file IDs which can be provided in create or copy requests. |
| `get` | Gets a file's metadata or content by ID. |
| `list` | Lists the user's files. |
| `listLabels` | Lists the labels on a file. |
| `modifyLabels` | Modifies the set of labels applied to a file. |
| `update` | Updates a file's metadata, content, or both. |
| `watch` | Subscribes to changes to a file. |
