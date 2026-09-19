# REST Resource: drives Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/drives

Retrieved: 2026-09-19T16:31:00.350731+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [Resource: Drive](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives#Drive)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives#Drive.SCHEMA_REPRESENTATION)
* [Methods](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives#METHODS_SUMMARY)

## Resource: Drive

Representation of a shared drive.

Some resource methods (such as `drives.update`) require a `driveId`. Use the `drives.list` method to retrieve the ID for a shared drive.

| JSON representation |
| --- |
| ``` {   "id": string,   "name": string,   "colorRgb": string,   "kind": string,   "backgroundImageLink": string,   "capabilities": {     "canAddChildren": boolean,     "canComment": boolean,     "canCopy": boolean,     "canDeleteDrive": boolean,     "canDownload": boolean,     "canEdit": boolean,     "canListChildren": boolean,     "canManageMembers": boolean,     "canReadRevisions": boolean,     "canRename": boolean,     "canRenameDrive": boolean,     "canChangeDriveBackground": boolean,     "canShare": boolean,     "canChangeCopyRequiresWriterPermissionRestriction": boolean,     "canChangeDomainUsersOnlyRestriction": boolean,     "canChangeDriveMembersOnlyRestriction": boolean,     "canChangeSharingFoldersRequiresOrganizerPermissionRestriction": boolean,     "canResetDriveRestrictions": boolean,     "canDeleteChildren": boolean,     "canTrashChildren": boolean,     "canChangeDownloadRestriction": boolean   },   "themeId": string,   "backgroundImageFile": {     "id": string,     "xCoordinate": number,     "yCoordinate": number,     "width": number   },   "createdTime": string,   "hidden": boolean,   "restrictions": {     "copyRequiresWriterPermission": boolean,     "domainUsersOnly": boolean,     "driveMembersOnly": boolean,     "adminManagedRestrictions": boolean,     "sharingFoldersRequiresOrganizerPermission": boolean,     "downloadRestriction": {       object (DownloadRestriction)     }   },   "orgUnitId": string } ``` |

| Fields | |
| --- | --- |
| `id` | `string`  Output only. The ID of this shared drive which is also the ID of the top level folder of this shared drive. |
| `name` | `string`  The name of this shared drive. |
| `colorRgb` | `string`  The color of this shared drive as an RGB hex string. It can only be set on a `drive.drives.update` request that does not set `themeId`. |
| `kind` | `string`  Output only. Identifies what kind of resource this is. Value: the fixed string `"drive#drive"`. |
| `backgroundImageLink` | `string`  Output only. A short-lived link to this shared drive's background image. |
| `capabilities` | `object`  Output only. Capabilities the current user has on this shared drive. |
| `capabilities.canAddChildren` | `boolean`  Output only. Whether the current user can add children to folders in this shared drive. |
| `capabilities.canComment` | `boolean`  Output only. Whether the current user can comment on files in this shared drive. |
| `capabilities.canCopy` | `boolean`  Output only. Whether the current user can copy files in this shared drive. |
| `capabilities.canDeleteDrive` | `boolean`  Output only. Whether the current user can delete this shared drive. Attempting to delete the shared drive may still fail if there are untrashed items inside the shared drive. |
| `capabilities.canDownload` | `boolean`  Output only. Whether the current user can download files in this shared drive. |
| `capabilities.canEdit` | `boolean`  Output only. Whether the current user can edit files in this shared drive |
| `capabilities.canListChildren` | `boolean`  Output only. Whether the current user can list the children of folders in this shared drive. |
| `capabilities.canManageMembers` | `boolean`  Output only. Whether the current user can add members to this shared drive or remove them or change their role. |
| `capabilities.canReadRevisions` | `boolean`  Output only. Whether the current user can read the revisions resource of files in this shared drive. |
| `capabilities.canRename` | `boolean`  Output only. Whether the current user can rename files or folders in this shared drive. |
| `capabilities.canRenameDrive` | `boolean`  Output only. Whether the current user can rename this shared drive. |
| `capabilities.canChangeDriveBackground` | `boolean`  Output only. Whether the current user can change the background of this shared drive. |
| `capabilities.canShare` | `boolean`  Output only. Whether the current user can share files or folders in this shared drive. |
| `capabilities.canChangeCopyRequiresWriterPermissionRestriction` | `boolean`  Output only. Whether the current user can change the `copyRequiresWriterPermission` restriction of this shared drive. |
| `capabilities.canChangeDomainUsersOnlyRestriction` | `boolean`  Output only. Whether the current user can change the `domainUsersOnly` restriction of this shared drive. |
| `capabilities.canChangeDriveMembersOnlyRestriction` | `boolean`  Output only. Whether the current user can change the `driveMembersOnly` restriction of this shared drive. |
| `capabilities.canChangeSharingFoldersRequiresOrganizerPermissionRestriction` | `boolean`  Output only. Whether the current user can change the `sharingFoldersRequiresOrganizerPermission` restriction of this shared drive. |
| `capabilities.canResetDriveRestrictions` | `boolean`  Output only. Whether the current user can reset the shared drive restrictions to defaults. |
| `capabilities.canDeleteChildren` | `boolean`  Output only. Whether the current user can delete children from folders in this shared drive. |
| `capabilities.canTrashChildren` | `boolean`  Output only. Whether the current user can trash children from folders in this shared drive. |
| `capabilities.canChangeDownloadRestriction` | `boolean`  Output only. Whether the current user can change organizer-applied download restrictions of this shared drive. |
| `themeId` | `string`  The ID of the theme from which the background image and color will be set. The set of possible `driveThemes` can be retrieved from a `drive.about.get` response. When not specified on a `drive.drives.create` request, a random theme is chosen from which the background image and color are set. This is a write-only field; it can only be set on requests that don't set `colorRgb` or `backgroundImageFile`. |
| `backgroundImageFile` | `object`  An image file and cropping parameters from which a background image for this shared drive is set. This is a write only field; it can only be set on `drive.drives.update` requests that don't set `themeId`. When specified, all fields of the `backgroundImageFile` must be set. |
| `backgroundImageFile.id` | `string`  The ID of an image file in Google Drive to use for the background image. |
| `backgroundImageFile.xCoordinate` | `number`  The X coordinate of the upper left corner of the cropping area in the background image. This is a value in the closed range of 0 to 1. This value represents the horizontal distance from the left side of the entire image to the left side of the cropping area divided by the width of the entire image. |
| `backgroundImageFile.yCoordinate` | `number`  The Y coordinate of the upper left corner of the cropping area in the background image. This is a value in the closed range of 0 to 1. This value represents the vertical distance from the top side of the entire image to the top side of the cropping area divided by the height of the entire image. |
| `backgroundImageFile.width` | `number`  The width of the cropped image in the closed range of 0 to 1. This value represents the width of the cropped image divided by the width of the entire image. The height is computed by applying a width to height aspect ratio of 80 to 9. The resulting image must be at least 1280 pixels wide and 144 pixels high. |
| `createdTime` | `string`  Output only. The time at which the shared drive was created (RFC 3339 date-time). |
| `hidden` | `boolean`  Whether the shared drive is hidden from default view. |
| `restrictions` | `object`  A set of restrictions that apply to this shared drive or items inside this shared drive. Note that restrictions can't be set when creating a shared drive. To add a restriction, first create a shared drive and then use `drives.update` to add restrictions. |
| `restrictions.copyRequiresWriterPermission` | `boolean`  Whether the options to copy, print, or download files inside this shared drive, should be disabled for readers and commenters. When this restriction is set to `true`, it will override the similarly named field to `true` for any file inside this shared drive. |
| `restrictions.domainUsersOnly` | `boolean`  Whether access to this shared drive and items inside this shared drive is restricted to users of the domain to which this shared drive belongs. This restriction may be overridden by other sharing policies controlled outside of this shared drive. |
| `restrictions.driveMembersOnly` | `boolean`  Whether access to items inside this shared drive is restricted to its members. |
| `restrictions.adminManagedRestrictions` | `boolean`  Whether administrative privileges on this shared drive are required to modify restrictions. |
| `restrictions.sharingFoldersRequiresOrganizerPermission` | `boolean`  If true, only users with the organizer role can share folders. If false, users with either the organizer role or the file organizer role can share folders. |
| `restrictions.downloadRestriction` | `object (DownloadRestriction)`  Download restrictions applied by shared drive managers. |
| `orgUnitId` | `string`  Output only. The organizational unit of this shared drive. This field is only populated on `drives.list` responses when the `useDomainAdminAccess` parameter is set to `true`. |

| Methods | |
| --- | --- |
| `create` | Creates a shared drive. |
| `delete` | Permanently deletes a shared drive for which the user is an `organizer`. |
| `get` | Gets a shared drive's metadata by ID. |
| `hide` | Hides a shared drive from the default view. |
| `list` | Lists the user's shared drives. |
| `unhide` | Restores a shared drive to the default view. |
| `update` | Updates the metadata for a shared drive. |
