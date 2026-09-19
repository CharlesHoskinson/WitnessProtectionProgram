# REST Resource: apps Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/apps

Retrieved: 2026-09-19T16:30:45.966862+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [Resource: App](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps#App)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps#App.SCHEMA_REPRESENTATION)
* [Icons](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps#Icons)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps#Icons.SCHEMA_REPRESENTATION)
* [Methods](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps#METHODS_SUMMARY)

## Resource: App

The `apps` resource provides a list of apps that a user has installed, with information about each app's supported MIME types, file extensions, and other details.

Some resource methods (such as `apps.get`) require an `appId`. Use the `apps.list` method to retrieve the ID for an installed application.

| JSON representation |
| --- |
| ``` {   "primaryMimeTypes": [     string   ],   "secondaryMimeTypes": [     string   ],   "primaryFileExtensions": [     string   ],   "secondaryFileExtensions": [     string   ],   "icons": [     {       object (Icons)     }   ],   "name": string,   "objectType": string,   "supportsCreate": boolean,   "productUrl": string,   "id": string,   "supportsImport": boolean,   "installed": boolean,   "authorized": boolean,   "useByDefault": boolean,   "kind": string,   "shortDescription": string,   "longDescription": string,   "supportsMultiOpen": boolean,   "productId": string,   "openUrlTemplate": string,   "createUrl": string,   "createInFolderTemplate": string,   "supportsOfflineCreate": boolean,   "hasDriveWideScope": boolean } ``` |

| Fields | |
| --- | --- |
| `primaryMimeTypes[]` | `string`  The list of primary MIME types. |
| `secondaryMimeTypes[]` | `string`  The list of secondary MIME types. |
| `primaryFileExtensions[]` | `string`  The list of primary file extensions. |
| `secondaryFileExtensions[]` | `string`  The list of secondary file extensions. |
| `icons[]` | `object (Icons)`  The various icons for the app. |
| `name` | `string`  The name of the app. |
| `objectType` | `string`  The type of object this app creates such as a Chart. If empty, the app name should be used instead. |
| `supportsCreate` | `boolean`  Whether this app supports creating objects. |
| `productUrl` | `string`  A link to the product listing for this app. |
| `id` | `string`  The ID of the app. |
| `supportsImport` | `boolean`  Whether this app supports importing from Google Docs. |
| `installed` | `boolean`  Whether the app is installed. |
| `authorized` | `boolean`  Whether the app is authorized to access data on the user's Drive. |
| `useByDefault` | `boolean`  Whether the app is selected as the default handler for the types it supports. |
| `kind` | `string`  Output only. Identifies what kind of resource this is. Value: the fixed string "drive#app". |
| `shortDescription` | `string`  A short description of the app. |
| `longDescription` | `string`  A long description of the app. |
| `supportsMultiOpen` | `boolean`  Whether this app supports opening more than one file. |
| `productId` | `string`  The ID of the product listing for this app. |
| `openUrlTemplate` | `string`  The template URL for opening files with this app. The template contains  `{ids}`  or  `{exportIds}`  to be replaced by the actual file IDs. For more information, see  [Open Files](https://developers.google.com/workspace/drive/web/integrate-open)  for the full documentation. |
| `createUrl` | `string`  The URL to create a file with this app. |
| `createInFolderTemplate` | `string`  The template URL to create a file with this app in a given folder. The template contains the {folderId} to be replaced by the folder ID house the new file. |
| `supportsOfflineCreate` | `boolean`  Whether this app supports creating files when offline. |
| `hasDriveWideScope` | `boolean`  Whether the app has Drive-wide scope. An app with Drive-wide scope can access all files in the user's Drive. |

## Icons

| JSON representation |
| --- |
| ``` {   "size": integer,   "category": string,   "iconUrl": string } ``` |

| Fields | |
| --- | --- |
| `size` | `integer`  Size of the icon. Represented as the maximum of the width and height. |
| `category` | `string`  Category of the icon. Allowed values are:   * `application` - The icon for the application. * `document` - The icon for a file associated with the app. * `documentShared` - The icon for a shared file associated with the app. |
| `iconUrl` | `string`  URL for the icon. |

| Methods | |
| --- | --- |
| `get` | Gets a specific app. |
| `list` | Lists a user's installed apps. |
