# Method: apps.list Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/apps/list

Retrieved: 2026-09-19T16:30:47.818406+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps/list#body.HTTP_TEMPLATE)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps/list#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps/list#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps/list#body.response_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps/list#body.AppList.SCHEMA_REPRESENTATION)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps/list#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/apps/list#try-it)

Lists a user's installed apps. For more information, see [Return user info](https://developers.google.com/workspace/drive/api/guides/user-info).

### HTTP request

`GET https://www.googleapis.com/drive/v3/apps`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Query parameters

| Parameters | |
| --- | --- |
| `appFilterExtensions` | `string`  A comma-separated list of file extensions to limit returned results. All results within the given app query scope which can open any of the given file extensions are included in the response. If `appFilterMimeTypes` are provided as well, the result is a union of the two resulting app lists. |
| `appFilterMimeTypes` | `string`  A comma-separated list of file extensions to limit returned results. All results within the given app query scope which can open any of the given MIME types will be included in the response. If `appFilterExtensions` are provided as well, the result is a union of the two resulting app lists. |
| `languageCode` | `string`  A language or locale code, as defined by BCP 47, with some extensions from Unicode's LDML format (<http://www.unicode.org/reports/tr35/)>. |

### Request body

The request body must be empty.

### Response body

A list of third-party applications which the user has installed or given access to Google Drive.

If successful, the response body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "defaultAppIds": [     string   ],   "items": [     {       object (App)     }   ],   "kind": string,   "selfLink": string } ``` |

| Fields | |
| --- | --- |
| `defaultAppIds[]` | `string`  The list of app IDs that the user has specified to use by default. The list is in reverse-priority order (lowest to highest). |
| `items[]` | `object (App)`  The list of apps. |
| `kind` | `string`  Output only. Identifies what kind of resource this is. Value: the fixed string "drive#appList". |
| `selfLink` | `string`  A link back to this list. |

### Authorization scopes

Requires the following OAuth scope:

* `https://www.googleapis.com/auth/drive.apps.readonly`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
