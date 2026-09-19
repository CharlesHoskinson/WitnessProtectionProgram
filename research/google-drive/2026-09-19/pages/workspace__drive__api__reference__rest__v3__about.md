# REST Resource: about Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/about

Retrieved: 2026-09-19T16:30:32.785298+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [Resource: About](https://developers.google.com/workspace/drive/api/reference/rest/v3/about#About)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/about#About.SCHEMA_REPRESENTATION)
* [Methods](https://developers.google.com/workspace/drive/api/reference/rest/v3/about#METHODS_SUMMARY)

## Resource: About

Information about the user, the user's Drive, and system capabilities.

| JSON representation |
| --- |
| ``` {   "driveThemes": [     {       "id": string,       "backgroundImageLink": string,       "colorRgb": string     }   ],   "importFormats": {     string: value,     ...   },   "exportFormats": {     string: value,     ...   },   "folderColorPalette": [     string   ],   "maxImportSizes": {     string: string,     ...   },   "teamDriveThemes": [     {       "id": string,       "backgroundImageLink": string,       "colorRgb": string     }   ],   "kind": string,   "storageQuota": {     "limit": string,     "usageInDrive": string,     "usageInDriveTrash": string,     "usage": string   },   "canCreateDrives": boolean,   "appInstalled": boolean,   "user": {     object (User)   },   "maxUploadSize": string,   "canCreateTeamDrives": boolean } ``` |

| Fields | |
| --- | --- |
| `driveThemes[]` | `object`  A list of themes that are supported for shared drives. |
| `driveThemes[].id` | `string`  The ID of the theme. |
| `driveThemes[].backgroundImageLink` | `string`  A link to this theme's background image. |
| `driveThemes[].colorRgb` | `string`  The color of this theme as an RGB hex string. |
| `importFormats` | `map (key: string, value: value (Value format))`  A map of source MIME type to possible targets for all supported imports.  An object containing a list of `"key": value` pairs. Example: `{ "name": "wrench", "mass": "1.3kg", "count": "3" }`. |
| `exportFormats` | `map (key: string, value: value (Value format))`  A map of source MIME type to possible targets for all supported exports.  An object containing a list of `"key": value` pairs. Example: `{ "name": "wrench", "mass": "1.3kg", "count": "3" }`. |
| `folderColorPalette[]` | `string`  The currently supported folder colors as RGB hex strings. |
| `maxImportSizes` | `map (key: string, value: string (int64 format))`  A map of maximum import sizes by MIME type, in bytes.  An object containing a list of `"key": value` pairs. Example: `{ "name": "wrench", "mass": "1.3kg", "count": "3" }`. |
| `teamDriveThemes[] (deprecated)` | `object`  This item is deprecated!  Deprecated: Use `driveThemes` instead. |
| `teamDriveThemes[] (deprecated).id (deprecated)` | `string`  Deprecated: Use `driveThemes/id` instead. |
| `teamDriveThemes[] (deprecated).backgroundImageLink (deprecated)` | `string`  Deprecated: Use `driveThemes/backgroundImageLink` instead. |
| `teamDriveThemes[] (deprecated).colorRgb (deprecated)` | `string`  Deprecated: Use `driveThemes/colorRgb` instead. |
| `kind` | `string`  Identifies what kind of resource this is. Value: the fixed string `"drive#about"`. |
| `storageQuota` | `object`  The user's storage quota limits and usage. For users that are part of an organization with pooled storage, information about the limit and usage across all services is for the organization, rather than the individual user. All fields are measured in bytes. |
| `storageQuota.limit` | `string (int64 format)`  The usage limit, if applicable. This will not be present if the user has unlimited storage. For users that are part of an organization with pooled storage, this is the limit for the organization, rather than the individual user. |
| `storageQuota.usageInDrive` | `string (int64 format)`  The usage by all files in Google Drive. |
| `storageQuota.usageInDriveTrash` | `string (int64 format)`  The usage by trashed files in Google Drive. |
| `storageQuota.usage` | `string (int64 format)`  The total usage across all services. For users that are part of an organization with pooled storage, this is the usage across all services for the organization, rather than the individual user. |
| `canCreateDrives` | `boolean`  Whether the user can create shared drives. |
| `appInstalled` | `boolean`  Whether the user has installed the requesting app. |
| `user` | `object (User)`  The authenticated user. |
| `maxUploadSize` | `string (int64 format)`  The maximum upload size in bytes. |
| `canCreateTeamDrives (deprecated)` | `boolean`  This item is deprecated!  Deprecated: Use `canCreateDrives` instead. |

| Methods | |
| --- | --- |
| `get` | Gets information about the user, the user's Drive, and system capabilities. |
