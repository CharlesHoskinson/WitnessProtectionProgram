# REST Resource: changes Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/changes

Retrieved: 2026-09-19T16:30:48.630436+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [Resource: Change](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes#Change)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes#Change.SCHEMA_REPRESENTATION)
* [Methods](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes#METHODS_SUMMARY)

## Resource: Change

A change to a file or shared drive.

| JSON representation |
| --- |
| ``` {   "kind": string,   "removed": boolean,   "file": {     object (File)   },   "fileId": string,   "time": string,   "driveId": string,   "type": string,   "teamDriveId": string,   "teamDrive": {     object (TeamDrive)   },   "changeType": string,   "drive": {     object (Drive)   } } ``` |

| Fields | |
| --- | --- |
| `kind` | `string`  Identifies what kind of resource this is. Value: the fixed string `"drive#change"`. |
| `removed` | `boolean`  Whether the file or shared drive has been removed from this list of changes, for example by deletion or loss of access. |
| `file` | `object (File)`  The updated state of the file. Present if the type is file and the file has not been removed from this list of changes. |
| `fileId` | `string`  The ID of the file which has changed. |
| `time` | `string`  The time of this change (RFC 3339 date-time). |
| `driveId` | `string`  The ID of the shared drive associated with this change. |
| `type (deprecated)` | `string`  This item is deprecated!  Deprecated: Use `changeType` instead. |
| `teamDriveId (deprecated)` | `string`  This item is deprecated!  Deprecated: Use `driveId` instead. |
| `teamDrive (deprecated)` | `object (TeamDrive)`  This item is deprecated!  Deprecated: Use `drive` instead. |
| `changeType` | `string`  The type of the change. Possible values are `file` and `drive`. |
| `drive` | `object (Drive)`  The updated state of the shared drive. Present if the changeType is drive, the user is still a member of the shared drive, and the shared drive has not been deleted. |

| Methods | |
| --- | --- |
| `getStartPageToken` | Gets the starting pageToken for listing future changes. |
| `list` | Lists the changes for a user or shared drive. |
| `watch` | Subscribes to changes for a user. |
