# Method: files.generateCseToken Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateCseToken

Retrieved: 2026-09-19T16:31:14.151571+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateCseToken#body.HTTP_TEMPLATE)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateCseToken#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateCseToken#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateCseToken#body.response_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateCseToken#body.GenerateCseTokenResponse.SCHEMA_REPRESENTATION)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateCseToken#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateCseToken#try-it)

Generates a CSE token which can be used to create or update CSE files.

### HTTP request

`GET https://www.googleapis.com/drive/v3/files/generateCseToken`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Query parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  The ID of the file for which the JWT should be generated. If not provided, an id will be generated. |
| `parent` | `string`  The ID of the expected parent of the file. Used when generating a JWT for a new CSE file. If specified, the parent will be fetched, and if the parent is a shared drive item, the shared drive's policy will be used to determine the KACLS that should be used.  It is invalid to specify both fileId and parent in a single request. |

### Request body

The request body must be empty.

### Response body

JWT and associated metadata used to generate CSE files.

If successful, the response body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "fileId": string,   "currentKaclsId": string,   "currentKaclsName": string,   "jwt": string,   "kind": string } ``` |

| Fields | |
| --- | --- |
| `fileId` | `string`  The fileId for which the JWT was generated. |
| `currentKaclsId` | `string (int64 format)`  The current Key ACL Service (KACLS) ID associated with the JWT. |
| `currentKaclsName` | `string`  Name of the KACLs that the returned KACLs ID points to. |
| `jwt` | `string`  The signed JSON Web Token (JWT) for the file. |
| `kind` | `string`  Output only. Identifies what kind of resource this is. Value: the fixed string `"drive#generateCseTokenResponse"`. |

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/docs`
* `https://www.googleapis.com/auth/drive`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
