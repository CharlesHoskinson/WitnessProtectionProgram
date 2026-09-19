# Method: accessproposals.list Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/list

Retrieved: 2026-09-19T16:30:35.983026+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

* [HTTP request](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/list#body.HTTP_TEMPLATE)
* [Path parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/list#body.PATH_PARAMETERS)
* [Query parameters](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/list#body.QUERY_PARAMETERS)
* [Request body](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/list#body.request_body)
* [Response body](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/list#body.response_body)
  + [JSON representation](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/list#body.ListAccessProposalsResponse.SCHEMA_REPRESENTATION)
* [Authorization scopes](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/list#body.aspect)
* [Try it!](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals/list#try-it)

List the access proposals on a file. For more information, see [Manage pending access proposals](https://developers.google.com/workspace/drive/api/guides/pending-access).

Note: Only approvers are able to list access proposals on a file. If the user isn't an approver, a 403 error is returned.

### HTTP request

`GET https://www.googleapis.com/drive/v3/files/{fileId}/accessproposals`

The URL uses [gRPC Transcoding](https://google.aip.dev/127) syntax.

### Path parameters

| Parameters | |
| --- | --- |
| `fileId` | `string`  Required. The ID of the item the request is on. |

### Query parameters

| Parameters | |
| --- | --- |
| `pageToken` | `string`  Optional. The continuation token on the list of access requests. |
| `pageSize` | `integer`  Optional. The number of results per page. |

### Request body

The request body must be empty.

### Response body

The response to an access proposal list request.

If successful, the response body contains data with the following structure:

| JSON representation |
| --- |
| ``` {   "accessProposals": [     {       object (AccessProposal)     }   ],   "nextPageToken": string } ``` |

| Fields | |
| --- | --- |
| `accessProposals[]` | `object (AccessProposal)`  The list of access proposals. This field is only populated in Drive API v3. |
| `nextPageToken` | `string`  The continuation token for the next page of results. This will be absent if the end of the results list has been reached. If the token is rejected for any reason, it should be discarded, and pagination should be restarted from the first page of results. |

### Authorization scopes

Requires one of the following OAuth scopes:

* `https://www.googleapis.com/auth/docs`
* `https://www.googleapis.com/auth/drive`
* `https://www.googleapis.com/auth/drive.file`
* `https://www.googleapis.com/auth/drive.metadata`
* `https://www.googleapis.com/auth/drive.metadata.readonly`
* `https://www.googleapis.com/auth/drive.readonly`

Some scopes are restricted and require a security assessment for your app to use them. For more information, see the [Authorization guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
