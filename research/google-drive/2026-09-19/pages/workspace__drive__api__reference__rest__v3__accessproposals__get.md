# Method: accessproposals.get Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/get

Retrieved: 2026-09-19T16:30:35.108202+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/get#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/get#body.PATH_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/get#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/get#body.response_body)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/get#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/get#try-it)

Retrieves an access proposal by ID. For more information, see [Manage pending access proposals](https://developers.google.com/workspace/drive/api/guides/pending-access).

### HTTP request

`GET https://www.googleapis.com/drive/v3/files/{fileId}/accessproposals/{proposalId}`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  Required. The ID of the item the request is on. |
| `proposalId` | `string`  Required. The ID of the access proposal to resolve. |

### Request body

The request body must be empty.

### Response body

If successful, the response body contains an instance of `AccessProposal`.

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/docs`
* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/drive.metadata`
* `https://www.googleapis.com/auth/drive.metadata.readonly`
* `https://www.googleapis.com/auth/drive.readonly`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
