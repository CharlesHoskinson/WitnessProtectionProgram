# Method: drives.list Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/list

Retrieved: 2026-09-19T16:31:05.588833+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/list#body.HTTP_TEMPLATE)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/list#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/list#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/list#body.response_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/list#body.DriveList.SCHEMA_REPRESENTATION)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/list#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/list#try-it)

Lists the user's shared drives.

This method accepts the `q` parameter, which is a search query combining one or more search terms. For more information, see the [Search for shared drives](https://developers.google.com/workspace/drive/api/guides/search-shareddrives) guide.

### HTTP request

`GET https://www.googleapis.com/drive/v3/drives`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Query parameters

| Parameters | |
| --- | --- |
| `pageSize` | `integer`  The maximum number of shared drives to return. The service may return fewer than this value.  If unspecified, at most 10 shared drives will be returned.  The maximum value is 100; values above 100 will be coerced to 100. |
| `pageToken` | `string`  Page token for shared drives. |
| `q` | `string`  Query string for searching shared drives. |
| `useDomainAdminAccess` | `boolean`  Issue the request as a domain administrator; if set to true, then all shared drives of the domain in which the requester is an administrator are returned. |

### Request body

The request body must be empty.

### Response body

A list of shared drives.

If successful, the response body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "drives": [     {       object (Drive)     }   ],   "nextPageToken": string,   "kind": string } ``` |

| Fields | |
| --- | --- |
| `drives[]` | `object (Drive)`  The list of shared drives. If nextPageToken is populated, then this list may be incomplete and an additional page of results should be fetched. |
| `nextPageToken` | `string`  The page token for the next page of shared drives. This will be absent if the end of the list has been reached. If the token is rejected for any reason, it should be discarded, and pagination should be restarted from the first page of results. The page token is typically valid for several hours. However, if new items are added or removed, your expected results might differ. |
| `kind` | `string`  Identifies what kind of resource this is. Value: the fixed string `"drive#driveList"`. |

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.readonly`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
