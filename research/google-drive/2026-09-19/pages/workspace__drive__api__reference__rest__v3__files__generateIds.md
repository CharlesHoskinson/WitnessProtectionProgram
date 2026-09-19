# Method: files.generateIds Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds

Retrieved: 2026-09-19T16:31:15.239360+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds#body.HTTP_TEMPLATE)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds#body.response_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds#body.GeneratedIds.SCHEMA_REPRESENTATION)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds#try-it)

Generates a set of file IDs which can be provided in create or copy requests. For more information, see [Create and manage files](https://developers.google.com/workspace/drive/api/guides/create-file).

### HTTP request

`GET https://www.googleapis.com/drive/v3/files/generateIds`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Query parameters

| Parameters | |
| --- | --- |
| `count` | `integer`  The number of IDs to return. |
| `space` | `string`  The space in which the IDs can be used to create files. Supported values are `drive` and `appDataFolder`. (Default: `drive`.) For more information, see [File organization](https://developers.google.com/workspace/drive/api/guides/about-files#file-organization). |
| `type` | `string`  The type of items which the IDs can be used for. Supported values are `files` and `shortcuts`. Note that `shortcuts` are only supported in the `drive` `space`. (Default: `files`.) For more information, see [File organization](https://developers.google.com/workspace/drive/api/guides/about-files#file-organization). |

### Request body

The request body must be empty.

### Response body

A list of generated file IDs which can be provided in create requests.

If successful, the response body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "ids": [     string   ],   "space": string,   "kind": string } ``` |

| Fields | |
| --- | --- |
| `ids[]` | `string`  The IDs generated for the requesting user in the specified space. |
| `space` | `string`  The type of file that can be created with these IDs. |
| `kind` | `string`  Identifies what kind of resource this is. Value: the fixed string `"drive#generatedIds"`. |

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.appdata`
* `https://www.googleapis.com/auth/drive.file`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
