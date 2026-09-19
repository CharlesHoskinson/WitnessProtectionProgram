# Method: drives.create Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/create

Retrieved: 2026-09-19T16:31:01.379233+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/create#body.HTTP_TEMPLATE)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/create#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/create#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/create#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/create#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/drives/create#try-it)

Creates a shared drive. For more information, see [Manage shared drives](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives).

### HTTP request

`POST https://www.googleapis.com/drive/v3/drives`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Query parameters

| Parameters | |
| --- | --- |
| `requestId` | `string`  Required. An ID, such as a random UUID, which uniquely identifies this user's request for idempotent creation of a shared drive. A repeated request by the same user and with the same request ID will avoid creating duplicates by attempting to create the same shared drive. If the shared drive already exists a 409 error will be returned. |

### Request body

The request body contains an instance of `Drive`.

### Response body

If successful, the response body contains a newly created instance of `Drive`.

### Authorization scopes

Requires the following OAuth scope:

* `https://www.googleapis.com/auth/drive`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
